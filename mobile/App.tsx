import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { AppState, KeyboardAvoidingView, LogBox, Platform, View } from "react-native";

import { fallbackRates, fetchRates, mapBackendRequest } from "./src/api/client";
import { API_BASE_URL } from "./src/config";
import { linking } from "./src/linking";
import { isTabRoute, type RootStackParamList, type TabParamList } from "./src/navigation";
import {
  CreateScreen,
  HomeScreen,
  LinkFallbackScreen,
  PayScreen,
  RequestScreen,
  RequestsScreen,
  ScanScreen,
  WalletScreen,
} from "./src/screens/AppScreens";
import { loadStoredRequests, saveStoredRequests } from "./src/storage/requests";
import type { BackendRequest, Currency, Rates, RequestStatus, SplitRequest, TabScreen } from "./src/types";
import { formatCurrency } from "./src/utils/format";
import { BottomTabs } from "./src/components/AppChrome";
import { styles } from "./src/styles";

LogBox.ignoreLogs([
  "The app is running using the Legacy Architecture",
  "has a shadow set but cannot calculate shadow efficiently",
]);
LogBox.ignoreAllLogs(true);

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

export default function App() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [requests, setRequests] = useState<SplitRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<SplitRequest | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [participants, setParticipants] = useState(3);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("EUR");
  const [splitMode, setSplitMode] = useState<SplitRequest["splitMode"]>("even");
  const [customAmounts, setCustomAmounts] = useState<string[]>(["", "", ""]);
  const [rates, setRates] = useState<Rates>(() => fallbackRates());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingRequestIds, setLoadingRequestIds] = useState<string[]>([]);
  const [missingRequestIds, setMissingRequestIds] = useState<string[]>([]);

  useEffect(() => {
    loadStoredRequests().then(setRequests);
    fetchRates().then(setRates);
  }, []);

  useEffect(() => {
    setCustomAmounts((currentAmounts) =>
      Array.from({ length: participants }, (_, index) => currentAmounts[index] ?? ""),
    );
  }, [participants]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && activeRequest) {
        void syncRequest(activeRequest).then(async (synced) => {
          setActiveRequest(synced);
          await persistRequest(synced);
        });
      }
    });

    return () => subscription.remove();
  }, [activeRequest, requests]);

  async function persistRequest(request: SplitRequest) {
    const nextRequests = [request, ...requests.filter((item) => item.id !== request.id)].slice(0, 12);
    setRequests(nextRequests);
    await saveStoredRequests(nextRequests);
  }

  async function createRequest() {
    const numericAmount = Number(amount.replace(",", "."));
    const customAmountNumbers = customAmounts.map((customAmount) =>
      Number(customAmount.replace(",", ".") || 0),
    );
    const customTotal = customAmountNumbers.reduce((sum, customAmount) => sum + customAmount, 0);
    setError("");

    if (!numericAmount || numericAmount <= 0) {
      setError("Vul een geldig bedrag in.");
      return;
    }

    if (splitMode === "custom") {
      if (customAmountNumbers.some((customAmount) => customAmount <= 0)) {
        setError("Vul voor iedere ontvanger een bedrag groter dan € 0,00 in.");
        return;
      }

      if (Math.abs(numericAmount - customTotal) > 0.009) {
        setError(`De eigen bedragen moeten samen ${formatCurrency(numericAmount, "EUR")} zijn.`);
        return;
      }
    }

    setIsLoading(true);
    try {
      const body: Record<string, unknown> = {
        amount_eur: numericAmount,
        settlement_currency: "EUR",
        participant_count: participants,
        description,
      };

      if (splitMode === "custom") {
        body.share_amounts_eur = customAmountNumbers;
      }

      const response = await fetch(`${API_BASE_URL}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Backend unavailable");
      }

      const data = (await response.json()) as {
        request_id: string;
        status: RequestStatus;
        checkout_url: string;
      };
      const request: SplitRequest = {
        id: data.request_id,
        amount: numericAmount,
        settlementCurrency: "EUR",
        description: description || "Satsway verzoek",
        participants,
        splitMode,
        status: data.status,
        checkoutUrl: data.checkout_url,
        createdAt: new Date().toISOString(),
        paidCount: 0,
        shares: [],
      };

      const synced = await syncRequest(request);
      await persistRequest(synced);
      setActiveRequest(synced);
      setAmount("");
      setDescription("");
      setSplitMode("even");
      setCustomAmounts(Array.from({ length: participants }, () => ""));
      navigationRef.navigate("request", { requestId: synced.id });
    } catch {
      setError("We konden je betaalverzoek niet maken. Controleer de serververbinding.");
    } finally {
      setIsLoading(false);
    }
  }

  async function openRequest(request: SplitRequest) {
    setActiveRequest(request);
    navigationRef.navigate("request", { requestId: request.id });
    const synced = await syncRequest(request);
    setActiveRequest(synced);
    await persistRequest(synced);
  }

  async function syncRequest(request: SplitRequest) {
    try {
      const response = await fetch(`${API_BASE_URL}/requests/${request.id}`);
      if (!response.ok) {
        return request;
      }

      const data = (await response.json()) as BackendRequest;
      return mapBackendRequest(data, request);
    } catch {
      return request;
    }
  }

  async function loadRequestById(requestId: string) {
    setMissingRequestIds((currentIds) => currentIds.filter((id) => id !== requestId));
    setLoadingRequestIds((currentIds) => [...new Set([...currentIds, requestId])]);

    const existingRequest =
      requests.find((request) => request.id === requestId) ??
      (activeRequest?.id === requestId ? activeRequest : null);

    if (existingRequest?.id === requestId) {
      const synced = await syncRequest(existingRequest);
      setActiveRequest(synced);
      await persistRequest(synced);
      setLoadingRequestIds((currentIds) => currentIds.filter((id) => id !== requestId));
      return synced;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/requests/${requestId}`);
      if (!response.ok) {
        setMissingRequestIds((currentIds) => [...new Set([...currentIds, requestId])]);
        return null;
      }

      const data = (await response.json()) as BackendRequest;
      const fallbackRequest: SplitRequest = {
        id: data.id,
        amount: Number(data.amount_eur) || 0,
        settlementCurrency: data.settlement_currency ?? "EUR",
        description: data.description ?? "Satsway verzoek",
        participants: data.participant_count ?? Math.max(1, data.shares?.length ?? 1),
        splitMode: "even",
        status: data.status,
        createdAt: data.created_at,
        paidCount: data.paid_count ?? 0,
        shares: data.shares ?? [],
        poster: data.poster ?? null,
      };
      const request = mapBackendRequest(data, fallbackRequest);
      setActiveRequest(request);
      await persistRequest(request);
      return request;
    } catch {
      setMissingRequestIds((currentIds) => [...new Set([...currentIds, requestId])]);
      return null;
    } finally {
      setLoadingRequestIds((currentIds) => currentIds.filter((id) => id !== requestId));
    }
  }

  const openAmount = requests
    .filter((request) => request.status === "pending")
    .reduce((total, request) => total + request.amount, 0);

  function navigateTab(tab: TabScreen) {
    setError("");
    navigationRef.navigate("tabs", { screen: tab });
  }

  function findRequest(requestId?: string) {
    if (!requestId) {
      return activeRequest;
    }

    return requests.find((request) => request.id === requestId) ?? (activeRequest?.id === requestId ? activeRequest : null);
  }

  function isRequestLoading(requestId?: string) {
    return Boolean(requestId && loadingRequestIds.includes(requestId));
  }

  function isRequestMissing(requestId?: string) {
    return Boolean(requestId && missingRequestIds.includes(requestId));
  }

  function syncRouteRequest() {
    const route = navigationRef.getCurrentRoute();
    const requestId =
      route?.name === "request" || route?.name === "pay"
        ? (route.params as { requestId?: string } | undefined)?.requestId
        : undefined;

    if (requestId && !requests.some((request) => request.id === requestId) && activeRequest?.id !== requestId) {
      void loadRequestById(requestId);
    }
  }

  function getFirstShareId(request: SplitRequest) {
    return request.shares.find((share) => share.status === "pending")?.id ?? request.shares[0]?.id;
  }

  function renderTabBar({ state, navigation }: BottomTabBarProps) {
    const activeTab = state.routes[state.index]?.name;
    if (!isTabRoute(activeTab)) {
      return null;
    }

    return (
      <BottomTabs
        activeTab={activeTab}
        onChange={(tab) => {
          setError("");
          navigation.navigate(tab);
        }}
      />
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          onReady={syncRouteRequest}
          onStateChange={syncRouteRequest}
        >
          <Stack.Navigator initialRouteName="tabs" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="tabs">
              {() => (
                <Tab.Navigator initialRouteName="home" screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
                  <Tab.Screen name="home">
                    {() => (
                      <HomeScreen
                        openAmount={openAmount}
                        requests={requests}
                        onCreate={() => navigateTab("create")}
                        onScan={() => navigateTab("scan")}
                        onOpenRequest={openRequest}
                      />
                    )}
                  </Tab.Screen>
                  <Tab.Screen name="create">
                    {() => (
                      <CreateScreen
                        amount={amount}
                        description={description}
                        participants={participants}
                        displayCurrency={displayCurrency}
                        rates={rates}
                        splitMode={splitMode}
                        customAmounts={customAmounts}
                        isLoading={isLoading}
                        error={error}
                        onBack={() => navigateTab("home")}
                        onAmountChange={setAmount}
                        onDescriptionChange={setDescription}
                        onParticipantsChange={setParticipants}
                        onDisplayCurrencyChange={setDisplayCurrency}
                        onSplitModeChange={setSplitMode}
                        onCustomAmountChange={(index, value) =>
                          setCustomAmounts((currentAmounts) =>
                            currentAmounts.map((customAmount, currentIndex) =>
                              currentIndex === index ? value : customAmount,
                            ),
                          )
                        }
                        onSubmit={createRequest}
                      />
                    )}
                  </Tab.Screen>
                  <Tab.Screen name="scan">
                    {() => (
                      <ScanScreen
                        onBack={() => navigateTab("home")}
                        onUseResult={() => {
                          setAmount("28.00");
                          setDescription("Lunch bon");
                          setParticipants(3);
                          navigateTab("create");
                        }}
                      />
                    )}
                  </Tab.Screen>
                  <Tab.Screen name="requests">
                    {() => (
                      <RequestsScreen
                        requests={requests}
                        onOpenRequest={openRequest}
                        onCreate={() => navigateTab("create")}
                      />
                    )}
                  </Tab.Screen>
                  <Tab.Screen name="wallet">
                    {() => <WalletScreen openAmount={openAmount} requests={requests} />}
                  </Tab.Screen>
                </Tab.Navigator>
              )}
            </Stack.Screen>
            <Stack.Screen name="request">
              {({ route }) => {
                const requestId = route.params?.requestId;
                const request = findRequest(requestId);

                return request ? (
                  <RequestScreen
                    request={request}
                    onBack={() => navigateTab("requests")}
                    onPay={() =>
                      navigationRef.navigate("pay", {
                        requestId: request.id,
                        shareId: getFirstShareId(request),
                      })
                    }
                    onSync={async () => {
                      const synced = await syncRequest(request);
                      setActiveRequest(synced);
                      await persistRequest(synced);
                    }}
                  />
                ) : isRequestLoading(requestId) && !isRequestMissing(requestId) ? (
                  <LinkFallbackScreen
                    title="Betaalverzoek laden"
                    text="We halen dit betaalverzoek op bij Satsway."
                    isLoading
                    onBack={() => navigateTab("requests")}
                  />
                ) : (
                  <LinkFallbackScreen
                    title="Betaalverzoek niet gevonden"
                    text="Deze link is verlopen of hoort niet bij een bestaand betaalverzoek."
                    onBack={() => navigateTab("requests")}
                  />
                );
              }}
            </Stack.Screen>
            <Stack.Screen name="pay">
              {({ route }) => {
                const requestId = route.params?.requestId;
                const request = findRequest(requestId);

                return request ? (
                  <PayScreen
                    request={request}
                    rates={rates}
                    shareId={route.params?.shareId}
                    onBack={() => navigationRef.navigate("request", { requestId: request.id })}
                    onPaid={async () => {
                      const synced = await syncRequest(request);
                      setActiveRequest(synced);
                      await persistRequest(synced);
                    }}
                  />
                ) : isRequestLoading(requestId) && !isRequestMissing(requestId) ? (
                  <LinkFallbackScreen
                    title="Betaallink laden"
                    text="We halen het betaalverzoek op zodat je het juiste bedrag ziet."
                    isLoading
                    onBack={() => navigateTab("requests")}
                  />
                ) : (
                  <LinkFallbackScreen
                    title="Betaallink niet gevonden"
                    text="Deze betaallink is verlopen of hoort niet bij een bestaand betaalverzoek."
                    onBack={() => navigateTab("requests")}
                  />
                );
              }}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </KeyboardAvoidingView>
    </View>
  );
}
