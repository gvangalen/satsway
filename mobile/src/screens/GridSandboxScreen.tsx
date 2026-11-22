import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { AppState, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

import {
  createGridSandboxLink,
  fetchGridSandboxStatus,
  fetchNoorGridSandboxLinks,
  gridPayUrl,
  loginAsNoor,
  normalizeDemoUrl,
  type SavedGridLink,
} from "../api/gridSandbox";
import { BackHeader, PrimaryButton, SecondaryButton } from "../components/AppChrome";
import { clearGridSession, loadGridSession, saveGridSession } from "../storage/gridSession";

const urlStorageKey = "satsway.mobile.grid.demo-url";
const linksStorageKey = "satsway.mobile.grid.links";
const defaultDemoUrl = process.env.EXPO_PUBLIC_SATSWAY_DEMO_URL ?? "";
const featuredDemoLinkId = process.env.EXPO_PUBLIC_SATSWAY_DEMO_LINK_ID ?? "";
const exampleAddress = "recipient@example.com";

function fiatLabel(status: string): string {
  if (status === "simulated_received") return "Testdollars ontvangen";
  if (status === "not_paid") return "Nog niet betaald";
  if (status === "funding") return "Testbetaling wordt verwerkt";
  if (status === "needs_review") return "Handmatige controle nodig";
  return status;
}

function satsLabel(status: string): string {
  if (status === "completed") return "Afgerond in Grid-sandbox";
  if (status === "not_sent") return "Nog niet verzonden";
  if (status === "processing") return "Uitbetaling wordt verwerkt";
  if (status === "failed") return "Testuitbetaling mislukt";
  return status;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "USD" }).format(amount);
}

export function GridSandboxScreen({ onBack }: { onBack: () => void }) {
  const isFocused = useIsFocused();
  const [demoUrl, setDemoUrl] = useState(defaultDemoUrl);
  const [accessCode, setAccessCode] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [amount, setAmount] = useState("18,50");
  const [lightningAddress, setLightningAddress] = useState(exampleAddress);
  const [links, setLinks] = useState<SavedGridLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [actionError, setActionError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(urlStorageKey), AsyncStorage.getItem(linksStorageKey)])
      .then(async ([storedUrl, storedLinks]) => {
        if (!active) return;
        const activeUrl = storedUrl || defaultDemoUrl;
        if (storedUrl) setDemoUrl(storedUrl);
        let savedLinks: SavedGridLink[] = [];
        if (storedLinks) {
          const parsed: unknown = JSON.parse(storedLinks);
          if (Array.isArray(parsed)) {
            savedLinks = parsed.filter((item): item is SavedGridLink =>
              typeof item?.baseUrl === "string" && typeof item?.link?.id === "string"
            ).slice(0, 20);
          }
        }
        if (defaultDemoUrl && featuredDemoLinkId) {
          try {
            const featured = await fetchGridSandboxStatus(defaultDemoUrl, featuredDemoLinkId);
            savedLinks = savedLinks.some((item) => item.baseUrl === defaultDemoUrl && item.link.id === featuredDemoLinkId)
              ? savedLinks.map((item) => item.baseUrl === defaultDemoUrl && item.link.id === featuredDemoLinkId
                ? { baseUrl: defaultDemoUrl, link: featured } : item)
              : [...savedLinks, { baseUrl: defaultDemoUrl, link: featured }].slice(0, 20);
            await AsyncStorage.setItem(linksStorageKey, JSON.stringify(savedLinks));
          } catch {
            // Existing saved links remain available when the public demo is offline.
          }
        }
        if (activeUrl) {
          const session = await loadGridSession(activeUrl);
          if (session) {
            setSessionReady(true);
            try {
              const remote = await fetchNoorGridSandboxLinks(activeUrl, session.token);
              const remoteIds = new Set(remote.map((link) => link.id));
              savedLinks = [
                ...remote.map((link) => ({ baseUrl: activeUrl, link })),
                ...savedLinks.filter((item) => item.baseUrl !== activeUrl || !remoteIds.has(item.link.id)),
              ].slice(0, 20);
              await AsyncStorage.setItem(linksStorageKey, JSON.stringify(savedLinks));
            } catch {
              if (active) setStatusError("Noors testlinks konden niet worden ververst.");
            }
          }
        }
        if (active) setLinks(savedLinks);
      })
      .catch(() => { if (active) setStatusError("Eerder gemaakte testlinks konden niet worden geladen."); });
    return () => { active = false; };
  }, []);

  const linkKeys = links.map((item) => `${item.baseUrl}/${item.link.id}`).join("|");
  useEffect(() => {
    if (!isFocused || !links.length) return;
    let active = true;
    const trackedLinks = links;
    const refresh = async () => {
      const results = await Promise.allSettled(
        trackedLinks.map((item) => fetchGridSandboxStatus(item.baseUrl, item.link.id)),
      );
      if (!active) return;
      setLinks((current) => current.map((item) => {
        const index = trackedLinks.findIndex(
          (tracked) => tracked.baseUrl === item.baseUrl && tracked.link.id === item.link.id,
        );
        const result = results[index];
        return result?.status === "fulfilled" ? { ...item, link: result.value } : item;
      }));
      setStatusError(results.some((result) => result.status === "rejected")
        ? "Een teststatus is tijdelijk niet bereikbaar. Probeer het opnieuw."
        : "");
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 4000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [isFocused, linkKeys]);

  async function sessionToken(baseUrl: string): Promise<string> {
    const existing = await loadGridSession(baseUrl);
    if (existing) return existing.token;
    if (!accessCode.trim()) throw new Error("Vul de demo-toegangscode eenmalig in om als Noor te starten.");
    const login = await loginAsNoor(baseUrl, accessCode.trim());
    await saveGridSession({ baseUrl, token: login.access_token, expiresAt: login.expires_at });
    setSessionReady(true);
    setAccessCode("");
    return login.access_token;
  }

  async function createLink() {
    setError("");
    setActionError("");
    let baseUrl: string;
    try {
      baseUrl = normalizeDemoUrl(demoUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ongeldig demo-adres.");
      return;
    }
    const amountText = amount.trim();
    const numericAmount = Number(amountText.replace(",", "."));
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(amountText) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Vul een bedrag in dollars met maximaal twee decimalen in.");
      return;
    }
    const address = lightningAddress.trim();
    if (!/^[^\s@]+@[^\s@]+$/.test(address)) {
      setError("Vul een Lightning-adres in, bijvoorbeeld naam@wallet.example.");
      return;
    }

    setBusy(true);
    try {
      const token = await sessionToken(baseUrl);
      const link = await createGridSandboxLink(baseUrl, token, numericAmount.toFixed(2), address);
      const next = [{ baseUrl, link }, ...links.filter((item) => item.link.id !== link.id)].slice(0, 20);
      setDemoUrl(baseUrl);
      setLinks(next);
      try {
        await Promise.all([
          AsyncStorage.setItem(urlStorageKey, baseUrl),
          AsyncStorage.setItem(linksStorageKey, JSON.stringify(next)),
        ]);
      } catch {
        setActionError("De testlink is gemaakt, maar kon niet lokaal worden opgeslagen. Deel hem nu voordat je de app sluit.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Het testverzoek kon niet worden gemaakt.");
    } finally {
      setBusy(false);
    }
  }

  async function loadNoorLinks() {
    setError("");
    setActionError("");
    let baseUrl: string;
    try {
      baseUrl = normalizeDemoUrl(demoUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ongeldig demo-adres.");
      return;
    }
    setBusy(true);
    try {
      const token = await sessionToken(baseUrl);
      const remote = await fetchNoorGridSandboxLinks(baseUrl, token);
      const next = [
        ...remote.map((link) => ({ baseUrl, link })),
        ...links.filter((item) => item.baseUrl !== baseUrl),
      ].slice(0, 20);
      setDemoUrl(baseUrl);
      setLinks(next);
      try {
        await Promise.all([
          AsyncStorage.setItem(urlStorageKey, baseUrl),
          AsyncStorage.setItem(linksStorageKey, JSON.stringify(next)),
        ]);
      } catch {
        setActionError("Noors links zijn geladen, maar konden niet op dit toestel worden bewaard.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Noors testlinks konden niet worden geladen.");
    } finally {
      setBusy(false);
    }
  }

  async function shareLink(item: SavedGridLink) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(item.baseUrl)) {
      setActionError("Een lokaal adres werkt niet op Sams telefoon. Gebruik een publieke HTTPS-demo.");
      return;
    }
    const url = gridPayUrl(item.baseUrl, item.link.id);
    try {
      setActionError("");
      await Share.share({ message: `Satsway-testverzoek van ${formatUsd(item.link.amount_usd)}. Open de betaallink: ${url}` });
    } catch {
      setActionError("Delen lukte niet. Kopieer de betaallink.");
    }
  }

  async function copyLink(item: SavedGridLink) {
    try {
      await Clipboard.setStringAsync(gridPayUrl(item.baseUrl, item.link.id));
      setCopiedId(item.link.id);
    } catch {
      setActionError("Kopiëren lukte niet.");
    }
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <BackHeader kicker="Grid sandbox" title="Testverzoek in sats" onBack={onBack} />
      <View style={ui.hero}>
        <Text style={ui.heroKicker}>EEN WERKENDE TESTLINK</Text>
        <Text style={ui.heroTitle}>Stuur dollars.{"\n"}Test sats.</Text>
        <Text style={ui.heroText}>Noor maakt de link in de app. Sam opent hem via chat en simuleert een betaling in de browser.</Text>
      </View>

      <View style={ui.card}>
        <Text style={ui.cardTitle}>Maak een testverzoek</Text>
        <Text style={ui.label}>HTTPS-adres van de gedeelde demo</Text>
        <TextInput value={demoUrl} onChangeText={(value) => { setDemoUrl(value); setSessionReady(false); }} style={ui.input} placeholder="https://jouw-demo.ngrok-free.app" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Text style={ui.helper}>Gebruik het publieke demo-adres zodat Sam de link op zijn telefoon kan openen.</Text>
        {sessionReady ? (
          <View style={ui.row}>
            <Text style={ui.helper}>Ingelogd als Noor op dit toestel</Text>
            <Pressable onPress={() => { void clearGridSession().then(() => setSessionReady(false)); }}><Text style={ui.linkText}>Wissel</Text></Pressable>
          </View>
        ) : (
          <>
            <Text style={ui.label}>Eenmalige demo-toegangscode</Text>
            <TextInput value={accessCode} onChangeText={setAccessCode} style={ui.input} placeholder="Toegangscode" secureTextEntry autoCapitalize="none" autoCorrect={false} />
          </>
        )}
        <Text style={ui.label}>Bedrag in testdollars</Text>
        <TextInput value={amount} onChangeText={setAmount} style={ui.input} keyboardType="decimal-pad" placeholder="18,50" />
        <Text style={ui.label}>Lightning-adres van Noor</Text>
        <TextInput value={lightningAddress} onChangeText={setLightningAddress} style={ui.input} autoCapitalize="none" autoCorrect={false} placeholder="naam@wallet.example" />
        <Text style={ui.helper}>Het voorbeeldadres ontvangt geen echte sats. Grid verwerkt deze betaling alleen in de sandbox.</Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}
        <PrimaryButton label={busy ? "Bezig…" : "Maak testlink als Noor"} onPress={() => { void createLink(); }} disabled={busy} />
        <Text style={ui.helper}>Noors links verschijnen na aanmelden automatisch, ook als ze op een ander toestel zijn gemaakt.</Text>
        <SecondaryButton label="Laad Noors testlinks" onPress={() => { void loadNoorLinks(); }} disabled={busy} />
      </View>

      <Text style={ui.sectionTitle}>Jouw testlinks</Text>
      {links.length === 0 ? <Text style={ui.empty}>Nog geen testlinks zichtbaar. Maak er een of laad Noors testlinks.</Text> : null}
      {links.map((item) => {
        const url = gridPayUrl(item.baseUrl, item.link.id);
        return (
          <View key={`${item.baseUrl}/${item.link.id}`} style={ui.card}>
            <View style={ui.row}>
              <Text style={ui.amount}>{formatUsd(item.link.amount_usd)}</Text>
              <Text style={ui.pill}>USD → sats</Text>
            </View>
            <Text style={ui.meta}>Ontvanger: {item.link.owner_name ?? "Noor"} · {item.link.lightning_address}</Text>
            <Text style={ui.status}>Testdollars: {fiatLabel(item.link.fiat_status)}</Text>
            <Text style={ui.status}>Sats: {satsLabel(item.link.sats_status)}</Text>
            {item.link.quote_sats != null ? <Text style={ui.status}>Grid-quote: {item.link.quote_sats.toLocaleString("nl-NL")} sats</Text> : null}
            {item.link.payer_name ? <Text style={ui.status}>Testbetaler: {item.link.payer_name}</Text> : null}
            <Text selectable style={ui.url}>{url}</Text>
            <View style={ui.actions}>
              <Pressable style={ui.smallButton} onPress={() => { void copyLink(item); }}><Text style={ui.smallButtonText}>{copiedId === item.link.id ? "Gekopieerd" : "Kopieer"}</Text></Pressable>
              <Pressable style={ui.shareButton} onPress={() => { void shareLink(item); }}><Text style={ui.shareButtonText}>Deel via chat</Text></Pressable>
            </View>
            <SecondaryButton label="Open betaallink" onPress={() => { void Linking.openURL(url); }} />
          </View>
        );
      })}
      {statusError ? <Text style={ui.error}>{statusError}</Text> : null}
      {actionError ? <Text style={ui.error}>{actionError}</Text> : null}
      <Text style={ui.footer}>Een afgeronde sandboxstatus bewijst geen ontvangst in een echte Lightning-wallet.</Text>
    </ScrollView>
  );
}

const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff7ed" },
  content: { padding: 20, paddingBottom: 48, gap: 18 },
  hero: { backgroundColor: "#281b14", borderRadius: 30, padding: 24 },
  heroKicker: { color: "#ffbd6e", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  heroTitle: { color: "#fff", fontSize: 32, fontWeight: "900", lineHeight: 38, marginTop: 14 },
  heroText: { color: "#e7d6cb", fontSize: 14, lineHeight: 21, marginTop: 12 },
  card: { backgroundColor: "#fff", borderRadius: 26, padding: 20, gap: 12, borderWidth: 1, borderColor: "#f4e4d3" },
  cardTitle: { color: "#281b14", fontSize: 21, fontWeight: "900" },
  label: { color: "#593f2f", fontSize: 13, fontWeight: "800", marginTop: 4 },
  input: { backgroundColor: "#fffaf5", borderColor: "#ead7c4", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, color: "#281b14", fontSize: 15 },
  helper: { color: "#8b7466", fontSize: 12, lineHeight: 18 },
  linkText: { color: "#b66310", fontSize: 12, fontWeight: "800" },
  error: { color: "#a32420", fontSize: 13, fontWeight: "700" },
  sectionTitle: { color: "#281b14", fontSize: 21, fontWeight: "900", marginTop: 5 },
  empty: { color: "#8b7466", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  amount: { color: "#281b14", fontSize: 28, fontWeight: "900" },
  pill: { color: "#9a4e08", backgroundColor: "#fff0d8", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, fontSize: 11, fontWeight: "900" },
  meta: { color: "#8b7466", fontSize: 12, lineHeight: 18 },
  status: { color: "#281b14", fontSize: 14, fontWeight: "700" },
  url: { color: "#9a4e08", fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10 },
  smallButton: { flex: 1, borderRadius: 14, backgroundColor: "#281b14", paddingVertical: 12, alignItems: "center" },
  smallButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  shareButton: { flex: 1, borderRadius: 14, backgroundColor: "#f7931a", paddingVertical: 12, alignItems: "center" },
  shareButtonText: { color: "#281b14", fontSize: 13, fontWeight: "900" },
  footer: { color: "#8b7466", fontSize: 12, lineHeight: 18 },
});
