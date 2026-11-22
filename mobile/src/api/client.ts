import { API_BASE_URL } from "../config";
import type { BackendRequest, Rates, SplitRequest } from "../types";

export function fallbackRates(): Rates {
  return {
    base: "EUR",
    btc_eur: 95000,
    usd_eur: 0.92,
    source: "Fallback",
    updated_at: new Date().toISOString(),
  };
}

export async function fetchRates(): Promise<Rates> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rates`);
    if (!response.ok) {
      return fallbackRates();
    }

    return (await response.json()) as Rates;
  } catch {
    return fallbackRates();
  }
}

export function mapBackendRequest(data: BackendRequest, fallback: SplitRequest): SplitRequest {
  const shares = data.shares ?? fallback.shares ?? [];
  return {
    ...fallback,
    amount: Number(data.amount_eur) || fallback.amount,
    settlementCurrency: data.settlement_currency ?? fallback.settlementCurrency,
    description: data.description ?? fallback.description,
    participants: data.participant_count ?? fallback.participants,
    status: data.status,
    createdAt: data.created_at ?? fallback.createdAt,
    poster: data.poster ?? fallback.poster ?? null,
    paidCount: data.paid_count ?? shares.filter((share) => share.status === "paid").length,
    shares,
  };
}
