"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE_URL, AuthSession, getAuthSession, loginSandboxPersona } from "@/lib/satsway";

export default function GridSandboxStart() {
  const [amount, setAmount] = useState("18.50");
  const [address, setAddress] = useState("recipient@example.com");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [demoCode, setDemoCode] = useState("");
  const [links, setLinks] = useState<Array<{ id: string; amount_usd: number; owner_name: string | null; payer_name: string | null; sats_status: string }>>([]);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setSession(getAuthSession()), []);
  useEffect(() => {
    if (!session) { setLinks([]); return; }
    fetch(`${API_BASE_URL}/api/sandbox/grid-links/mine`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [session]);

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

  async function createLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setLink("");
    try {
      if (!session) throw new Error("Kies eerst een testgebruiker.");
      const response = await fetch(`${API_BASE_URL}/api/sandbox/grid-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ amount_usd: amount, lightning_address: address }),
      });
      if (!response.ok) throw new Error("De sandboxlink kon niet worden gemaakt.");
      const data = (await response.json()) as { id: string; amount_usd: number; owner_name: string | null; payer_name: string | null; sats_status: string };
      setLink(`${window.location.origin}/pay/grid/${data.id}`);
      setLinks((current) => [data, ...current]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-[32px] border border-orange-200 bg-white p-7 shadow-[0_24px_80px_rgba(194,65,12,0.12)]">
        <Link href="/" className="text-sm font-bold text-orange-700">← Terug naar Satsway</Link>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-orange-700">Satsway · Grid sandbox</span>
        <h1 className="mt-5 text-3xl font-black">Maak een USD-testlink</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Test de Satsway-flow met twee lokale gebruikers. Noor maakt de link; Sam simuleert de betaling met fictieve dollars via Grid.</p>
        <div className="mt-5 rounded-2xl bg-orange-50 p-4 text-sm">
          <p className="font-bold">Huidige gebruiker: {session?.user.name ?? "niemand"}</p>
          <label className="mt-3 block text-xs font-bold">Toegangscode voor gedeelde demo (lokaal niet nodig)
            <input type="password" autoComplete="off" value={demoCode} onChange={(event) => setDemoCode(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-orange-100 bg-white px-3" />
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => choosePersona("noor")} disabled={busy} className="rounded-xl bg-white px-4 py-2 font-bold text-orange-800 shadow-sm">Test als Noor</button>
            <button type="button" onClick={() => choosePersona("sam")} disabled={busy} className="rounded-xl bg-white px-4 py-2 font-bold text-orange-800 shadow-sm">Test als Sam</button>
          </div>
        </div>
        <form onSubmit={createLink} className="mt-7 space-y-5">
          <label className="block text-sm font-bold">Bedrag in USD
            <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label className="block text-sm font-bold">Lightning-adres van ontvanger
            <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" type="text" placeholder="naam@wallet.nl" value={address} onChange={(event) => setAddress(event.target.value)} required />
          </label>
          <p className="text-xs text-slate-500">Het voorgevulde voorbeeldadres is alleen voor de Grid-sandbox. Het ontvangt geen echte sats.</p>
          <button disabled={busy || !session} className="w-full rounded-2xl bg-orange-600 px-5 py-4 font-black text-white disabled:opacity-50">{busy ? "Link maken…" : "Maak testlink"}</button>
        </form>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {link && <div className="mt-6 rounded-2xl bg-orange-50 p-4 text-sm"><p className="font-bold">Testlink klaar</p><a className="mt-2 block break-all font-semibold text-orange-700 underline" href={link}>{link}</a><button className="mt-3 font-bold text-orange-700 underline" onClick={() => navigator.clipboard.writeText(link)}>Kopieer link</button></div>}
        {session && <div className="mt-7 border-t border-orange-100 pt-6">
          <h2 className="text-lg font-black">Jouw testlinks</h2>
          {links.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nog geen links voor {session.user.name}.</p> : <div className="mt-3 space-y-2">
            {links.map((item) => <Link key={item.id} href={`/request/grid/${item.id}`} className="flex justify-between rounded-2xl bg-slate-50 p-4 text-sm">
              <span className="font-bold">{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "USD" }).format(item.amount_usd)} · {item.owner_name ?? "Ontvanger"} → {item.payer_name ?? "nog open"}</span>
              <span className="text-orange-700">{item.sats_status === "completed" ? "afgerond" : "open"} ↗</span>
            </Link>)}
          </div>}
        </div>}
      </div>
    </main>
  );
}
