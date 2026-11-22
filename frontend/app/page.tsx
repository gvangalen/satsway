"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import PosterCarousel from "@/app/components/PosterCarousel";
import {
  AuthSession,
  API_BASE_URL,
  DEMO_MODE,
  fetchUserRequests,
  formatEuro,
  getAuthSession,
  logout,
  requestLoginCode,
  SplitRequest,
  verifyLoginCode,
} from "@/lib/satsway";

type GridLinkSummary = {
  id: string;
  amount_usd: number;
  owner_user_id: string;
  owner_name: string | null;
  payer_name: string | null;
  sats_status: string;
};

export default function Home() {
  const [requests, setRequests] = useState<SplitRequest[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sandboxAvailable, setSandboxAvailable] = useState(false);
  const [gridLinks, setGridLinks] = useState<GridLinkSummary[]>([]);

  async function loadGridLinks(activeSession: AuthSession | null) {
    if (!activeSession) { setGridLinks([]); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/api/sandbox/grid-links/mine`, {
        headers: { Authorization: `Bearer ${activeSession.accessToken}` }, cache: "no-store",
      });
      setGridLinks(response.ok ? await response.json() : []);
    } catch { setGridLinks([]); }
  }

  useEffect(() => {
    const storedSession = getAuthSession();
    setSession(storedSession);
    fetchUserRequests().then(setRequests);
    loadGridLinks(storedSession);
    fetch(`${API_BASE_URL}/api/sandbox/grid-links/availability`)
      .then((response) => setSandboxAvailable(response.ok))
      .catch(() => undefined);
  }, []);

  async function handleLoggedIn(nextSession: AuthSession) {
    setSession(nextSession);
    setRequests(await fetchUserRequests());
    await loadGridLinks(nextSession);
  }

  async function handleLogout() {
    await logout();
    setSession(null);
    setRequests(await fetchUserRequests());
    setGridLinks([]);
  }

  const openAmount = requests
    .filter((request) => request.status === "pending" && request.settlementCurrency === "EUR")
    .reduce((total, request) => total + request.amount, 0);

  return (
    <main className="app-canvas">
      <section className="app-surface flex flex-col">
        <header className="flex items-center justify-between px-6 pb-5 pt-7">
          <div>
            <p className="eyebrow text-[#b9681a]">SAMEN BETALEN, ZELF KIEZEN</p>
            <h1 className="brand-wordmark mt-2">sats<span>way.</span></h1>
          </div>
          {session ? (
            <button type="button" onClick={handleLogout} aria-label="Uitloggen"
              className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xs font-black text-[#4c2c16] shadow-sm">
              Uit
            </button>
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ffe0b5] text-xl font-black text-[#b66310]">₿</div>
          )}
        </header>

        {session?.user.email.endsWith(".demo@example.com") && (
          <p className="mx-5 mb-4 rounded-2xl bg-orange-100 px-4 py-3 text-sm font-bold text-orange-800">
            Sandboxaccount: {session.user.name}. Alleen fictieve betalingen.
          </p>
        )}
        {DEMO_MODE && <p className="mx-5 mb-4 rounded-2xl bg-orange-100 px-4 py-3 text-sm font-bold text-orange-900">Publieke demo: alleen fictieve USD → sats betalingen.</p>}

        <div className="px-5">
          <div className="relative overflow-hidden rounded-[30px] bg-[#281b14] px-6 pb-6 pt-7 text-white shadow-[0_18px_36px_rgba(64,35,11,.2)]">
            <div className="pointer-events-none absolute -right-15 -top-18 h-64 w-64 rounded-full border border-white/15" />
            <div className="pointer-events-none absolute -right-2 -top-3 h-42 w-42 rounded-full border border-white/15" />
            <p className="eyebrow text-[#ffc275]">JOUW GELD, JOUW KEUZE</p>
            <h2 className="relative mt-5 max-w-[300px] text-[36px] font-black leading-[1.05] tracking-[-.055em]">
              Een betaalverzoek.<br /><span className="text-[#ffac43]">Meer vrijheid.</span>
            </h2>
            <p className="relative mt-4 max-w-[280px] text-sm leading-6 text-white/70">
              Deel een link. Laat vrienden betalen in euro of sats, terwijl jij kiest wat je ontvangt.
            </p>
            <Link href="/create" className="primary-button relative mt-7 flex h-14 items-center justify-between rounded-2xl px-5 text-sm font-black">
              Maak betaalverzoek <span className="text-2xl leading-none">↗</span>
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 px-5">
          <div className="soft-card rounded-[23px] p-4">
            <p className="eyebrow text-[#967461]">OPENSTAAND</p>
            <p className="mt-2 text-[26px] font-black tracking-[-.05em]">{formatEuro(openAmount)}</p>
            <p className="mt-1 text-xs font-medium text-[#8e8177]">in euroverzoeken</p>
          </div>
          <div className="soft-card rounded-[23px] p-4">
            <p className="eyebrow text-[#967461]">JOUW SPLITS</p>
            <p className="mt-2 text-[26px] font-black tracking-[-.05em]">{requests.length + gridLinks.filter((item) => item.owner_user_id === session?.user.id).length}</p>
            <p className="mt-1 text-xs font-medium text-[#8e8177]">betaalverzoeken</p>
          </div>
        </div>

        <div className="mt-7 px-5">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="eyebrow text-[#b9681a]">INSPIRATIE</p>
              <h2 className="mt-1 text-[23px] font-black tracking-[-.05em]">Posters in beweging</h2>
            </div>
            <span className="rounded-full bg-[#ffe8cb] px-3 py-1 text-[10px] font-black text-[#a65b17]">CONCEPT</span>
          </div>
          <PosterCarousel />
          <p className="mt-2 px-1 text-[11px] leading-5 text-[#8e8177]">
            Voorbeeldposters tonen hoe sponsoring en Bitcoin-uitleg elkaar straks afwisselen.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 px-5">
          <Link href="/create" className="soft-card flex items-center gap-3 rounded-[23px] p-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ffe3bd] text-xl text-[#b66310]">↗</span>
            <span className="text-sm font-black">Nieuw verzoek</span>
          </Link>
          {!DEMO_MODE && <Link href="/scan" className="soft-card flex items-center gap-3 rounded-[23px] p-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f4e9df] text-xl text-[#765d4f]">▣</span>
            <span className="text-sm font-black">Scan een bon</span>
          </Link>}
        </div>

        {sandboxAvailable && (
          <div className="mt-3 px-5">
            <Link href="/create" className="soft-card flex items-center justify-between rounded-[23px] p-4">
              <span className="text-sm font-black">Test Grid met Noor en Sam</span>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">USD → sats</span>
            </Link>
          </div>
        )}

        <div className="flex-1 px-5 pb-8 pt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[23px] font-black tracking-[-.05em]">Recent</h2>
            <span className="text-xs font-semibold text-[#8e8177]">jouw verzoeken</span>
          </div>
          {requests.length === 0 && gridLinks.length === 0 ? (
            <div className="soft-card rounded-[25px] p-6 text-center">
              <div className="mx-auto grid h-13 w-13 place-items-center rounded-2xl bg-[#ffecd3] text-2xl text-[#bf741f]">✳</div>
              <p className="mt-3 font-black">Nog geen splits</p>
              <p className="mt-1 text-sm leading-6 text-[#8e8177]">Maak je eerste verzoek en deel de link.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {gridLinks.map((item) => (
                <Link key={`grid-${item.id}`} href={item.owner_user_id === session?.user.id ? `/request/grid/${item.id}` : `/pay/grid/${item.id}`}
                  className="soft-card flex items-center justify-between rounded-[22px] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#ffe6c2] font-black text-[#bd6a16]">₿</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">Grid test · {item.owner_name ?? "ontvanger"}</p>
                      <p className="mt-1 text-xs text-[#8e8177]">{item.sats_status === "completed" ? "Afgerond" : "Open"} · USD → sats · {item.payer_name ?? "nog geen betaler"}</p>
                    </div>
                  </div>
                  <p className="pl-3 text-sm font-black">{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "USD" }).format(item.amount_usd)}</p>
                </Link>
              ))}
              {requests.map((request) => (
                <Link key={request.id} href={`/request/${request.id}`}
                  className="soft-card flex items-center justify-between rounded-[22px] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#ffe6c2] font-black text-[#bd6a16]">{request.settlementCurrency === "BTC" ? "₿" : "€"}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{request.description || "Betaalverzoek"}</p>
                      <p className="mt-1 text-xs text-[#8e8177]">{request.status === "paid" ? "Betaald" : "Open"} · ontvang in {request.settlementCurrency === "BTC" ? "sats" : "euro"}</p>
                    </div>
                  </div>
                  <p className="pl-3 text-sm font-black">{formatEuro(request.amount)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {!session && !DEMO_MODE && (
          <details className="mx-5 mb-7 rounded-[24px] bg-white shadow-sm">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-[#553d2b]">Account koppelen <span className="float-right">⌄</span></summary>
            <div className="px-3 pb-3"><LoginCard onLoggedIn={handleLoggedIn} /></div>
          </details>
        )}
      </section>
    </main>
  );
}

function LoginCard({ onLoggedIn }: { onLoggedIn: (session: AuthSession) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      await requestLoginCode({ email, name });
      setStep("code");
      setMessage("Code verstuurd. In dev staat hij ook in de backend log.");
    } catch {
      setError("We konden geen login-code maken.");
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const session = await verifyLoginCode({ email, code, name });
      onLoggedIn(session);
    } catch {
      setError("Deze code klopt niet of is verlopen.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-emerald-700">Account</p>
          <h2 className="mt-1 text-xl font-black">Log in voor echte requests</h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
          MVP
        </span>
      </div>

      <form onSubmit={step === "email" ? requestCode : verifyCode} className="mt-4 space-y-3">
        {step === "email" && (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Naam"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
          />
        )}
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={step === "code"}
          required
          type="email"
          placeholder="jij@example.com"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white disabled:text-slate-400"
        />
        {step === "code" && (
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            inputMode="numeric"
            maxLength={6}
            placeholder="6-cijferige code"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-center text-lg font-black tracking-[0.3em] outline-none focus:border-emerald-500 focus:bg-white"
          />
        )}
        {message && <p className="text-sm font-bold leading-6 text-emerald-700">{message}</p>}
        {error && <p className="text-sm font-bold leading-6 text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={isLoading}
          className="h-12 w-full rounded-2xl bg-slate-950 text-sm font-black text-white disabled:bg-slate-400"
        >
          {isLoading ? "Even wachten..." : step === "email" ? "Stuur login-code" : "Inloggen"}
        </button>
      </form>
    </div>
  );
}
