export type SplitRequest = {
  id: string;
  amount: number;
  settlementCurrency: Currency;
  lightningAddress?: string | null;
  description: string;
  participants: number;
  splitMode: "even" | "custom";
  status: "pending" | "paid" | "expired";
  checkoutUrl?: string;
  createdAt: string;
  poster?: Poster | null;
  paidCount: number;
  shares: PaymentShare[];
};

export type Currency = "EUR" | "USD" | "BTC";

export type PaymentShare = {
  id: string;
  request_id: string;
  position: number;
  amount_eur: number;
  status: "pending" | "paid" | "expired";
  paid_at: string | null;
  created_at: string;
};

export type Rates = {
  base: "EUR";
  btc_eur: number;
  usd_eur: number;
  source: string;
  updated_at: string;
};

export type Poster = {
  id: string;
  title: string;
  image_url: string;
  text: string;
  sponsor_name: string | null;
  sponsor_url: string | null;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
};

type BackendCreateResponse = {
  request_id: string;
  status: SplitRequest["status"];
  checkout_url: string;
};

type BackendRequest = {
  id: string;
  user_id?: string;
  amount_eur: number;
  settlement_currency?: Currency;
  lightning_address?: string | null;
  description: string | null;
  status: SplitRequest["status"];
  participant_count?: number;
  paid_count?: number;
  shares?: PaymentShare[];
  created_at: string;
  poster?: Poster | null;
};

export type PaymentSession = {
  request_id: string;
  share_id: string | null;
  status: SplitRequest["status"];
  provider: "stripe" | "river";
  payment_currency: Currency;
  settlement_currency: Currency;
  settlement_amount: number;
  payment_amount: number;
  exchange_rate: number;
  checkout_url: string | null;
  lightning_invoice: string | null;
  lightning_payment_hash: string | null;
  expires_at: string;
};

export type SatswayUser = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

export type AuthSession = {
  accessToken: string;
  expiresAt: string;
  user: SatswayUser;
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
export const DEMO_MODE = process.env.NEXT_PUBLIC_SATSWAY_DEMO_MODE === "true";
const STORAGE_KEY = "satsway.requests";
const AUTH_KEY = "satsway.auth";

export function formatEuro(amount: number) {
  return formatCurrency(amount, "EUR");
}

export function formatCurrency(amount: number, currency: Currency) {
  if (currency === "BTC") {
    return `${amount.toFixed(8)} BTC`;
  }

  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
  }).format(amount);
}

export function amountPerPerson(amount: number, participants: number) {
  return participants > 0 ? amount / participants : amount;
}

export function fallbackRates(): Rates {
  return {
    base: "EUR",
    btc_eur: 95000,
    usd_eur: 0.92,
    source: "Fallback",
    updated_at: new Date().toISOString(),
  };
}

export async function fetchRates() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rates`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return fallbackRates();
    }

    const data = await response.json();
    return {
      base: "EUR",
      btc_eur: Number(data.btc_eur),
      usd_eur: Number(data.usd_eur),
      source: data.source,
      updated_at: data.updated_at,
    } satisfies Rates;
  } catch {
    return fallbackRates();
  }
}

export function getStoredRequests() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedRequests = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as Array<SplitRequest & { settlementCurrency?: Currency }>;

    return storedRequests.map((request) => ({
      ...request,
      settlementCurrency: request.settlementCurrency ?? "EUR",
    }));
  } catch {
    return [];
  }
}

export function getStoredRequest(id: string) {
  return getStoredRequests().find((request) => request.id === id) ?? null;
}

export function saveStoredRequest(request: SplitRequest) {
  if (typeof window === "undefined") {
    return;
  }

  const requests = getStoredRequests().filter((item) => item.id !== request.id);
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([request, ...requests].slice(0, 8)),
  );
}

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const session = JSON.parse(window.localStorage.getItem(AUTH_KEY) ?? "null") as
      | AuthSession
      | null;

    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(AUTH_KEY);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_KEY);
}

export async function loginSandboxPersona(persona: "noor" | "sam", demoCode = ""): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/api/sandbox/grid-links/test-login/${persona}`, {
    method: "POST",
    headers: demoCode ? { "X-Satsway-Demo-Code": demoCode } : {},
  });
  if (!response.ok) {
    throw new Error(response.status === 403 ? "Vul de juiste toegangscode voor de demo in." : "De testgebruiker is niet beschikbaar.");
  }
  const data = (await response.json()) as {
    access_token: string;
    expires_at: string;
    user: SatswayUser;
  };
  const session = {
    accessToken: data.access_token,
    expiresAt: data.expires_at,
    user: data.user,
  };
  saveAuthSession(session);
  return session;
}

function authHeaders(): Record<string, string> {
  const session = getAuthSession();
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

function mapBackendRequest(
  data: BackendRequest,
  fallback?: Partial<SplitRequest>,
): SplitRequest {
  return {
    id: data.id,
    amount: Number(data.amount_eur) || fallback?.amount || 0,
    settlementCurrency: data.settlement_currency ?? fallback?.settlementCurrency ?? "EUR",
    lightningAddress: data.lightning_address ?? fallback?.lightningAddress ?? null,
    description: data.description ?? fallback?.description ?? "Satsway verzoek",
    participants: data.participant_count ?? fallback?.participants ?? 1,
    splitMode: fallback?.splitMode ?? "even",
    status: data.status,
    checkoutUrl: fallback?.checkoutUrl,
    createdAt: data.created_at ?? fallback?.createdAt ?? new Date().toISOString(),
    poster: data.poster ?? fallback?.poster ?? null,
    paidCount: data.paid_count ?? fallback?.paidCount ?? 0,
    shares: data.shares ?? fallback?.shares ?? [],
  };
}

async function fetchBackendRequest(id: string) {
  const publicResponse = await fetch(`${API_BASE_URL}/requests/${id}`, {
    cache: "no-store",
  });

  if (publicResponse.ok) {
    return (await publicResponse.json()) as BackendRequest;
  }

  const apiResponse = await fetch(`${API_BASE_URL}/api/requests/${id}`, {
    cache: "no-store",
  });

  if (!apiResponse.ok) {
    return null;
  }

  return (await apiResponse.json()) as BackendRequest;
}

export function buildShareUrl(id: string, shareId?: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/pay/${id}${shareId ? `?share=${shareId}` : ""}`;
}

export async function requestLoginCode(input: { email: string; name?: string }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/request-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Login code could not be requested");
  }
}

export async function verifyLoginCode(input: { email: string; code: string; name?: string }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Login code is invalid");
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_at: string;
    user: SatswayUser;
  };
  const session = {
    accessToken: data.access_token,
    expiresAt: data.expires_at,
    user: data.user,
  };
  saveAuthSession(session);

  return session;
}

export async function logout() {
  const session = getAuthSession();
  if (session) {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => undefined);
  }

  clearAuthSession();
}

export async function fetchCurrentUser() {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    clearAuthSession();
    return null;
  }

  return (await response.json()) as SatswayUser;
}

export async function fetchUserRequests() {
  const session = getAuthSession();
  if (!session) {
    return getStoredRequests();
  }

  const response = await fetch(`${API_BASE_URL}/api/requests`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    return getStoredRequests();
  }

  const backendRequests = (await response.json()) as BackendRequest[];
  const storedRequests = getStoredRequests();
  const requests = backendRequests.map((request) =>
    mapBackendRequest(
      request,
      storedRequests.find((stored) => stored.id === request.id),
    ),
  );

  requests.forEach(saveStoredRequest);
  return requests;
}

export async function getRandomPoster() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/posters/random`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Poster;
  } catch {
    return null;
  }
}

export async function createSplitRequest(input: {
  amount: number;
  settlementCurrency: Currency;
  lightningAddress?: string;
  description: string;
  participants: number;
  splitMode: SplitRequest["splitMode"];
  customAmounts?: number[];
}) {
  try {
    const session = getAuthSession();
    const endpoint = session ? `${API_BASE_URL}/api/requests` : `${API_BASE_URL}/requests`;
    const body: Record<string, unknown> = {
      amount_eur: input.amount,
      settlement_currency: input.settlementCurrency,
      lightning_address: input.settlementCurrency === "BTC" ? input.lightningAddress : null,
      participant_count: input.participants,
      description: input.description,
    };

    if (input.splitMode === "custom" && input.customAmounts?.length) {
      body.share_amounts_eur = input.customAmounts;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Backend unavailable");
    }

    const data = (await response.json()) as BackendCreateResponse | BackendRequest;
    if ("id" in data) {
      return mapBackendRequest(data, {
        amount: input.amount,
        settlementCurrency: input.settlementCurrency,
        lightningAddress: input.lightningAddress,
        description: input.description,
        participants: input.participants,
        splitMode: input.splitMode,
      });
    }

    return {
      id: data.request_id,
      amount: input.amount,
      settlementCurrency: input.settlementCurrency,
      lightningAddress: input.lightningAddress,
      description: input.description,
      participants: input.participants,
      splitMode: input.splitMode,
      status: data.status,
      checkoutUrl: data.checkout_url,
      createdAt: new Date().toISOString(),
      paidCount: 0,
      shares: [],
    } satisfies SplitRequest;
  } catch {
    if (input.settlementCurrency === "BTC") {
      throw new Error("A sats request requires the backend");
    }
    return {
      id: createClientId(),
      amount: input.amount,
      settlementCurrency: input.settlementCurrency,
      lightningAddress: input.lightningAddress,
      description: input.description,
      participants: input.participants,
      splitMode: input.splitMode,
      status: "pending",
      createdAt: new Date().toISOString(),
      paidCount: 0,
      shares: [],
    } satisfies SplitRequest;
  }
}

export async function createPaymentSession(
  requestId: string,
  paymentCurrency: Currency,
  shareId?: string,
) {
  const response = await fetch(`${API_BASE_URL}/requests/${requestId}/payment-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payment_currency: paymentCurrency,
      share_id: shareId,
    }),
  });

  if (!response.ok) {
    throw new Error("Payment session could not be created");
  }

  return (await response.json()) as PaymentSession;
}

export async function syncRequestStatus(request: SplitRequest) {
  try {
    const data = await fetchBackendRequest(request.id);

    if (!data) {
      return request;
    }

    const updatedRequest = mapBackendRequest(data, request);
    saveStoredRequest(updatedRequest);

    return updatedRequest;
  } catch {
    return request;
  }
}

export async function fetchRequestById(id: string) {
  const stored = getStoredRequest(id);
  try {
    const data = await fetchBackendRequest(id);

    if (!data) {
      return stored;
    }

    const request = mapBackendRequest(data, stored ?? undefined);
    saveStoredRequest(request);
    return request;
  } catch {
    return stored;
  }
}
