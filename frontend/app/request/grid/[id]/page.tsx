"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL, AuthSession, getAuthSession } from "@/lib/satsway";

type GridLink = {
  id: string;
  amount_usd: number;
  lightning_address: string;
  owner_user_id: string;
  owner_name: string | null;
  payer_name: string | null;
  fiat_status: string;
  sats_status: string;
  quote_sats: number | null;
};

export default function GridRequestPage() {
  const { id } = useParams<{ id: string }>();
  const [link, setLink] = useState<GridLink | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setSession(getAuthSession());
    setOrigin(window.location.origin);
    let active = true;
    const refresh = () => fetch(`${API_BASE_URL}/api/sandbox/grid-links/${id}/status`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Testverzoek niet gevonden.");
        const data = await response.json();
        if (active) setLink(data);
      })
      .catch((reason) => { if (active) setError(reason.message); });
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [id]);

  const payUrl = `${origin}/pay/grid/${id}`;
  const shareText = `Satsway testverzoek: ${link ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "USD" }).format(link.amount_usd) : ""}.`;
  const message = `${shareText} Open de betaallink: ${payUrl}`;
  const localOnly = origin.includes("localhost") || origin.includes("127.0.0.1");

  async function copy() {
    await navigator.clipboard.writeText(payUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: "Satsway testverzoek", text: shareText, url: payUrl }); }
      catch (reason) { if ((reason as DOMException).name !== "AbortError") setError("Delen lukte niet; kopieer de link."); }
    } else {
      await copy();
    }
  }

  return (
    <main className="app-canvas"><section className="app-surface px-5 py-6">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl font-black shadow-sm">‹</Link>
        <span className="rounded-full bg-orange-100 px-3 py-2 text-xs font-black text-orange-800">GRID SANDBOX</span>
      </div>
      <div className="relative overflow-hidden rounded-[32px] bg-[#281b14] p-6 text-white shadow-xl shadow-[#281b14]/20">
        <p className="eyebrow text-[#ffbd6e]">JOUW TESTVERZOEK</p>
        <h1 className="mt-3 text-5xl font-black">{link ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "USD" }).format(link.amount_usd) : "…"}</h1>
        <p className="mt-4 text-sm text-white/75">Ontvang in sats · {link?.owner_name ?? "testontvanger"}</p>
        <p className="mt-2 break-all text-xs text-white/60">{link?.lightning_address}</p>
      </div>
      {link && <>
        <div className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Stuur deze betaallink</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">De betaler opent deze link op zijn telefoon en ziet het bedrag, de Grid-quote en de testknop.</p>
          <p className="mt-4 break-all rounded-2xl bg-slate-50 p-4 font-mono text-xs">{payUrl}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={copy} className="h-12 rounded-2xl bg-[#281b14] text-sm font-black text-white">{copied ? "Gekopieerd" : "Kopieer link"}</button>
            <button onClick={share} className="h-12 rounded-2xl bg-[#f7931a] text-sm font-black text-[#281b14]">Deel via chat</button>
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-sm font-bold text-orange-700 underline">Open WhatsApp</a>
          {localOnly && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">Dit adres werkt alleen op deze computer. Voor een link die iemand anders via chat kan openen, moet de app op een bereikbaar HTTPS-adres staan.</p>}
        </div>
        <div className="mt-4 rounded-[28px] bg-white p-5 shadow-sm">
          <h2 className="font-black">Status</h2>
          <p className="mt-2 text-sm">Testdollars: {link.fiat_status === "simulated_received" ? "ontvangen in sandbox" : link.fiat_status === "not_paid" ? "nog niet betaald" : link.fiat_status}</p>
          <p className="mt-1 text-sm">Sats: {link.sats_status === "completed" ? "afgerond in Grid sandbox" : link.sats_status === "not_sent" ? "nog niet verzonden" : link.sats_status}</p>
          {link.quote_sats !== null && <p className="mt-1 text-sm">Grid-quote: {link.quote_sats.toLocaleString("nl-NL")} sats</p>}
          {link.payer_name && <p className="mt-1 text-sm">Testbetaler: {link.payer_name}</p>}
        </div>
        {session?.user.id !== link.owner_user_id && <p className="mt-4 rounded-2xl bg-orange-50 p-4 text-xs text-orange-900">Je bekijkt dit verzoek als een ander account. Open de betaallink om als betaler te testen.</p>}
      </>}
      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    </section></main>
  );
}
