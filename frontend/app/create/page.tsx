"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GridCreateForm from "@/app/components/GridCreateForm";
import {
  API_BASE_URL,
  DEMO_MODE,
  amountPerPerson,
  AuthSession,
  Currency,
  createSplitRequest,
  fallbackRates,
  fetchRates,
  formatCurrency,
  getAuthSession,
  Rates,
  saveStoredRequest,
  SplitRequest,
} from "@/lib/satsway";

export default function CreateSplitPage() {
  return (
    <Suspense fallback={<CreateSplitFallback />}>
      <CreateSplitForm />
    </Suspense>
  );
}

function CreateSplitFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf3ef] px-4 text-slate-950">
      <section className="w-full max-w-[430px] rounded-[34px] bg-[#f8faf9] p-6 text-center shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
        <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-emerald-200" />
        <p className="mt-4 font-black">Split laden...</p>
      </section>
    </main>
  );
}

function formatDisplayAmount(amountEur: number, currency: Currency, rates: Rates) {
  if (currency === "EUR") {
    return formatCurrency(amountEur, "EUR");
  }

  if (currency === "USD") {
    return formatCurrency(amountEur / rates.usd_eur, "USD");
  }

  const btc = amountEur / rates.btc_eur;
  const sats = Math.round(btc * 100_000_000);

  return `≈ ${btc.toFixed(8)} BTC (${sats.toLocaleString("nl-NL")} sats)`;
}

function CreateSplitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [amount, setAmount] = useState(searchParams.get("amount") ?? "");
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("EUR");
  const [settlementCurrency, setSettlementCurrency] = useState<"EUR" | "BTC">("EUR");
  const [lightningAddress, setLightningAddress] = useState("");
  const [rates, setRates] = useState<Rates>(() => fallbackRates());
  const [description, setDescription] = useState(searchParams.get("description") ?? "");
  const [participants, setParticipants] = useState(1);
  const [splitMode, setSplitMode] = useState<SplitRequest["splitMode"]>("even");
  const [customAmounts, setCustomAmounts] = useState<string[]>([""]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gridAvailable, setGridAvailable] = useState(false);
  const [flow, setFlow] = useState<"regular" | "grid">(DEMO_MODE ? "grid" : "regular");

  const numericAmount = Number(amount || 0);
  const perPerson = useMemo(
    () => amountPerPerson(numericAmount, participants),
    [numericAmount, participants],
  );
  const displayPerPerson = useMemo(
    () => formatDisplayAmount(perPerson, displayCurrency, rates),
    [displayCurrency, perPerson, rates],
  );
  const customAmountNumbers = useMemo(
    () => customAmounts.map((customAmount) => Number(customAmount || 0)),
    [customAmounts],
  );
  const customTotal = useMemo(
    () => customAmountNumbers.reduce((sum, customAmount) => sum + customAmount, 0),
    [customAmountNumbers],
  );
  const customDifference = Number((numericAmount - customTotal).toFixed(2));

  useEffect(() => {
    setSession(getAuthSession());
    fetchRates().then(setRates);
    fetch(`${API_BASE_URL}/api/sandbox/grid-links/availability`)
      .then((response) => setGridAvailable(response.ok))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setCustomAmounts((currentAmounts) =>
      Array.from({ length: participants }, (_, index) => currentAmounts[index] ?? ""),
    );
  }, [participants]);

  useEffect(() => {
    if (splitMode !== "custom") {
      return;
    }

    setCustomAmounts((currentAmounts) => {
      if (currentAmounts.some((customAmount) => customAmount !== "")) {
        return currentAmounts;
      }

      return Array.from({ length: participants }, () =>
        amountPerPerson(numericAmount, participants).toFixed(2),
      );
    });
  }, [numericAmount, participants, splitMode]);

  function updateCustomAmount(index: number, value: string) {
    setCustomAmounts((currentAmounts) =>
      currentAmounts.map((customAmount, currentIndex) =>
        currentIndex === index ? value : customAmount,
      ),
    );
  }

  async function submitSplit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (numericAmount <= 0) {
      setError("Vul een geldig bedrag in.");
      return;
    }
    if (settlementCurrency === "BTC" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lightningAddress.trim())) {
      setError("Vul een geldig Lightning-adres in om sats te ontvangen.");
      return;
    }

    if (splitMode === "custom") {
      const hasInvalidAmount = customAmountNumbers.some((customAmount) => customAmount <= 0);
      if (hasInvalidAmount) {
        setError("Vul voor iedere ontvanger een bedrag groter dan € 0,00 in.");
        return;
      }

      if (Math.abs(customDifference) > 0.009) {
        setError(
          `De eigen bedragen moeten samen ${formatCurrency(numericAmount, "EUR")} zijn.`,
        );
        return;
      }
    }

    setIsLoading(true);

    try {
      const request = await createSplitRequest({
        amount: numericAmount,
        settlementCurrency,
        lightningAddress: settlementCurrency === "BTC" ? lightningAddress.trim() : undefined,
        description,
        participants,
        splitMode,
        customAmounts: splitMode === "custom" ? customAmountNumbers : undefined,
      });
      saveStoredRequest(request);
      router.push(`/request/${request.id}`);
    } catch {
      setError("We konden je betaalverzoek niet maken. Probeer opnieuw.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-canvas">
      <section className="app-surface px-5 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl font-black shadow-sm"
          >
            ‹
          </Link>
          <div>
            <p className="eyebrow text-[#b9681a]">NIEUW VERZOEK</p>
            <h1 className="text-3xl font-black tracking-[-.055em]">Betaalverzoek maken</h1>
          </div>
        </div>

        {gridAvailable && !DEMO_MODE && (
          <div className="mb-5 rounded-[28px] bg-white p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setFlow("regular")}
                className={`min-h-14 rounded-[20px] px-2 text-sm font-black ${flow === "regular" ? "bg-[#281b14] text-white" : "text-slate-600"}`}>
                Euroverzoek
              </button>
              <button type="button" onClick={() => setFlow("grid")}
                className={`min-h-14 rounded-[20px] px-2 text-sm font-black ${flow === "grid" ? "bg-[#f7931a] text-[#281b14]" : "text-slate-600"}`}>
                Test USD → sats
              </button>
            </div>
          </div>
        )}
        {flow === "grid" && (gridAvailable || DEMO_MODE) ? <GridCreateForm /> : <form onSubmit={submitSplit} className="space-y-4">
          <div className="rounded-[24px] bg-[#ffecd5] px-4 py-3 text-sm font-bold text-[#80522c]">
            {session
              ? `Aangemaakt als ${session.user.email}`
              : "Je kunt zonder account testen. Log op het dashboard in om requests aan je account te koppelen."}
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <label className="block">
              <span className="text-sm font-bold text-slate-600">Bedrag in euro</span>
              <div className="mt-2 flex items-center rounded-[24px] bg-slate-50 px-4">
                <span className="text-2xl font-black text-slate-400">€</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  inputMode="decimal"
                  placeholder="42,00"
                  className="h-20 w-full bg-transparent px-3 text-4xl font-black outline-none placeholder:text-slate-300"
                />
              </div>
            </label>

            <div className="mt-4">
              <p className="text-sm font-bold text-slate-600">Toon waarde als</p>
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
                {(["EUR", "USD", "BTC"] as Currency[]).map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => setDisplayCurrency(currency)}
                    className={`h-11 rounded-xl text-sm font-black ${
                      displayCurrency === currency
                        ? "bg-[#f7931a] text-[#281b14]"
                        : "text-slate-600"
                    }`}
                  >
                    {currency}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                Het invoerbedrag blijft euro. Kies BTC om te zien hoeveel bitcoin dit
                ongeveer is voor de betaler.
              </p>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-bold text-slate-600">Omschrijving</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                type="text"
                placeholder="Lunch, huur, weekend weg"
                className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold outline-none focus:border-orange-500 focus:bg-white"
              />
            </label>
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-600">Wat wil jij ontvangen?</p>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button type="button" onClick={() => setSettlementCurrency("EUR")}
                className={`h-12 rounded-xl text-sm font-black ${settlementCurrency === "EUR" ? "bg-[#f7931a] text-[#281b14]" : "text-slate-600"}`}>
                Euro’s
              </button>
              <button type="button" onClick={() => setSettlementCurrency("BTC")}
                className={`h-12 rounded-xl text-sm font-black ${settlementCurrency === "BTC" ? "bg-[#f7931a] text-[#281b14]" : "text-slate-600"}`}>
                Sats
              </button>
            </div>
            {settlementCurrency === "BTC" && (
              <>
                <label className="mt-4 block">
                  <span className="text-sm font-bold text-slate-600">Jouw Lightning-adres</span>
                  <input value={lightningAddress} onChange={(event) => setLightningAddress(event.target.value)}
                    type="text" autoComplete="off" placeholder="jij@wallet.nl"
                    className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold outline-none focus:border-orange-500 focus:bg-white" />
                </label>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  Euro naar sats is nog niet beschikbaar. Gebruik bovenaan de Grid-sandbox om een testlink in USD te maken.
                </p>
              </>
            )}
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-600">Ontvangers</p>
                <p className="mt-1 text-sm text-slate-500">
                  {displayPerPerson} per persoon
                </p>
                {displayCurrency === "BTC" && (
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    {formatCurrency(perPerson, "EUR")} per persoon
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setParticipants(Math.max(1, participants - 1))}
                  className="h-10 w-10 rounded-xl bg-white text-xl font-black"
                >
                  −
                </button>
                <span className="w-8 text-center text-lg font-black">{participants}</span>
                <button
                  type="button"
                  onClick={() => setParticipants(participants + 1)}
                  className="h-10 w-10 rounded-xl bg-white text-xl font-black"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSplitMode("even")}
                className={`h-12 rounded-xl text-sm font-black ${
                  splitMode === "even" ? "bg-[#f7931a] text-[#281b14]" : "text-slate-600"
                }`}
              >
                Gelijk verdelen
              </button>
              <button
                type="button"
                onClick={() => setSplitMode("custom")}
                className={`h-12 rounded-xl text-sm font-black ${
                  splitMode === "custom" ? "bg-[#f7931a] text-[#281b14]" : "text-slate-600"
                }`}
              >
                Eigen bedragen
              </button>
            </div>

            {splitMode === "custom" && (
              <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-700">Eigen bedragen</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Vul per ontvanger het eurobedrag in. Samen moet dit het totaalbedrag
                      zijn.
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                      Math.abs(customDifference) <= 0.009
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {Math.abs(customDifference) <= 0.009
                      ? "Klopt"
                      : `${formatCurrency(Math.abs(customDifference), "EUR")} ${
                          customDifference > 0 ? "over" : "te veel"
                        }`}
                  </div>
                </div>

                <div className="space-y-2">
                  {customAmounts.map((customAmount, index) => (
                    <label
                      key={`custom-share-${index}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2"
                    >
                      <span className="min-w-0 text-sm font-bold text-slate-600">
                        Persoon {index + 1}
                      </span>
                      <div className="flex min-w-0 items-center rounded-xl bg-slate-100 px-3">
                        <span className="text-sm font-black text-slate-400">€</span>
                        <input
                          value={customAmount}
                          onChange={(event) => updateCustomAmount(index, event.target.value)}
                          min="0.01"
                          step="0.01"
                          type="number"
                          inputMode="decimal"
                          placeholder="0,00"
                          className="h-11 w-24 bg-transparent px-2 text-right text-base font-black outline-none placeholder:text-slate-300"
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="rounded-2xl bg-white px-3 py-3 text-xs font-bold text-slate-500">
                  Totaal eigen bedragen:{" "}
                  <span className="text-slate-950">{formatCurrency(customTotal, "EUR")}</span>
                  {displayCurrency === "BTC" && numericAmount > 0 && (
                    <span className="mt-1 block">
                      Betaler ziet per link ook automatisch de BTC-waarde.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="primary-button h-16 w-full rounded-[24px] text-base font-black disabled:bg-slate-400"
          >
            {isLoading ? "Betaalverzoek maken..." : "Betaalverzoek maken"}
          </button>
        </form>}
      </section>
    </main>
  );
}
