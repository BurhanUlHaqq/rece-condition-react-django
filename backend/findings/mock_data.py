from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Tenant:
    tenant_id: str
    name: str
    count: int


TENANTS = {
    "tenant-a": Tenant("tenant-a", "Tenant A", 140),
    "tenant-b": Tenant("tenant-b", "Tenant B", 12),
}

SEVERITIES = ["critical", "high", "medium", "low"]
STATUSES = ["open", "triaged", "resolved"]
FILTER_LABELS = {
    "all": "All findings",
    "filter-1": "Filter 1: slow critical/high scan",
    "filter-2": "Filter 2: fast open items",
}

API_PROFILES = {
    "findings": {
        "label": "Findings table",
        "speed": "slow",
    },
    "summary": {
        "label": "Summary counts",
        "speed": "quick",
    },
    "metrics": {
        "label": "Risk metrics",
        "speed": "quick",
    },
    "assets": {
        "label": "Affected assets",
        "speed": "quick",
    },
    "activity": {
        "label": "Recent activity",
        "speed": "slow",
    },
}


def build_findings(tenant_id: str, filter_id: str) -> list[dict]:
    tenant = TENANTS.get(tenant_id, TENANTS["tenant-a"])
    findings = []

    for index in range(tenant.count):
        severity = SEVERITIES[index % len(SEVERITIES)]
        status = STATUSES[index % len(STATUSES)]
        findings.append(
            {
                "id": f"{tenant.tenant_id}-{index + 1:03d}",
                "title": f"{tenant.name} finding {index + 1}",
                "asset": f"service-{(index % 9) + 1}.example.internal",
                "severity": severity,
                "status": status,
                "tenant_id": tenant.tenant_id,
                "tenant_name": tenant.name,
                "filter_id": filter_id,
            }
        )

    if filter_id == "filter-1":
        return [
            finding
            for finding in findings
            if finding["severity"] in {"critical", "high"}
        ]

    if filter_id == "filter-2":
        return [
            finding
            for finding in findings
            if finding["status"] == "open"
        ][:8]

    return findings


def build_summary(tenant_id: str, filter_id: str) -> dict:
    findings = build_findings(tenant_id, filter_id)
    by_severity = {severity: 0 for severity in SEVERITIES}
    by_status = {status: 0 for status in STATUSES}

    for finding in findings:
        by_severity[finding["severity"]] += 1
        by_status[finding["status"]] += 1

    return {
        "total": len(findings),
        "by_severity": by_severity,
        "by_status": by_status,
    }


def build_metrics(tenant_id: str, filter_id: str) -> dict:
    findings = build_findings(tenant_id, filter_id)
    severity_weights = {
        "critical": 10,
        "high": 7,
        "medium": 4,
        "low": 1,
    }
    total_weight = sum(severity_weights[finding["severity"]] for finding in findings)
    risk_score = round(total_weight / max(len(findings), 1), 2)

    return {
        "risk_score": risk_score,
        "open_count": sum(1 for finding in findings if finding["status"] == "open"),
        "critical_count": sum(1 for finding in findings if finding["severity"] == "critical"),
    }


def build_assets(tenant_id: str, filter_id: str) -> list[dict]:
    findings = build_findings(tenant_id, filter_id)
    grouped: dict[str, int] = {}

    for finding in findings:
        grouped[finding["asset"]] = grouped.get(finding["asset"], 0) + 1

    return [
        {
            "asset": asset,
            "finding_count": count,
        }
        for asset, count in sorted(grouped.items(), key=lambda item: item[1], reverse=True)[:8]
    ]


def build_activity(tenant_id: str, filter_id: str) -> list[dict]:
    findings = build_findings(tenant_id, filter_id)[:8]

    return [
        {
            "id": f"activity-{finding['id']}",
            "message": f"{finding['tenant_name']} updated {finding['title']}",
            "severity": finding["severity"],
            "tenant_id": finding["tenant_id"],
            "filter_id": finding["filter_id"],
        }
        for finding in findings
    ]
