import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type DimensionValue,
} from "react-native";

import { API_BASE_URL, AWARENESS_CONTENT_POOL, DEMO_POSTERS, FEATURE_FLAGS } from "../config";
import { fetchGridSandboxStatus, type GridSandboxLink } from "../api/gridSandbox";
import type { BtcQuote, Currency, PaymentShare, Rates, SplitRequest } from "../types";
import { formatCurrency, formatDisplayAmount } from "../utils/format";
import { buildAppPayLink, buildShareMessage, buildWebPayLink } from "../utils/links";
import { styles } from "../styles";
import { BackHeader, PosterSurface, PrimaryButton, QuickAction, SecondaryButton, Stat, StepperButton } from "../components/AppChrome";
import { BackgroundBrandingLayer, SponsorLabel } from "../components/AwarenessLayer";
import { AnalyticsChart } from "../components/AnalyticsChart";
import { EducationHint } from "../components/EducationHint";
import { getAwarenessContent } from "../utils/awareness";
import { clearAnalytics, flushAnalytics, getAnalyticsInsights, getBestPerformingItem } from "../utils/analytics";
import { runSimulation, type SimulationScenario } from "../utils/analyticsSimulation";

export function HomeScreen({
  openAmount,
  requests,
  onCreate,
  onGridSandbox,
  onScan,
  onOpenRequest,
}: {
  openAmount: number;
  requests: SplitRequest[];
  onCreate: () => void;
  onGridSandbox: () => void;
  onScan: () => void;
  onOpenRequest: (request: SplitRequest) => void;
}) {
  const awareness = getAwarenessContent("home");
  const sponsor = awareness?.type === "sponsor" ? awareness.sponsor : null;

  return (
    <View style={styles.homePosterPage}>
      <BackgroundBrandingLayer screen="home" />
      <ScrollView style={styles.homePosterScroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.homeKicker}>Goedemorgen</Text>
          <Text style={styles.homeTitle}>Satsway</Text>
        </View>
        <View style={styles.homeBitcoinBadge}>
          <Text style={styles.bitcoinBadgeText}>₿</Text>
        </View>
      </View>

      <View style={styles.homeBalanceCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.balanceLabel}>Openstaand</Text>
            <Text style={styles.balanceValue}>{formatCurrency(openAmount, "EUR")}</Text>
          </View>
          <View style={styles.livePill}>
            <Text style={styles.livePillText}>Live</Text>
          </View>
        </View>
        <View style={styles.balanceStats}>
          <Stat label="verzoeken" value={String(requests.length)} dark />
          <Stat label="betaald" value={String(requests.filter((item) => item.status === "paid").length)} dark />
          <Stat label="keuze" value="EUR/BTC" dark />
        </View>
      </View>
      <SponsorLabel id={awareness?.id} screen="home" sponsor={sponsor} variant={awareness?.variant} />

      <PrimaryButton label="Nieuwe split maken" onPress={onCreate} />
      <SecondaryButton label="Test USD → sats via Grid" onPress={onGridSandbox} />
      <GridDemoStatusCard onOpen={onGridSandbox} />

      <View style={styles.quickGrid}>
        <QuickAction label="Scan bon" icon="▣" onPress={onScan} variant="glass" />
        <QuickAction label="Bedrag" icon="€" onPress={onCreate} variant="glass" />
        <QuickAction label="Deel link" icon="↗" onPress={onCreate} variant="glass" />
      </View>
      <EducationHint screen="home" content={awareness} />

      <Text style={styles.homeSectionTitle}>Recent</Text>
      {requests.length === 0 ? (
        <View style={styles.homeEmptyCard}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyTitle}>Nog geen splits</Text>
          <Text style={styles.emptyText}>Maak je eerste betaalverzoek en test de flow direct op je iPhone simulator.</Text>
        </View>
      ) : (
        requests.map((request) => (
          <Pressable key={request.id} style={styles.listItem} onPress={() => onOpenRequest(request)}>
            <View style={styles.listText}>
              <Text style={styles.listTitle}>{request.description}</Text>
              <Text style={styles.listMeta}>{request.participants} personen · {request.status === "paid" ? "Betaald" : "Open"}</Text>
            </View>
            <Text style={styles.listAmount}>{formatCurrency(request.amount, request.settlementCurrency)}</Text>
          </Pressable>
        ))
      )}
      </ScrollView>
    </View>
  );
}

const featuredGridLinkId = process.env.EXPO_PUBLIC_SATSWAY_DEMO_LINK_ID ?? "";
const featuredGridBaseUrl = process.env.EXPO_PUBLIC_SATSWAY_DEMO_URL ?? "";

function GridDemoStatusCard({ onOpen }: { onOpen: () => void }) {
  const isFocused = useIsFocused();
  const [target, setTarget] = useState({ baseUrl: featuredGridBaseUrl, id: featuredGridLinkId });
  const [link, setLink] = useState<GridSandboxLink | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    AsyncStorage.getItem("satsway.mobile.grid.links").then((stored) => {
      if (!active) return;
      try {
        const links = stored ? JSON.parse(stored) as Array<{ baseUrl: string; link: { id: string } }> : [];
        const latest = links.find((item) => item?.baseUrl && item?.link?.id);
        if (latest) setTarget({ baseUrl: latest.baseUrl, id: latest.link.id });
      } catch {
        // Keep the configured demonstration link if local storage is invalid.
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused || !target.id || !target.baseUrl) return;
    let active = true;
    const refresh = async () => {
      try {
        const latest = await fetchGridSandboxStatus(target.baseUrl, target.id);
        if (active) { setLink(latest); setError(false); }
      } catch {
        if (active) setError(true);
      }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 4000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [isFocused, target.baseUrl, target.id]);

  if (!target.id || !target.baseUrl) return null;

  return (
    <Pressable style={styles.homeGridDemoCard} onPress={onOpen}>
      <Text style={styles.homeGridDemoKicker}>GRID-SANDBOX · DEMOBETALING</Text>
      <Text style={styles.homeGridDemoTitle}>{link ? `${link.owner_name ?? "Noor"} ← ${link.payer_name ?? "wacht op betaler"} · ${formatCurrency(link.amount_usd, "USD")}` : "Testbetaling laden…"}</Text>
      <Text style={styles.homeGridDemoDetail}>{error ? "Teststatus tijdelijk niet bereikbaar" : link ? `Testdollars: ${link.fiat_status === "simulated_received" ? "ontvangen" : "nog niet ontvangen"} · Sats: ${link.sats_status === "completed" ? "afgerond" : "in behandeling"}` : "Status ophalen"}</Text>
      {link?.quote_sats != null ? <Text style={styles.homeGridDemoDetail}>Grid-offerte: {link.quote_sats.toLocaleString("nl-NL")} sats</Text> : null}
      <Text style={styles.homeGridDemoFoot}>Alleen een simulatie. Tik voor de testlinks.</Text>
    </Pressable>
  );
}

export function RequestsScreen({
  requests,
  onOpenRequest,
  onCreate,
}: {
  requests: SplitRequest[];
  onOpenRequest: (request: SplitRequest) => void;
  onCreate: () => void;
}) {
  const awareness = getAwarenessContent("requests");

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, styles.createContent]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Ontvangen</Text>
          <Text style={styles.headerTitle}>Betaalverzoeken</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{requests.length}</Text>
        </View>
      </View>

      <EducationHint screen="requests" content={awareness} />

      {requests.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>＋</Text>
          <Text style={styles.emptyTitle}>Nog niets ontvangen</Text>
          <Text style={styles.emptyText}>Betaalverzoeken die iemand naar jou stuurt verschijnen hier.</Text>
          <PrimaryButton label="Zelf verzoek sturen" onPress={onCreate} />
        </View>
      ) : (
        requests.map((request) => (
          <Pressable key={request.id} style={styles.requestListItem} onPress={() => onOpenRequest(request)}>
            <View style={styles.rowBetween}>
              <View style={styles.listText}>
                <Text style={styles.listTitle}>{request.description}</Text>
                <Text style={styles.listMeta}>
                  {request.paidCount} van {request.shares.length || request.participants} betaald
                </Text>
              </View>
              <Text style={styles.listAmount}>{formatCurrency(request.amount, "EUR")}</Text>
            </View>
            <View style={styles.requestItemFooter}>
              <Text style={styles.requestId}>#{request.id.slice(0, 8)}</Text>
              <Text style={[styles.requestStatus, request.status === "paid" && styles.requestStatusDone]}>
                {request.status === "paid" ? "betaald" : "pending"}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

export function WalletScreen({ openAmount, requests }: { openAmount: number; requests: SplitRequest[] }) {
  const awareness = getAwarenessContent("wallet");
  const sponsor = awareness?.type === "sponsor" ? awareness.sponsor : null;
  const paidAmount = requests
    .filter((request) => request.status === "paid")
    .reduce((total, request) => total + request.amount, 0);

  return (
    <View style={styles.layeredScreen}>
      <BackgroundBrandingLayer screen="wallet" />
      <ScrollView
        style={styles.transparentScreen}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Wallet</Text>
          <Text style={styles.headerTitle}>Saldo</Text>
        </View>
        <View style={styles.bitcoinBadge}>
          <Text style={styles.bitcoinBadgeText}>₿</Text>
        </View>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Binnengekomen via Satsway</Text>
        <Text style={styles.balanceValue}>{formatCurrency(paidAmount, "EUR")}</Text>
        <Text style={styles.darkSubtext}>V1 demo · payout/wallet koppeling volgt later</Text>
      </View>
      <SponsorLabel id={awareness?.id} screen="wallet" sponsor={sponsor} variant={awareness?.variant} />
      <EducationHint screen="wallet" content={awareness} />

      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Vandaag</Text>
        <View style={styles.walletRow}>
          <Text style={styles.walletLabel}>Openstaand</Text>
          <Text style={styles.walletValue}>{formatCurrency(openAmount, "EUR")}</Text>
        </View>
        <View style={styles.walletRow}>
          <Text style={styles.walletLabel}>Betaalde requests</Text>
          <Text style={styles.walletValue}>{requests.filter((request) => request.status === "paid").length}</Text>
        </View>
        <View style={styles.walletRow}>
          <Text style={styles.walletLabel}>Betaalroutes</Text>
          <Text style={styles.walletValue}>EUR/BTC</Text>
        </View>
      </View>
      <AnalyticsDebugPanel />
      </ScrollView>
    </View>
  );
}

export function AnalyticsDebugPanel() {
  const [, setRefreshKey] = useState(0);

  if (!FEATURE_FLAGS.analyticsDebug) {
    return null;
  }

  const insights = getAnalyticsInsights();
  const bestItem = getBestPerformingItem(AWARENESS_CONTENT_POOL);
  const refresh = () => setRefreshKey((key) => key + 1);
  const simulate = (scenario: SimulationScenario) => {
    runSimulation(scenario);
    refresh();
  };
  const clear = () => {
    clearAnalytics();
    refresh();
  };

  return (
    <View style={styles.analyticsPanel}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.analyticsKicker}>Awareness analytics</Text>
          <Text style={styles.analyticsTitle}>Debug metrics</Text>
        </View>
        <Pressable style={styles.analyticsFlushButton} onPress={flushAnalytics}>
          <Text style={styles.analyticsFlushText}>Queue</Text>
        </Pressable>
      </View>

      <View style={styles.analyticsStats}>
        <View style={styles.analyticsStat}>
          <Text style={styles.analyticsStatValue}>{insights.views}</Text>
          <Text style={styles.analyticsStatLabel}>views</Text>
        </View>
        <View style={styles.analyticsStat}>
          <Text style={styles.analyticsStatValue}>{insights.interactions}</Text>
          <Text style={styles.analyticsStatLabel}>clicks</Text>
        </View>
        <View style={styles.analyticsStat}>
          <Text style={styles.analyticsStatValue}>{(insights.ctr * 100).toFixed(1)}%</Text>
          <Text style={styles.analyticsStatLabel}>CTR</Text>
        </View>
      </View>
      <Text style={styles.analyticsBestItem}>Best item: {bestItem?.id ?? "nog geen winnaar"}</Text>

      {FEATURE_FLAGS.simulationMode ? (
        <View style={styles.analyticsControls}>
          <Pressable style={styles.analyticsControlButton} onPress={() => simulate("high_engagement")}>
            <Text style={styles.analyticsControlText}>High</Text>
          </Pressable>
          <Pressable style={styles.analyticsControlButton} onPress={() => simulate("mixed")}>
            <Text style={styles.analyticsControlText}>Mixed</Text>
          </Pressable>
          <Pressable style={styles.analyticsControlButton} onPress={() => simulate("low_engagement")}>
            <Text style={styles.analyticsControlText}>Low</Text>
          </Pressable>
          <Pressable style={[styles.analyticsControlButton, styles.analyticsClearButton]} onPress={clear}>
            <Text style={styles.analyticsClearText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.analyticsSectionLabel}>Per scherm</Text>
      <AnalyticsChart data={insights.byScreen} />
      <Text style={styles.analyticsSectionLabel}>Per content</Text>
      <AnalyticsChart data={insights.byItem} />
    </View>
  );
}

export function CreateScreen({
  amount,
  description,
  participants,
  displayCurrency,
  rates,
  splitMode,
  customAmounts,
  isLoading,
  error,
  onBack,
  onAmountChange,
  onDescriptionChange,
  onParticipantsChange,
  onDisplayCurrencyChange,
  onSplitModeChange,
  onCustomAmountChange,
  onSubmit,
  onGridSandbox,
}: {
  amount: string;
  description: string;
  participants: number;
  displayCurrency: Currency;
  rates: Rates;
  splitMode: SplitRequest["splitMode"];
  customAmounts: string[];
  isLoading: boolean;
  error: string;
  onBack: () => void;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onParticipantsChange: (value: number) => void;
  onDisplayCurrencyChange: (value: Currency) => void;
  onSplitModeChange: (value: SplitRequest["splitMode"]) => void;
  onCustomAmountChange: (index: number, value: string) => void;
  onSubmit: () => void;
  onGridSandbox: () => void;
}) {
  const perPerson = useMemo(() => {
    const value = Number(amount.replace(",", "."));
    return value > 0 ? value / participants : 0;
  }, [amount, participants]);
  const numericAmount = Number(amount.replace(",", ".") || 0);
  const customTotal = customAmounts.reduce(
    (sum, customAmount) => sum + Number(customAmount.replace(",", ".") || 0),
    0,
  );
  const customDifference = Number((numericAmount - customTotal).toFixed(2));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <BackHeader kicker="Sturen" title="Betaalverzoek maken" onBack={onBack} />
      <PosterSurface poster={DEMO_POSTERS[0]} compact />
      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Bedrag</Text>
        <View style={styles.amountInputShell}>
          <Text style={styles.amountPrefix}>€</Text>
          <TextInput
            value={amount}
            onChangeText={onAmountChange}
            keyboardType="decimal-pad"
            placeholder="42,00"
            placeholderTextColor="#cbd5e1"
            style={styles.amountInput}
          />
        </View>

        <Text style={[styles.inputLabel, styles.inputSpacing]}>Toon waarde als</Text>
        <View style={styles.segment}>
          {(["EUR", "USD", "BTC"] as Currency[]).map((currency) => (
            <Pressable
              key={currency}
              style={[
                styles.segmentButton,
                displayCurrency === currency && styles.segmentButtonActive,
                displayCurrency === "BTC" && currency === "BTC" && styles.segmentButtonBitcoinActive,
              ]}
              onPress={() => onDisplayCurrencyChange(currency)}
            >
              <Text style={[styles.segmentText, displayCurrency === currency && styles.segmentTextActive]}>{currency}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>
          Je vult euro in. Satsway toont hoeveel USD of BTC dat ongeveer is.
        </Text>

        <Text style={[styles.inputLabel, styles.inputSpacing]}>Omschrijving</Text>
        <TextInput
          value={description}
          onChangeText={onDescriptionChange}
          placeholder="Lunch, huur, weekend weg"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
      </View>

      <View style={styles.formCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.inputLabel}>Deelnemers</Text>
            <Text style={styles.muted}>{formatDisplayAmount(perPerson, displayCurrency, rates)} per persoon</Text>
            {displayCurrency === "BTC" ? (
              <Text style={styles.smallMuted}>{formatCurrency(perPerson, "EUR")} per persoon</Text>
            ) : null}
          </View>
          <View style={styles.stepper}>
            <StepperButton label="−" onPress={() => onParticipantsChange(Math.max(1, participants - 1))} />
            <Text style={styles.stepperValue}>{participants}</Text>
            <StepperButton label="+" onPress={() => onParticipantsChange(participants + 1)} />
          </View>
        </View>

        <View style={styles.segmentLarge}>
          <Pressable
            style={[styles.segmentButtonLarge, splitMode === "even" && styles.segmentButtonActive]}
            onPress={() => onSplitModeChange("even")}
          >
            <Text style={[styles.segmentText, splitMode === "even" && styles.segmentTextActive]}>
              Gelijk verdelen
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentButtonLarge, splitMode === "custom" && styles.segmentButtonActive]}
            onPress={() => onSplitModeChange("custom")}
          >
            <Text style={[styles.segmentText, splitMode === "custom" && styles.segmentTextActive]}>
              Eigen bedragen
            </Text>
          </Pressable>
        </View>

        {splitMode === "custom" ? (
          <View style={styles.customAmounts}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel}>Per ontvanger</Text>
              <Text style={[styles.balanceHint, Math.abs(customDifference) <= 0.009 && styles.balanceHintOk]}>
                {Math.abs(customDifference) <= 0.009
                  ? "Klopt"
                  : `${formatCurrency(Math.abs(customDifference), "EUR")} ${
                      customDifference > 0 ? "over" : "te veel"
                    }`}
              </Text>
            </View>
            {customAmounts.map((customAmount, index) => (
              <View key={`custom-${index}`} style={styles.customAmountRow}>
                <Text style={styles.customAmountLabel}>Persoon {index + 1}</Text>
                <View style={styles.customAmountInputShell}>
                  <Text style={styles.customAmountPrefix}>€</Text>
                  <TextInput
                    value={customAmount}
                    onChangeText={(value) => onCustomAmountChange(index, value)}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor="#cbd5e1"
                    style={styles.customAmountInput}
                  />
                </View>
              </View>
            ))}
            <Text style={styles.smallMuted}>
              Totaal eigen bedragen: {formatCurrency(customTotal, "EUR")}
            </Text>
          </View>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton label={isLoading ? "Betaalverzoek maken..." : "Betaalverzoek maken"} onPress={onSubmit} disabled={isLoading} />
      <SecondaryButton label="Test USD → sats via Grid" onPress={onGridSandbox} />
    </ScrollView>
  );
}

export function RequestScreen({
  request,
  onBack,
  onPay,
  onSync,
}: {
  request: SplitRequest;
  onBack: () => void;
  onPay: () => void;
  onSync: () => void;
}) {
  const awareness = getAwarenessContent("request");
  const sponsor = awareness?.type === "sponsor" ? awareness.sponsor : null;
  const shares =
    request.shares.length > 0
      ? request.shares
      : [
          {
            id: request.id,
            request_id: request.id,
            position: 1,
            amount_eur: request.amount,
            status: request.status,
            paid_at: null,
            created_at: request.createdAt,
          },
        ];
  const paidCount = shares.filter((share) => share.status === "paid").length;
  const progressWidth = `${Math.max(4, (paidCount / shares.length) * 100)}%` as DimensionValue;

  async function copyLink(share?: PaymentShare) {
    await Clipboard.setStringAsync(buildShareMessage(request, share));
    Alert.alert("Gekopieerd", "De betaallink staat op je klembord.");
  }

  async function shareViaWhatsApp(share?: PaymentShare) {
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(buildShareMessage(request, share))}`;
    const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);

    if (canOpenWhatsApp) {
      await Linking.openURL(whatsappUrl);
      return;
    }

    await Clipboard.setStringAsync(buildShareMessage(request, share));
    Alert.alert("WhatsApp niet gevonden", "De betaallink is gekopieerd, zodat je hem zelf kunt plakken.");
  }

  return (
    <View style={styles.layeredScreen}>
      <BackgroundBrandingLayer screen="request" />
      <ScrollView
        style={styles.transparentScreen}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
      <BackHeader kicker="Betaalverzoek" title={formatCurrency(request.amount, request.settlementCurrency)} onBack={onBack} />
      <Text style={styles.ownerNotice}>Jij hebt dit betaalverzoek gemaakt</Text>
      <View style={styles.darkCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.darkLabel}>{request.description}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{request.status === "paid" ? "Betaald" : "Pending"}</Text>
          </View>
        </View>
        <Text style={styles.darkAmount}>{paidCount} van {shares.length}</Text>
        <Text style={styles.darkSubtext}>betalingen voltooid · status: {request.status === "paid" ? "betaald" : "pending"}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progressWidth }, request.status === "paid" && styles.progressFillDone]} />
        </View>
      </View>
      <SponsorLabel id={awareness?.id} screen="request" sponsor={sponsor} variant={awareness?.variant} />
      <EducationHint screen="request" content={awareness} />

      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Links per ontvanger</Text>
        {shares.map((share) => (
          <View key={share.id} style={styles.shareCard}>
            <View style={styles.shareHeader}>
              <View>
                <Text style={styles.shareTitle}>Stuur deze link naar persoon {share.position}</Text>
                <Text style={styles.shareMeta}>
                  {formatCurrency(Number(share.amount_eur), "EUR")} · {share.status}
                </Text>
              </View>
            </View>
            <Text style={styles.shareLink} numberOfLines={1}>{buildAppPayLink(request, share)}</Text>
            <Text style={styles.shareWebLink} numberOfLines={1}>{buildWebPayLink(request, share)}</Text>
            <View style={styles.shareActions}>
              <Pressable style={styles.copyPill} onPress={() => copyLink(share)}>
                <Text style={styles.copyPillText}>Kopieer</Text>
              </Pressable>
              <Pressable style={styles.whatsappPill} onPress={() => shareViaWhatsApp(share)}>
                <Text style={styles.whatsappPillText}>WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <SecondaryButton label="Open eerste betaallink" onPress={onPay} />
      </View>

      <SecondaryButton label="Status verversen" onPress={onSync} />
      </ScrollView>
    </View>
  );
}

export function PayScreen({
  request,
  rates,
  shareId,
  onBack,
  onPaid,
}: {
  request: SplitRequest;
  rates: Rates;
  shareId?: string;
  onBack: () => void;
  onPaid: () => void;
}) {
  const awareness = getAwarenessContent("pay");
  const sponsor = awareness?.type === "sponsor" ? awareness.sponsor : null;
  const [isStarting, setIsStarting] = useState<Currency | null>(null);
  const [sessionText, setSessionText] = useState("");
  const [btcQuote, setBtcQuote] = useState<BtcQuote | null>(null);
  const selectedShare =
    (shareId ? request.shares.find((share) => share.id === shareId) : undefined) ??
    (!shareId ? request.shares.find((share) => share.status === "pending") ?? request.shares[0] : undefined);
  const shareMissing = Boolean(shareId && request.shares.length > 0 && !selectedShare);
  const isPaid = selectedShare?.status === "paid";
  const amountToPay = selectedShare ? Number(selectedShare.amount_eur) : request.amount / request.participants;
  const btc = btcQuote ? Number(btcQuote.btc_amount) : amountToPay / rates.btc_eur;
  const sats = btcQuote ? btcQuote.sats : Math.round(btc * 100_000_000);
  const poster = request.poster ?? DEMO_POSTERS[2];
  const quoteSource = btcQuote?.source ?? rates.source;
  const quoteUpdatedAt = btcQuote?.updated_at ?? rates.updated_at;
  const quoteTime = new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(quoteUpdatedAt));
  const quoteExpired = btcQuote ? new Date(btcQuote.expires_at).getTime() <= Date.now() : false;

  useEffect(() => {
    if (!selectedShare || shareMissing) {
      setBtcQuote(null);
      return;
    }

    let isActive = true;

    refetchBtcQuote()
      .then((quote) => {
        if (isActive) {
          setBtcQuote(quote);
        }
      })
      .catch(() => {
        if (isActive) {
          setBtcQuote(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [request.id, selectedShare?.id, shareMissing]);

  useEffect(() => {
    if (!sessionText || isPaid || shareMissing) {
      return;
    }

    const interval = setInterval(async () => {
      const previousStatus = selectedShare?.status ?? "pending";
      await onPaid();
      console.log("polling_state_change", {
        request_id: request.id,
        share_id: selectedShare?.id,
        from: previousStatus,
        to: "sync_requested",
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isPaid, onPaid, request.id, selectedShare?.id, selectedShare?.status, sessionText, shareMissing]);

  async function refetchBtcQuote() {
    if (!selectedShare) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/api/quotes/requests/${request.id}/shares/${selectedShare.id}/btc`);
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as BtcQuote;
  }

  async function startPayment(currency: Currency) {
    if (shareMissing) {
      Alert.alert("Link niet gevonden", "Deze betaallink hoort niet bij dit betaalverzoek.");
      return;
    }

    if (isPaid) {
      Alert.alert("Al betaald", "Deze betaling is al voltooid.");
      return;
    }

    setIsStarting(currency);
    setSessionText("");
    try {
      let activeQuote = btcQuote;
      if (currency === "BTC" && (!activeQuote || quoteExpired)) {
        setSessionText("Quote verlopen, vernieuwen...");
        activeQuote = await refetchBtcQuote();
        setBtcQuote(activeQuote);
        setSessionText("");
        if (!activeQuote) {
          throw new Error("Quote unavailable");
        }
      }

      const response = await fetch(`${API_BASE_URL}/requests/${request.id}/payment-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_currency: currency,
          share_id: selectedShare?.id,
          quote_id: currency === "BTC" ? activeQuote?.quote_id : undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 409 && currency === "BTC") {
          setSessionText("Quote verlopen, vernieuwen...");
          const quote = await refetchBtcQuote();
          setBtcQuote(quote);
          return;
        }

        throw new Error("Payment failed");
      }

      const data = await response.json();
      if (currency === "BTC") {
        setSessionText(data.lightning_invoice ?? "Lightning invoice niet beschikbaar.");
      } else if (data.checkout_url) {
        await Linking.openURL(data.checkout_url);
        await onPaid();
      }
    } catch {
      Alert.alert("Betaalmethode niet beschikbaar", "Probeer het opnieuw of kies een andere betaalmethode.");
    } finally {
      setIsStarting(null);
    }
  }

  return (
    <ImageBackground source={poster.image_url ? { uri: poster.image_url } : undefined} style={styles.payBackground} imageStyle={styles.payImage}>
      <BackgroundBrandingLayer screen="pay" />
      <ScrollView contentContainerStyle={styles.payContent}>
        <BackHeader kicker="Satsway" title="Betaal veilig" onBack={onBack} light />
        <View style={styles.payPoster}>
          <Text style={styles.payPosterLabel}>{poster.sponsor_name ?? "Satsway poster"}</Text>
          <Text style={styles.payPosterTitle}>{poster.title}</Text>
          <Text style={styles.payPosterText}>{poster.text}</Text>
        </View>
        <SponsorLabel id={awareness?.id} screen="pay" sponsor={sponsor} variant={awareness?.variant} />
        <View style={styles.payPanel}>
          {shareMissing ? (
            <>
              <Text style={styles.payLabel}>Link verlopen</Text>
              <Text style={styles.payAmountSmall}>Betaallink niet gevonden</Text>
              <Text style={styles.payDescription}>Vraag de maker om een nieuwe Satsway-link te sturen.</Text>
              <PrimaryButton label="Terug" onPress={onBack} />
            </>
          ) : (
            <>
              <Text style={styles.payLabel}>{isPaid ? "Voltooid" : "Te betalen"}</Text>
              <Text style={styles.payAmount}>{formatCurrency(amountToPay, "EUR")}</Text>
              <Text style={styles.payDescription}>{request.description}</Text>
              {isPaid ? (
                <Text style={styles.successNotice}>Deze betaling is al voltooid.</Text>
              ) : (
                <Text style={styles.btcPreview}>
                  {sats.toLocaleString("nl-NL")} sats · ≈ {btc.toFixed(8)} BTC
                </Text>
              )}
              {!isPaid ? (
                <Text style={styles.btcSourceText}>
                  Prijs gebaseerd op {quoteSource} · bijgewerkt om {quoteTime}
                </Text>
              ) : null}
              <EducationHint screen="pay" content={awareness} />

              <PrimaryButton
                label={isStarting === "EUR" ? "Euro betaling starten..." : isPaid ? "Betaling voltooid" : "Betaal met euro"}
                onPress={() => startPayment("EUR")}
                disabled={isStarting !== null || isPaid}
              />
              <Pressable style={[styles.bitcoinButton, isPaid && styles.disabledButton]} onPress={() => startPayment("BTC")} disabled={isStarting !== null || isPaid}>
                {isStarting === "BTC" ? <ActivityIndicator color="#111827" /> : <Text style={styles.bitcoinButtonText}>{isPaid ? "Bitcoin betaling voltooid" : "Betaal met Bitcoin"}</Text>}
              </Pressable>

              {sessionText ? <Text style={styles.invoiceText}>{sessionText}</Text> : null}
            </>
          )}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

export function LinkFallbackScreen({
  title,
  text,
  isLoading = false,
  onBack,
}: {
  title: string;
  text: string;
  isLoading?: boolean;
  onBack: () => void;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <BackHeader kicker="Satsway link" title={title} onBack={onBack} />
      <View style={styles.emptyCard}>
        {isLoading ? <ActivityIndicator color="#047857" /> : <Text style={styles.emptyIcon}>!</Text>}
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{text}</Text>
        <PrimaryButton label="Naar overzicht" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

export function ScanScreen({ onBack, onUseResult }: { onBack: () => void; onUseResult: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <BackHeader kicker="Bon scannen" title="Scan je bon" onBack={onBack} />
      <PosterSurface poster={DEMO_POSTERS[1]} compact />
      <View style={styles.cameraShell}>
        {permission?.granted ? (
          <CameraView style={styles.camera} facing="back" />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.cameraPlaceholderText}>Camera toegang nodig</Text>
            <SecondaryButton label="Geef toegang" onPress={requestPermission} />
          </View>
        )}
        <View style={styles.scanFrame} pointerEvents="none" />
      </View>
      <Text style={styles.scanText}>Scan je bon en Satsway maakt automatisch een betaalverzoek.</Text>

      <View style={styles.formCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.inputLabel}>Gesimuleerd resultaat</Text>
          <View style={styles.livePill}>
            <Text style={styles.livePillText}>3 personen</Text>
          </View>
        </View>
        <Text style={styles.receiptTotal}>€ 28,00</Text>
        {["Flat white € 4,20", "Lunch bowl € 13,50", "Friets tafel € 7,80", "Service € 2,50"].map((item) => (
          <Text key={item} style={styles.receiptLine}>{item}</Text>
        ))}
      </View>

      <PrimaryButton label="Maak split van bon" onPress={onUseResult} />
    </ScrollView>
  );
}
