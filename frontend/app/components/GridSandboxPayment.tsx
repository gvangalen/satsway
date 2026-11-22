"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL, AuthSession, DEMO_MODE, getAuthSession, loginSandboxPersona } from "@/lib/satsway";

type GridLink = {
  id: string;
  amount_usd: number;
  lightning_address: string;
  owner_user_id: string | null;
  owner_name: string | null;
  payer_user_id: string | null;
  payer_name: string | null;
  quote_id: string | null;
  quote_sats: number | null;
  quote_fee_cents: number | null;
  quote_expires_at: string | null;
  fiat_status: "not_paid" | "funding" | "simulated_received" | "needs_review";
  sats_status: "not_sent" | "processing" | "completed" | "failed";
  payout_transaction_id: string | null;
  last_error: string | null;
};

export default function GridSandboxLink() {
  const { id } = useParams<{ id: string }>();
  const [link, setLink] = useState<GridLink | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [demoCode, setDemoCode] = useState("");

  useEffect(() => setSession(getAuthSession()), []);

  async function choosePersona(persona: "noor" | "sam") {
    setBusy(true);
    setError("");
    try {
      setSession(await loginSandboxPersona(persona, demoCode));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Inloggen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sandbox/grid-links/${id}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setLink)
      .catch(() => setError("Deze sandboxlink is niet beschikbaar."));
  }, [id]);

  useEffect(() => {
    if (link?.sats_status !== "processing") return;
    const interval = window.setInterval(() => {
      fetch(`${API_BASE_URL}/api/sandbox/grid-links/${id}/status`, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : Promise.reject())
        .then(setLink)
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(interval);
  }, [id, link?.sats_status]);

  async function getQuote() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/sandbox/grid-links/${id}/quote`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Grid kon geen quote maken.");
      setLink(data as GridLink);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Grid kon geen quote maken.");
    } finally {
      setBusy(false);
    }
  }

  async function simulatePayment() {
    setBusy(true);
    setError("");
    try {
      if (!session) throw new Error("Kies eerst de testbetaler.");
      const response = await fetch(`${API_BASE_URL}/api/sandbox/grid-links/${id}/simulate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "De sandboxbetaling kon niet worden gestart.");
      setLink(data as GridLink);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De sandboxbetaling kon niet worden gestart.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-[32px] border border-orange-200 bg-white p-7 shadow-[0_24px_80px_rgba(194,65,12,0.12)]">
        <Link href="/" className="mb-5 block text-sm font-bold text-orange-700">← Terug naar Satsway</Link>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-orange-700">Satsway · testlink</span>
        <h1 className="mt-5 text-3xl font-black">Betaalverzoek in dollars</h1>
        {link ? <>
          <p className="mt-4 text-5xl font-black">{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "USD" }).format(link.amount_usd)}</p>
          <p className="mt-3 text-sm text-slate-600">Ontvanger: {link.owner_name ?? "testgebruiker"} · {link.lightning_address}</p>
          <div className="mt-5 rounded-2xl bg-orange-50 p-4 text-sm">
            <p className="font-bold">Ingelogd als: {session?.user.name ?? "niemand"}</p>
            <p className="mt-1 text-xs text-slate-600">Kies het andere testaccount dan de ontvanger. De Grid-test gebruikt fictieve dollars uit het platformaccount.</p>
            <label className="mt-3 block text-xs font-bold text-slate-600">{DEMO_MODE ? "Toegangscode voor deze demo" : "Toegangscode voor gedeelde demo (lokaal niet nodig)"}
              <input type="password" autoComplete="off" value={demoCode} onChange={(event) => setDemoCode(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-orange-100 bg-white px-3 text-sm" />
            </label>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => choosePersona("noor")} disabled={busy} className="rounded-xl bg-white px-4 py-2 font-bold text-orange-800">Noor</button>
              <button type="button" onClick={() => choosePersona("sam")} disabled={busy} className="rounded-xl bg-white px-4 py-2 font-bold text-orange-800">Sam</button>
            </div>
          </div>
          <div className="mt-7 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
            <p><strong>Testdollars:</strong> {{ not_paid: "nog niet gestort", funding: "storting loopt", simulated_received: "ontvangen in sandbox", needs_review: "status moet worden nagekeken" }[link.fiat_status]}</p>
            <p><strong>Grid-uitbetaling:</strong> {{ not_sent: "nog niet gestart", processing: "wordt verwerkt", completed: "afgerond in sandbox", failed: "mislukt" }[link.sats_status]}</p>
            {link.payer_name && <p><strong>Testbetaler:</strong> {link.payer_name}</p>}
          </div>
          {link.quote_id && link.quote_sats !== null ? <div className="mt-5 rounded-2xl bg-orange-50 p-4"><p className="text-sm font-bold text-orange-800">Grid sandboxquote</p><p className="mt-1 text-3xl font-black">{link.quote_sats.toLocaleString("nl-NL")} sats</p><p className="mt-2 text-sm">Kosten: ${((link.quote_fee_cents ?? 0) / 100).toFixed(2)} · geldig tot {link.quote_expires_at ? new Date(link.quote_expires_at).toLocaleTimeString("nl-NL") : "—"}</p></div> : null}
          {link.fiat_status === "not_paid" && <>
            <button onClick={getQuote} disabled={busy} className="mt-6 w-full rounded-2xl bg-orange-600 px-5 py-4 font-black text-white disabled:opacity-50">{busy ? "Grid vragen…" : link.quote_id ? "Vernieuw quote na verloop" : "Bekijk echte Grid-quote"}</button>
            {link.quote_id && <button onClick={simulatePayment} disabled={busy || !session || session.user.id === link.owner_user_id} className="mt-3 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white disabled:opacity-50">{busy ? "Sandbox verwerken…" : "Simuleer betaling met testdollars"}</button>}
          </>}
          {link.last_error && <p className="mt-4 text-xs text-red-700">Grid-melding: {link.last_error}</p>}
          <p className="mt-4 text-xs leading-5 text-slate-500">Alleen sandboxgeld. Er is geen echte bankbetaling gedaan. Een afgeronde Grid-transactie naar dit voorbeeldadres bewijst niet dat sats in een echte wallet zijn aangekomen.</p>
        </> : <p className="mt-5 text-sm text-slate-600">Link laden…</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </div>
    </main>
  );
}
