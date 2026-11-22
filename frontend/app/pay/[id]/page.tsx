"use client";

import Link from "next/link";
import PosterCarousel from "@/app/components/PosterCarousel";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  amountPerPerson,
  createPaymentSession,
  Currency,
  fallbackRates,
  fetchRequestById,
  fetchRates,
  formatCurrency,
  PaymentSession,
  Rates,
  SplitRequest,
  syncRequestStatus,
} from "@/lib/satsway";

function formatPaymentAmount(amount: number, currency: Currency) {
  if (currency === "BTC") {
    const sats = Math.round(amount * 100_000_000);
    return `${sats.toLocaleString("nl-NL")} sats`;
  }

  return formatCurrency(amount, currency);
}

function btcQuoteForEuro(amountEur: number, rates: Rates) {
  const btc = amountEur / rates.btc_eur;
  const sats = Math.round(btc * 100_000_000);

  return {
    btc,
    sats,
    label: `≈ ${btc.toFixed(8)} BTC (${sats.toLocaleString("nl-NL")} sats)`,
  };
}

function formatPriceTime(updatedAt: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(updatedAt));
}

export default function PublicPaymentPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const isSuccessReturn = searchParams.get("success") === "true";
  const shareId = searchParams.get("share") ?? undefined;
  const [request, setRequest] = useState<SplitRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [rates, setRates] = useState<Rates>(() => fallbackRates());
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRequest() {
      const loadedRequest = await fetchRequestById(id);
      if (!isMounted) {
        return;
      }

      if (loadedRequest) {
        setRequest(await syncRequestStatus(loadedRequest));
      } else {
        setRequest(null);
      }
      setIsLoading(false);
    }

    loadRequest();
    fetchRates().then((rates) => {
      if (isMounted) {
        setRates(rates);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!request || request.status === "paid") {
      return;
    }

    const interval = window.setInterval(() => {
      syncRequestStatus(request).then(setRequest);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [request]);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#edf3ef] px-4 text-slate-950">
        <div className="w-full max-w-[430px] rounded-[34px] bg-[#f8faf9] p-6 text-center shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-emerald-200" />
          <p className="mt-4 font-black">Betaalverzoek laden...</p>
        </div>
      </main>
    );
  }

  if (!request) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#edf3ef] px-4 text-slate-950">
        <div className="w-full max-w-[430px] rounded-[34px] bg-[#f8faf9] p-6 text-center shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
          <p className="text-3xl">!</p>
          <h1 className="mt-3 text-xl font-black">Link niet gevonden</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Dit betaalverzoek bestaat niet meer of is nog niet beschikbaar.
          </p>
        </div>
      </main>
    );
  }

  const selectedShare =
    request.shares.find((share) => share.id === shareId) ??
    request.shares.find((share) => share.status === "pending") ??
    request.shares[0];
  const amountToPay = selectedShare
    ? Number(selectedShare.amount_eur)
    : amountPerPerson(request.amount, request.participants);
  const btcQuote = btcQuoteForEuro(amountToPay, rates);
  const priceTime = formatPriceTime(rates.updated_at);
  const shareIsPaid = selectedShare?.status === "paid";

  async function choosePaymentCurrency(currency: Currency) {
    if (!request) {
      return;
    }

    setSelectedCurrency(currency);
    setSessionError("");
    try {
      const session = await createPaymentSession(request.id, currency, selectedShare?.id);
      setPaymentSession(session);

      if (currency !== "BTC" && session.checkout_url) {
        window.location.href = session.checkout_url;
      }
    } catch {
      setSessionError("We konden deze betaalmethode niet starten. Probeer opnieuw.");
    } finally {
      setSelectedCurrency(null);
    }
  }

  if (request.settlementCurrency === "BTC") {
    return (
      <PaymentShell>
        <div className="flex min-h-[calc(100vh-40px)] flex-col justify-center p-5">
          <div className="rounded-[34px] bg-white p-6 text-slate-950 shadow-xl">
            <p className="text-sm font-black text-orange-700">Satsway · ontvang in sats</p>
            <h1 className="mt-3 text-3xl font-black">Betaalverzoek van {formatCurrency(amountToPay, "EUR")}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              De ontvanger wil sats in een Lightning-wallet ontvangen. De eurobetaling en omwisseling via Lightspark Grid worden nog aangesloten.
            </p>
            <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
              Deze link kan nu nog geen betaling aannemen. Betaal niet via een andere route op basis van deze pagina.
            </p>
          </div>
        </div>
      </PaymentShell>
    );
  }

  if (isSuccessReturn || request.status === "paid" || shareIsPaid) {
    return (
      <PaymentShell>
        <div className="flex min-h-[calc(100vh-40px)] flex-col justify-between p-5">
          <div className="pt-8 text-center text-white">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-400 text-5xl font-black text-slate-950 shadow-[0_20px_60px_rgba(16,185,129,0.45)]">
              ✓
            </div>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-emerald-100">
              {request.status === "paid" || shareIsPaid ? "Bevestigd" : "Bijna klaar"}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-normal">
              {request.status === "paid" || shareIsPaid
                ? "Betaling gelukt"
                : "Betaling wordt verwerkt"}
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-base font-semibold leading-7 text-white/80">
              {request.status === "paid" || shareIsPaid
                ? "Deze betaling is al voltooid."
                : "Stripe heeft je teruggestuurd. We wachten nog heel even op de webhook-bevestiging."}
            </p>
          </div>

          <div className="rounded-[32px] border border-white/45 bg-white/92 p-5 shadow-[0_28px_80px_rgba(2,6,23,0.28)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500">Betaald bedrag</p>
                <p className="mt-1 text-3xl font-black">
                  {formatCurrency(amountToPay, "EUR")}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                {selectedShare?.status ?? request.status}
              </span>
            </div>
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
              {request.description || "Satsway betaalverzoek"}
            </p>
            <Link
              href="/"
              className="mt-4 flex h-14 items-center justify-center rounded-2xl bg-slate-950 font-black text-white"
            >
              Maak zelf een split
            </Link>
          </div>
        </div>
      </PaymentShell>
    );
  }

  return (
    <PaymentShell>
      <div className="flex min-h-[calc(100vh-40px)] flex-col justify-end p-5">
        <div className="mb-5 text-white">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">
            Satsway
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-normal">
            Je betaalt {formatCurrency(amountToPay, "EUR")} voor dit verzoek
          </h1>
          <p className="mt-3 max-w-xs text-sm font-semibold leading-6 text-white/78">
            Jij kiest hoe je betaalt. De ontvanger kiest wat die ontvangt.
          </p>
        </div>

        <div className="rounded-[34px] border border-white/50 bg-white/94 p-5 shadow-[0_28px_80px_rgba(2,6,23,0.32)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white">
              S
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">Gevraagd door</p>
              <p className="font-black">Satsway gebruiker</p>
            </div>
          </div>

          <div className="mt-7 text-center">
            <p className="text-sm font-bold text-orange-700">Te betalen</p>
            <h2 className="mt-2 text-6xl font-black tracking-normal">
              {formatCurrency(amountToPay, "EUR")}
            </h2>
            <p className="mx-auto mt-4 max-w-xs text-base font-semibold leading-7 text-slate-600">
              {request.description || "Satsway betaalverzoek"}
            </p>
            <p className="mt-3 text-sm font-black text-orange-700">
              {btcQuote.label}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              Prijs gebaseerd op {rates.source} · bijgewerkt om {priceTime}
            </p>
            {selectedShare && (
              <p className="mt-3 text-sm font-black text-slate-500">
                Ontvanger {selectedShare.position} van {request.participants}
              </p>
            )}
          </div>

          <div className="mt-6 rounded-[24px] bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-300">Status</p>
                <p className="mt-1 font-black">{selectedShare?.status ?? request.status}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-emerald-200">
                Veilig
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => choosePaymentCurrency("EUR")}
              disabled={selectedCurrency !== null || shareIsPaid}
              className="flex h-16 w-full items-center justify-between rounded-[24px] bg-[#f7931a] px-5 font-black text-[#26180d] shadow-lg shadow-orange-700/20 disabled:bg-slate-400"
            >
              <span>{selectedCurrency === "EUR" ? "Euro betaling starten..." : "Betaal met euro"}</span>
              <span className="text-xl">→</span>
            </button>

            <button
              type="button"
              onClick={() => choosePaymentCurrency("BTC")}
              disabled={selectedCurrency !== null || shareIsPaid}
              className="flex h-16 w-full items-center justify-between rounded-[24px] bg-slate-100 px-5 font-black text-slate-950"
            >
              <span>{selectedCurrency === "BTC" ? "Lightning invoice maken..." : "Betaal met Bitcoin"}</span>
              <span className="text-xl">₿</span>
            </button>
          </div>

          {sessionError && (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
              {sessionError}
            </div>
          )}

          {paymentSession?.payment_currency === "BTC" && (
            <div className="mt-4 rounded-[24px] bg-orange-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-orange-800">Lightning invoice</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatPaymentAmount(Number(paymentSession.payment_amount), "BTC")}
                  </p>
                  <p className="mt-1 text-sm font-black text-orange-800">
                    {Math.round(Number(paymentSession.payment_amount) * 100_000_000).toLocaleString("nl-NL")} sats
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-orange-700">
                  River
                </span>
              </div>
              <p className="mt-4 break-all rounded-2xl bg-white p-4 font-mono text-xs font-bold leading-5 text-slate-600">
                {paymentSession.lightning_invoice}
              </p>
              <p className="mt-3 text-xs font-bold text-orange-800">
                Mock invoice voor MVP. Straks komt hier een echte River Lightning QR.
              </p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-3">Stripe</div>
            <div className="rounded-2xl bg-slate-50 p-3">Test mode</div>
            <div className="rounded-2xl bg-slate-50 p-3">EUR/BTC</div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] font-bold text-white/80">
          Roterende conceptposters · geen echte sponsoring
        </p>
      </div>
    </PaymentShell>
  );
}

function PaymentShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#281b14] px-4 py-5 text-slate-950">
      <PosterCarousel backdrop />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(38,24,13,.2),rgba(38,24,13,.8))]" />
      <section className="relative mx-auto min-h-[calc(100vh-40px)] w-full max-w-[450px] overflow-hidden rounded-[34px] border border-white/30 bg-slate-950/15 shadow-[0_30px_90px_rgba(2,6,23,0.32)] backdrop-blur-[2px]">
        {children}
      </section>
    </main>
  );
}
