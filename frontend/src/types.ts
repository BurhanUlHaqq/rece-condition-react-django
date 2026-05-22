export type TenantId = "tenant-a" | "tenant-b";
export type FilterId = "all" | "filter-1" | "filter-2";
export type DemoMode = "wrong" | "fixed";
export type ApiName = "findings" | "summary" | "metrics" | "assets" | "activity";

export interface Finding {
  id: string;
  title: string;
  asset: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "triaged" | "resolved";
  tenant_id: TenantId;
  tenant_name: string;
  filter_id: FilterId;
}

export interface Summary {
  total: number;
  by_severity: Record<Finding["severity"], number>;
  by_status: Record<Finding["status"], number>;
}

export interface Metrics {
  risk_score: number;
  open_count: number;
  critical_count: number;
}

export interface AssetSummary {
  asset: string;
  finding_count: number;
}

export interface ActivityItem {
  id: string;
  message: string;
  severity: Finding["severity"];
  tenant_id: TenantId;
  filter_id: FilterId;
}

export interface BaseApiResponse {
  api_name: ApiName;
  api_label: string;
  response_key: string;
  request_id: string;
  tenant_id: TenantId;
  tenant_name: string;
  filter_id: FilterId;
  filter_label: string;
  delay_seconds: number;
  started_at: string;
  completed_at: string;
  count: number;
}

export interface FindingsResponse extends BaseApiResponse {
  api_name: "findings";
  findings: Finding[];
}

export interface SummaryResponse extends BaseApiResponse {
  api_name: "summary";
  summary: Summary;
}

export interface MetricsResponse extends BaseApiResponse {
  api_name: "metrics";
  metrics: Metrics;
}

export interface AssetsResponse extends BaseApiResponse {
  api_name: "assets";
  assets: AssetSummary[];
}

export interface ActivityResponse extends BaseApiResponse {
  api_name: "activity";
  activity: ActivityItem[];
}

export type DemoApiResponse =
  | FindingsResponse
  | SummaryResponse
  | MetricsResponse
  | AssetsResponse
  | ActivityResponse;

export type ApiResponses = Partial<Record<ApiName, DemoApiResponse>>;

export interface FindingsParams {
  tenantId: TenantId;
  filterId: FilterId;
  requestId: string;
  signal?: AbortSignal;
}
