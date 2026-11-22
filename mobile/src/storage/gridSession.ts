import * as SecureStore from "expo-secure-store";

const sessionKey = "satsway.grid.sandbox.noor.session";

export type GridSession = { baseUrl: string; token: string; expiresAt: string };

export async function loadGridSession(baseUrl: string): Promise<GridSession | null> {
  const stored = await SecureStore.getItemAsync(sessionKey);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored) as GridSession;
    if (session.baseUrl === baseUrl && Date.parse(session.expiresAt) > Date.now() + 60_000) return session;
  } catch {
    // Discard an invalid or outdated local session.
  }
  await SecureStore.deleteItemAsync(sessionKey);
  return null;
}

export async function saveGridSession(session: GridSession): Promise<void> {
  await SecureStore.setItemAsync(sessionKey, JSON.stringify(session));
}

export async function clearGridSession(): Promise<void> {
  await SecureStore.deleteItemAsync(sessionKey);
}
