import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEY } from "../config";
import type { SplitRequest } from "../types";

export async function loadStoredRequests() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Partial<SplitRequest>[]) : [];
    return parsed.map((request) => ({
      id: request.id ?? "",
      amount: request.amount ?? 0,
      settlementCurrency: request.settlementCurrency ?? "EUR",
      description: request.description ?? "Satsway verzoek",
      participants: request.participants ?? request.shares?.length ?? 1,
      splitMode: request.splitMode ?? "even",
      status: request.status ?? "pending",
      checkoutUrl: request.checkoutUrl,
      createdAt: request.createdAt ?? new Date().toISOString(),
      poster: request.poster ?? null,
      paidCount: request.paidCount ?? request.shares?.filter((share) => share.status === "paid").length ?? 0,
      shares: request.shares ?? [],
    })) as SplitRequest[];
  } catch {
    return [];
  }
}

export async function saveStoredRequests(requests: SplitRequest[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}
