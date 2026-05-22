# Race Condition Findings Demo

Full-stack demo that intentionally reproduces stale API responses overriding newer UI state, then shows the fixed implementation.

## Folder structure

```text
RaceCondition/
  backend/
    manage.py
    requirements.txt
    race_demo/
      settings.py
      urls.py
    findings/
      mock_data.py
      urls.py
      views.py
  frontend/
    package.json
    index.html
    src/
      api/findingsApi.ts
      state/atoms.ts
      App.tsx
      main.tsx
      styles.css
      types.ts
```

## Backend

The Django REST Framework endpoints are:

```text
GET /api/findings/?tenant_id=tenant-a&filter=all&request_id=wrong-1
GET /api/summary/?tenant_id=tenant-a&filter=all&request_id=wrong-1
GET /api/metrics/?tenant_id=tenant-a&filter=all&request_id=wrong-1
GET /api/assets/?tenant_id=tenant-a&filter=all&request_id=wrong-1
GET /api/activity/?tenant_id=tenant-a&filter=all&request_id=wrong-1
```

It accepts:

- `tenant_id`: `tenant-a` or `tenant-b`
- `filter`: `all`, `filter-1`, or `filter-2`
- `request_id`: client-generated ID used for logs

Intentional delays:

- Quick APIs: summary, metrics, assets return in about 1 second.
- Slow APIs: findings and activity return in about 6 seconds.
- `filter-2`: all APIs return in about 1 second so fast filter changes can race slow `filter-1` responses.

The backend prints request started/completed logs with request ID, tenant, filter, timestamps, response count, and delay.

## Frontend

The React app uses:

- Axios API layer: `frontend/src/api/findingsApi.ts`
- Jotai atoms: `frontend/src/state/atoms.ts`
- Wrong implementation: `useWrongFanOutFetch` in `frontend/src/App.tsx`
- Fixed implementation: `useFixedFanOutFetch` in `frontend/src/App.tsx`

Jotai atoms:

```ts
selectedTenantAtom
selectedFilterAtom
apiResponsesAtom
loadingAtom
errorAtom
demoModeAtom
latestRequestIdAtom
```

Each tenant or filter change fans out into five API calls:

| API | Endpoint | Speed |
| --- | --- | --- |
| Findings table | `GET /api/findings/` | Slow |
| Summary counts | `GET /api/summary/` | Quick |
| Risk metrics | `GET /api/metrics/` | Quick |
| Affected assets | `GET /api/assets/` | Quick |
| Recent activity | `GET /api/activity/` | Slow |

The three quick APIs return in about 1 second. The two slow APIs return in about 6 seconds, except `filter-2`, which intentionally returns quickly so you can reproduce the slow-filter to fast-filter overwrite.

## Run locally

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py runserver 127.0.0.1:8009
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Reproduce stale tenant overwrite

1. Select `Wrong` mode.
2. Select `Tenant A`.
3. Quickly switch to `Tenant B`.
4. Tenant B quick APIs return first and update summary, metrics, and assets.
5. Tenant B slow APIs return and update findings/activity.
6. Tenant A slow APIs return later and incorrectly overwrite findings/activity even though Tenant B is selected.

Watch the browser console for:

```text
[WRONG] request started
[WRONG] request completed
[WRONG] state updated by id=wrong-...
```

## Reproduce stale filter overwrite

1. Select `Wrong` mode.
2. Click `Filter 1`.
3. Quickly click `Filter 2`.
4. Filter 2 returns first and updates all five sections.
5. Filter 1 slow responses arrive later and incorrectly overwrite findings/activity even though Filter 2 is selected.

## Fixed behavior

1. Switch to `Fixed` mode.
2. Repeat either reproduction flow.
3. The previous group of five requests is canceled with `AbortController`.
4. If any old response still resolves, the request sequence check prevents it from updating its section of state.

Fixed console logs include:

```text
[FIXED] cleanup aborting
[FIXED] request canceled
[FIXED] ignored stale response
[FIXED] state updated by latest response
```

## Why the race condition happens

HTTP responses can complete in a different order than they were started. In the wrong implementation, every response writes into shared Jotai state. A slow Tenant A request may start first, then a fast Tenant B request starts second and finishes first. Because the Tenant A response is not canceled or validated, it eventually writes stale Tenant A data over the newer Tenant B UI state.

In the multi-call version, the bug is even easier to see. A single UI event starts five requests. Three quick requests may update the dashboard almost immediately, while two slower requests are still pending. If the user changes tenant or filter during that window, old slow responses can later overwrite only part of the page, leaving a mixed UI where summary data belongs to one tenant/filter and findings or activity belong to another.

Slow or heavy requests make this more likely because they increase the time window where the user can change context. Large datasets, expensive filters, slow joins, remote service calls, retries, and cold caches all widen that window.

This is dangerous in multi-tenant applications because a stale response can show the wrong tenant's data under the currently selected tenant. Even in a demo with mock data, that is the shape of a serious isolation and confidentiality bug.

## Why it happens in code

The wrong implementation starts five new requests whenever `tenantId` or `filterId` changes, but it does not cancel the previous group. It also does not check whether each response still belongs to the currently selected tenant and filter before writing to state.

Simplified wrong version:

```tsx
useEffect(() => {
  const eventId = Date.now();

  demoApis.forEach((apiConfig) => {
    const requestId = `wrong-${eventId}-${apiConfig.name}`;

    getDemoApi(apiConfig.name, { tenantId, filterId, requestId })
      .then((data) => {
      console.log(
        `[WRONG] ${apiConfig.name} updated by id=${requestId}`
      );

      // Bug: this response always wins, even if the user already switched
      // to another tenant or filter while this request was still running.
      setResponses((current) => ({
        ...current,
        [data.api_name]: data
      }));
    });
  });
}, [tenantId, filterId]);
```

Example timeline:

```text
00:00  User selects Tenant A
00:00  Tenant A starts 5 requests: 3 quick, 2 slow
00:01  User switches to Tenant B
00:01  Tenant B starts 5 requests: 3 quick, 2 slow
00:02  Tenant B quick responses update summary, metrics, assets
00:07  Tenant A slow responses overwrite findings/activity with stale data
```

The frontend state is not wrong because React or Jotai are broken. It is wrong because the code treats "response completed" as the same thing as "response is still relevant." Those are different things.

## Why cancellation plus validation fixes it

Cancellation asks Axios and the browser to abandon work for a request the UI no longer cares about. Request sequence validation protects the state layer even if cancellation is too late, unsupported somewhere in the stack, or a response resolves before the abort is observed. The latest request ID becomes the only request allowed to commit data.

## How the fix works in code

The fixed implementation uses two protections for the whole group of five requests:

- `AbortController` cancels the previous Axios requests when tenant or filter changes.
- A request sequence number ensures only the latest event can update Jotai state.

Simplified fixed API call:

```ts
export async function getDemoApi(
  apiName: ApiName,
  {
    tenantId,
    filterId,
    requestId,
    signal
  }: FindingsParams
): Promise<DemoApiResponse> {
  const apiConfig = demoApis.find((item) => item.name === apiName);

  const response = await api.get<DemoApiResponse>(apiConfig.path, {
    params: {
      tenant_id: tenantId,
      filter: filterId,
      request_id: requestId
    },
    signal
  });

  return response.data;
}
```

Simplified fixed React effect:

```tsx
const latestRequestRef = useRef(0);

useEffect(() => {
  const controller = new AbortController();
  const eventNumber = latestRequestRef.current + 1;

  latestRequestRef.current = eventNumber;
  setLoading(true);
  setResponses({});

  demoApis.forEach((apiConfig) => {
    const requestId = `fixed-${eventNumber}-${apiConfig.name}`;

    getDemoApi(apiConfig.name, {
      tenantId,
      filterId,
      requestId,
      signal: controller.signal
    })
      .then((data) => {
        const isLatest = latestRequestRef.current === eventNumber;

        if (!isLatest) {
          console.warn(`[FIXED] ignored stale response id=${requestId}`);
          return;
        }

        setResponses((current) => ({
          ...current,
          [data.api_name]: data
        }));
      })
      .catch((error) => {
        if (isCanceledRequest(error)) {
          console.warn(`[FIXED] request canceled id=${requestId}`);
          return;
        }

        if (latestRequestRef.current === eventNumber) {
          setError("Request failed.");
        }
      });
  });

  return () => {
    controller.abort();
  };
}, [tenantId, filterId]);
```

Why both protections matter:

- Cancellation reduces wasted work and prevents many obsolete requests from completing in the browser.
- Sequence validation is the final safety check before state mutation.
- If a request cannot be canceled in time, the stale response still cannot overwrite the latest UI state.
- Loading state is also guarded so an old request cannot incorrectly mark the newest request as finished.

## Production recommendations

- Debounce rapidly changing filters before sending requests.
- Deduplicate identical in-flight requests.
- Consider TanStack Query for query keys, cancellation, caching, retries, and stale result handling.
- Validate tenant access on every backend request using authenticated user context, not client-provided tenant IDs alone.
- Isolate loading state per request or per query key instead of using one global loading flag.
- Clear stale data immediately on tenant or security-context switch.
- Add backend pagination and server-side limits for large tenants.
- Log request IDs across frontend and backend for traceability.
- Keep stale-response guards even when using cancellation.
