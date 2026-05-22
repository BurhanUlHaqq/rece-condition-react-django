import { atom } from "jotai";

import type { ApiResponses, DemoMode, FilterId, TenantId } from "../types";

export const selectedTenantAtom = atom<TenantId>("tenant-a");
export const selectedFilterAtom = atom<FilterId>("all");
export const apiResponsesAtom = atom<ApiResponses>({});
export const loadingAtom = atom(false);
export const errorAtom = atom<string | null>(null);
export const demoModeAtom = atom<DemoMode>("wrong");
export const latestRequestIdAtom = atom(0);
