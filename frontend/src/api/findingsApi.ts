import axios from "axios";

import type { ApiName, DemoApiResponse, FindingsParams } from "../types";

const api = axios.create({
  baseURL: "http://127.0.0.1:8009/api"
});

export const demoApis: Array<{ name: ApiName; path: string; speed: "quick" | "slow" }> = [
  { name: "findings", path: "/findings/", speed: "slow" },
  { name: "summary", path: "/summary/", speed: "quick" },
  { name: "metrics", path: "/metrics/", speed: "quick" },
  { name: "assets", path: "/assets/", speed: "quick" },
  { name: "activity", path: "/activity/", speed: "slow" }
];

export async function getDemoApi(
  apiName: ApiName,
  params: FindingsParams
): Promise<DemoApiResponse> {
  const apiConfig = demoApis.find((item) => item.name === apiName);

  if (!apiConfig) {
    throw new Error(`Unknown demo API: ${apiName}`);
  }

  const response = await api.get<DemoApiResponse>(apiConfig.path, {
    params: {
      tenant_id: params.tenantId,
      filter: params.filterId,
      request_id: params.requestId
    },
    signal: params.signal
  });

  return response.data;
}

export function isCanceledRequest(error: unknown): boolean {
  return axios.isCancel(error) || (axios.isAxiosError(error) && error.code === "ERR_CANCELED");
}
