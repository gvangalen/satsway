export type GridSandboxLink = {
  id: string;
  amount_usd: number;
  lightning_address: string;
  owner_name: string | null;
  payer_name: string | null;
  fiat_status: string;
  sats_status: string;
  quote_sats: number | null;
  last_error: string | null;
};

export type SavedGridLink = {
  baseUrl: string;
  link: GridSandboxLink;
};

const sandboxPath = "/api/sandbox/grid-links";

export function normalizeDemoUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Vul het HTTPS-adres van de Satsway-demo in.");
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password) {
    throw new Error("Gebruik een HTTPS-adres; lokaal testen mag via localhost.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Gebruik alleen het basisadres, zonder pad of betaallink.");
  }
  return url.origin;
}

export function gridPayUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/pay/grid/${encodeURIComponent(id)}`;
}

async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    let detail = fallback;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Preserve the useful fallback for non-JSON proxy or tunnel errors.
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return { "ngrok-skip-browser-warning": "true", ...extra };
}

export async function loginAsNoor(baseUrl: string, accessCode: string): Promise<{ access_token: string; expires_at: string }> {
  const login = await fetch(`${baseUrl}${sandboxPath}/test-login/noor`, {
    method: "POST",
    headers: headers(accessCode ? { "X-Satsway-Demo-Code": accessCode } : undefined),
  });
  return readResponse<{ access_token: string; expires_at: string }>(login, "Inloggen als Noor is mislukt.");
}

export async function fetchNoorGridSandboxLinks(baseUrl: string, token: string): Promise<GridSandboxLink[]> {
  const response = await fetch(`${baseUrl}${sandboxPath}/mine`, {
    headers: headers({ Authorization: `Bearer ${token}` }),
  });
  return readResponse<GridSandboxLink[]>(response, "Noors testlinks konden niet worden geladen.");
}

export async function createGridSandboxLink(
  baseUrl: string,
  token: string,
  amountUsd: string,
  lightningAddress: string,
): Promise<GridSandboxLink> {
  const availability = await fetch(`${baseUrl}${sandboxPath}/availability`, { headers: headers() });
  await readResponse<{ enabled: boolean }>(availability, "De Grid-demo is op dit adres niet beschikbaar.");

  const response = await fetch(`${baseUrl}${sandboxPath}`, {
    method: "POST",
    headers: headers({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    body: JSON.stringify({ amount_usd: amountUsd, lightning_address: lightningAddress }),
  });
  return readResponse<GridSandboxLink>(response, "Het testverzoek kon niet worden gemaakt.");
}

export async function fetchGridSandboxStatus(baseUrl: string, id: string): Promise<GridSandboxLink> {
  const response = await fetch(`${baseUrl}${sandboxPath}/${encodeURIComponent(id)}/status`, {
    headers: headers(),
  });
  return readResponse<GridSandboxLink>(response, "De status kon niet worden opgehaald.");
}
