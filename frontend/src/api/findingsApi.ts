import axios from "axios";

import type { ApiName, DemoApiResponse, FindingsParams } from "../types";

// Create an Axios instance with a base URL for the API endpoints
const api = axios.create({
  baseURL: "http://127.0.0.1:8009/api"
});

// Configuration for the available demo APIs, including their names, paths, and response speeds
export const demoApis: Array<{ name: ApiName; path: string; speed: "quick" | "slow" }> = [
  { name: "findings", path: "/findings/", speed: "slow" },
  { name: "summary", path: "/summary/", speed: "quick" },
  { name: "metrics", path: "/metrics/", speed: "quick" },
  { name: "assets", path: "/assets/", speed: "quick" },
  { name: "activity", path: "/activity/", speed: "slow" }
];

// Fetch data from the selected demo API with the given parameters
export async function getDemoApi(
  apiName: ApiName,
  params: FindingsParams
): Promise<DemoApiResponse> {
  // Find the API configuration based on the provided API name
  const apiConfig = demoApis.find((item) => item.name === apiName);

  if (!apiConfig) {
    throw new Error(`Unknown demo API: ${apiName}`);
  }
  // Make a GET request to the API endpoint with the specified parameters and return the response data
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

// Check if a request was canceled
// Axios provides a built-in method isCancel to check if an error was caused by a cancellation, and we also check for the specific error code "ERR_CANCELED" which is used by Axios to indicate a canceled request. This utility function allows us to easily identify canceled requests in our error handling logic, which is important for the fixed implementation of the fan-out fetch to prevent stale responses from updating state after the user has made a new selection.
export function isCanceledRequest(error: unknown): boolean {
  return axios.isCancel(error) || (axios.isAxiosError(error) && error.code === "ERR_CANCELED");
}
