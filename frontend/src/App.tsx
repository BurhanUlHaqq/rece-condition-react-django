import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";

import { demoApis, getDemoApi, isCanceledRequest } from "./api/findingsApi";
import {
  apiResponsesAtom,
  demoModeAtom,
  errorAtom,
  latestRequestIdAtom,
  loadingAtom,
  selectedFilterAtom,
  selectedTenantAtom
} from "./state/atoms";
import type {
  ActivityResponse,
  ApiName,
  ApiResponses,
  AssetsResponse,
  DemoApiResponse,
  DemoMode,
  FilterId,
  FindingsResponse,
  MetricsResponse,
  SummaryResponse,
  TenantId
} from "./types";

const tenants: Array<{ id: TenantId; label: string; hint: string }> = [
  { id: "tenant-a", label: "Tenant A", hint: "large dataset" },
  { id: "tenant-b", label: "Tenant B", hint: "small dataset" }
];

const filters: Array<{ id: FilterId; label: string; hint: string }> = [
  { id: "all", label: "All", hint: "slow endpoints take 6s" },
  { id: "filter-1", label: "Filter 1", hint: "slow endpoints take 6s" },
  { id: "filter-2", label: "Filter 2", hint: "all endpoints return in about 1s" }
];

function now() {
  return new Date().toISOString();
}

function describeContext(tenantId: TenantId, filterId: FilterId) {
  return `tenant=${tenantId} filter=${filterId}`;
}

function mergeResponse(response: DemoApiResponse) {
  return (current: ApiResponses) => ({
    ...current,
    [response.api_name]: response
  });
}

function useWrongFanOutFetch() {
  const tenantId = useAtomValue(selectedTenantAtom);
  const filterId = useAtomValue(selectedFilterAtom);
  const setResponses = useSetAtom(apiResponsesAtom);
  const setLoading = useSetAtom(loadingAtom);
  const setError = useSetAtom(errorAtom);
  const localSequenceRef = useRef(0);

  useEffect(() => {
    const eventNumber = ++localSequenceRef.current;
    let pending = demoApis.length;

    console.log(
      `[WRONG] event started id=wrong-${eventNumber} ${describeContext(tenantId, filterId)} apiCount=${demoApis.length} at=${now()}`
    );

    setLoading(true);
    setError(null);

    demoApis.forEach((apiConfig) => {
      const requestId = `wrong-${eventNumber}-${apiConfig.name}`;

      console.log(
        `[WRONG] request started api=${apiConfig.name} speed=${apiConfig.speed} id=${requestId} ${describeContext(tenantId, filterId)} at=${now()}`
      );

      getDemoApi(apiConfig.name, { tenantId, filterId, requestId })
        .then((data) => {
          console.log(
            `[WRONG] request completed api=${apiConfig.name} id=${requestId} responseTenant=${data.tenant_id} responseFilter=${data.filter_id} at=${now()}`
          );
          console.log(
            `[WRONG] ${apiConfig.name} state updated by id=${requestId}; stale responses are allowed`
          );
          setResponses(mergeResponse(data));
        })
        .catch((error: unknown) => {
          console.error(`[WRONG] request failed api=${apiConfig.name} id=${requestId}`, error);
          setError("Request failed. Is the Django API running on port 8009?");
        })
        .finally(() => {
          pending -= 1;
          if (pending === 0) {
            setLoading(false);
          }
        });
    });
  }, [tenantId, filterId, setError, setLoading, setResponses]);
}

function useFixedFanOutFetch() {
  const tenantId = useAtomValue(selectedTenantAtom);
  const filterId = useAtomValue(selectedFilterAtom);
  const setResponses = useSetAtom(apiResponsesAtom);
  const setLoading = useSetAtom(loadingAtom);
  const setError = useSetAtom(errorAtom);
  const [latestRequestId, setLatestRequestId] = useAtom(latestRequestIdAtom);
  const latestRequestRef = useRef(latestRequestId);

  useEffect(() => {
    latestRequestRef.current = latestRequestId;
  }, [latestRequestId]);

  useEffect(() => {
    const controller = new AbortController();
    const eventNumber = latestRequestRef.current + 1;
    let pending = demoApis.length;

    latestRequestRef.current = eventNumber;
    setLatestRequestId(eventNumber);

    console.log(
      `[FIXED] event started id=fixed-${eventNumber} sequence=${eventNumber} ${describeContext(tenantId, filterId)} apiCount=${demoApis.length} at=${now()}`
    );

    setLoading(true);
    setError(null);
    setResponses({});

    demoApis.forEach((apiConfig) => {
      const requestId = `fixed-${eventNumber}-${apiConfig.name}`;

      console.log(
        `[FIXED] request started api=${apiConfig.name} speed=${apiConfig.speed} id=${requestId} sequence=${eventNumber} ${describeContext(tenantId, filterId)} at=${now()}`
      );

      getDemoApi(apiConfig.name, {
        tenantId,
        filterId,
        requestId,
        signal: controller.signal
      })
        .then((data) => {
          const isLatest = latestRequestRef.current === eventNumber;

          console.log(
            `[FIXED] request completed api=${apiConfig.name} id=${requestId} sequence=${eventNumber} latest=${latestRequestRef.current} responseTenant=${data.tenant_id} responseFilter=${data.filter_id} at=${now()}`
          );

          if (!isLatest) {
            console.warn(
              `[FIXED] ignored stale ${apiConfig.name} response id=${requestId}; latest sequence is ${latestRequestRef.current}`
            );
            return;
          }

          console.log(`[FIXED] ${apiConfig.name} state updated by latest response id=${requestId}`);
          setResponses(mergeResponse(data));
        })
        .catch((error: unknown) => {
          if (isCanceledRequest(error)) {
            console.warn(`[FIXED] request canceled api=${apiConfig.name} id=${requestId} at=${now()}`);
            return;
          }

          if (latestRequestRef.current === eventNumber) {
            console.error(`[FIXED] request failed api=${apiConfig.name} id=${requestId}`, error);
            setError("Request failed. Is the Django API running on port 8009?");
          }
        })
        .finally(() => {
          pending -= 1;
          if (pending === 0 && latestRequestRef.current === eventNumber) {
            setLoading(false);
          }
        });
    });

    return () => {
      console.warn(
        `[FIXED] cleanup aborting event=fixed-${eventNumber} ${describeContext(tenantId, filterId)} at=${now()}`
      );
      controller.abort();
    };
  }, [tenantId, filterId, setError, setLatestRequestId, setLoading, setResponses]);
}

function WrongFindingsLoader() {
  useWrongFanOutFetch();
  return null;
}

function FixedFindingsLoader() {
  useFixedFanOutFetch();
  return null;
}

function isFindings(response: DemoApiResponse | undefined): response is FindingsResponse {
  return response?.api_name === "findings";
}

function isSummary(response: DemoApiResponse | undefined): response is SummaryResponse {
  return response?.api_name === "summary";
}

function isMetrics(response: DemoApiResponse | undefined): response is MetricsResponse {
  return response?.api_name === "metrics";
}

function isAssets(response: DemoApiResponse | undefined): response is AssetsResponse {
  return response?.api_name === "assets";
}

function isActivity(response: DemoApiResponse | undefined): response is ActivityResponse {
  return response?.api_name === "activity";
}

function ApiStatusCard({
  apiName,
  response
}: {
  apiName: ApiName;
  response: DemoApiResponse | undefined;
}) {
  const apiConfig = demoApis.find((item) => item.name === apiName)!;

  return (
    <article className={`api-card ${apiConfig.speed}`}>
      <div>
        <strong>{apiName}</strong>
        <span>{apiConfig.speed}</span>
      </div>
      {response ? (
        <p>
          {response.tenant_name} / {response.filter_label} / {response.delay_seconds.toFixed(1)}s
        </p>
      ) : (
        <p>Waiting for response</p>
      )}
    </article>
  );
}

export function App() {
  const [tenantId, setTenantId] = useAtom(selectedTenantAtom);
  const [filterId, setFilterId] = useAtom(selectedFilterAtom);
  const [mode, setMode] = useAtom(demoModeAtom);
  const responses = useAtomValue(apiResponsesAtom);
  const loading = useAtomValue(loadingAtom);
  const error = useAtomValue(errorAtom);
  const setResponses = useSetAtom(apiResponsesAtom);

  const findings = isFindings(responses.findings) ? responses.findings : null;
  const summary = isSummary(responses.summary) ? responses.summary : null;
  const metrics = isMetrics(responses.metrics) ? responses.metrics : null;
  const assets = isAssets(responses.assets) ? responses.assets : null;
  const activity = isActivity(responses.activity) ? responses.activity : null;

  function switchMode(nextMode: DemoMode) {
    setMode(nextMode);
    setResponses({});
  }

  return (
    <main className="app-shell">
      {mode === "wrong" ? <WrongFindingsLoader /> : <FixedFindingsLoader />}

      <section className="toolbar">
        <div>
          <p className="eyebrow">Race condition demo</p>
          <h1>Findings</h1>
        </div>

        <div className="mode-toggle" aria-label="Demo mode">
          <button
            className={mode === "wrong" ? "active danger" : ""}
            onClick={() => switchMode("wrong")}
            type="button"
          >
            Wrong
          </button>
          <button
            className={mode === "fixed" ? "active safe" : ""}
            onClick={() => switchMode("fixed")}
            type="button"
          >
            Fixed
          </button>
        </div>
      </section>

      <section className="controls">
        <label>
          Tenant
          <select value={tenantId} onChange={(event) => setTenantId(event.target.value as TenantId)}>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.label} - {tenant.hint}
              </option>
            ))}
          </select>
        </label>

        <div className="filter-group">
          <span>Filters</span>
          <div className="filter-buttons">
            {filters.map((filter) => (
              <button
                className={filterId === filter.id ? "active" : ""}
                key={filter.id}
                onClick={() => setFilterId(filter.id)}
                type="button"
                title={filter.hint}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`status-strip ${mode}`}>
        <strong>{mode === "wrong" ? "Wrong behavior" : "Fixed behavior"}</strong>
        <span>
          {mode === "wrong"
            ? "Each tenant/filter change fires 5 API calls. Any old response can overwrite its slice of state."
            : "All old calls are aborted, and each response must match the latest event sequence before updating state."}
        </span>
      </section>

      <section className="api-grid" aria-label="API request status">
        {demoApis.map((apiConfig) => (
          <ApiStatusCard
            apiName={apiConfig.name}
            key={apiConfig.name}
            response={responses[apiConfig.name]}
          />
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Summary</h2>
          {summary ? (
            <div className="stat-row">
              <span>Total {summary.summary.total}</span>
              <span>Critical {summary.summary.by_severity.critical}</span>
              <span>Open {summary.summary.by_status.open}</span>
            </div>
          ) : (
            <p className="muted">Waiting for summary API.</p>
          )}
        </article>

        <article className="panel">
          <h2>Metrics</h2>
          {metrics ? (
            <div className="stat-row">
              <span>Risk {metrics.metrics.risk_score}</span>
              <span>Open {metrics.metrics.open_count}</span>
              <span>Critical {metrics.metrics.critical_count}</span>
            </div>
          ) : (
            <p className="muted">Waiting for metrics API.</p>
          )}
        </article>

        <article className="panel">
          <h2>Assets</h2>
          {assets ? (
            <ul className="compact-list">
              {assets.assets.slice(0, 4).map((asset) => (
                <li key={asset.asset}>
                  <span>{asset.asset}</span>
                  <strong>{asset.finding_count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Waiting for assets API.</p>
          )}
        </article>

        <article className="panel">
          <h2>Activity</h2>
          {activity ? (
            <ul className="compact-list">
              {activity.activity.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <span>{item.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Waiting for activity API.</p>
          )}
        </article>
      </section>

      <section className="table-panel">
        <div className="table-header">
          <div>
            <h2>Findings table</h2>
            <p>
              Selected: <strong>{tenantId}</strong> / <strong>{filterId}</strong>
            </p>
          </div>
          <div className="request-meta">
            {loading && <span className="loading">Loading...</span>}
            {findings && (
              <span>
                Showing {findings.count} from {findings.tenant_name} / {findings.filter_label}
              </span>
            )}
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Asset</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Tenant</th>
              </tr>
            </thead>
            <tbody>
              {findings?.findings.slice(0, 25).map((finding) => (
                <tr key={finding.id}>
                  <td>{finding.id}</td>
                  <td>{finding.title}</td>
                  <td>{finding.asset}</td>
                  <td>
                    <span className={`severity ${finding.severity}`}>{finding.severity}</span>
                  </td>
                  <td>{finding.status}</td>
                  <td>{finding.tenant_name}</td>
                </tr>
              ))}
              {!findings && (
                <tr>
                  <td colSpan={6} className="empty">
                    No findings loaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
