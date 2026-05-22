from __future__ import annotations

import time
from datetime import datetime, timezone

from rest_framework.response import Response
from rest_framework.views import APIView

from .mock_data import (
    API_PROFILES,
    FILTER_LABELS,
    TENANTS,
    build_activity,
    build_assets,
    build_findings,
    build_metrics,
    build_summary,
)


class BaseDemoView(APIView):
    api_name = "unknown"
    response_key = "data"

    def get(self, request):
        tenant_id = request.query_params.get("tenant_id", "tenant-a")
        filter_id = request.query_params.get("filter", "all")
        request_id = request.query_params.get("request_id", "unknown")
        started_at = datetime.now(timezone.utc)
        delay_seconds = self._delay_for(filter_id)

        print(
            "[backend] request started "
            f"api={self.api_name} request_id={request_id} tenant={tenant_id} filter={filter_id} "
            f"delay={delay_seconds:.2f}s at={started_at.isoformat()}"
        )

        time.sleep(delay_seconds)

        payload = self.build_payload(tenant_id, filter_id)
        completed_at = datetime.now(timezone.utc)
        count = len(payload) if isinstance(payload, list) else payload.get("total", 1)

        print(
            "[backend] request completed "
            f"api={self.api_name} request_id={request_id} tenant={tenant_id} filter={filter_id} "
            f"count={count} at={completed_at.isoformat()}"
        )

        return Response(
            {
                "api_name": self.api_name,
                "api_label": API_PROFILES[self.api_name]["label"],
                "response_key": self.response_key,
                "request_id": request_id,
                "tenant_id": tenant_id,
                "tenant_name": TENANTS.get(tenant_id, TENANTS["tenant-a"]).name,
                "filter_id": filter_id,
                "filter_label": FILTER_LABELS.get(filter_id, FILTER_LABELS["all"]),
                "delay_seconds": delay_seconds,
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "count": count,
                self.response_key: payload,
            }
        )

    def build_payload(self, tenant_id: str, filter_id: str):
        raise NotImplementedError

    def _delay_for(self, filter_id: str) -> float:
        speed = API_PROFILES[self.api_name]["speed"]

        if speed == "quick":
            return 1.0 if filter_id != "filter-1" else 1.4

        if filter_id == "filter-2":
            return 1.0

        return 6.0


class FindingsView(BaseDemoView):
    api_name = "findings"
    response_key = "findings"

    def build_payload(self, tenant_id: str, filter_id: str):
        return build_findings(tenant_id, filter_id)


class SummaryView(BaseDemoView):
    api_name = "summary"
    response_key = "summary"

    def build_payload(self, tenant_id: str, filter_id: str):
        return build_summary(tenant_id, filter_id)


class MetricsView(BaseDemoView):
    api_name = "metrics"
    response_key = "metrics"

    def build_payload(self, tenant_id: str, filter_id: str):
        return build_metrics(tenant_id, filter_id)


class AssetsView(BaseDemoView):
    api_name = "assets"
    response_key = "assets"

    def build_payload(self, tenant_id: str, filter_id: str):
        return build_assets(tenant_id, filter_id)


class ActivityView(BaseDemoView):
    api_name = "activity"
    response_key = "activity"

    def build_payload(self, tenant_id: str, filter_id: str):
        return build_activity(tenant_id, filter_id)
