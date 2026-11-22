"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, AuthSession, DEMO_MODE, getAuthSession, loginSandboxPersona } from "@/lib/satsway";

export default function GridCreateForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("18.50");
  const [address, setAddress] = useState("recipient@example.com");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [demoCode, setDemoCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setSession(getAuthSession()), []);

  async function choosePersona(persona: "noor" | "sam") {
    setBusy(true);
    setError("");
    try {
      setSession(await loginSandboxPersona(persona, demoCode));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Testaccount niet beschikbaar.");
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!session) throw new Error("Kies eerst Noor of Sam als ontvanger.");
      const response = await fetch(`${API_BASE_URL}/api/sandbox/grid-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ amount_usd: amount, lightning_address: address.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Testverzoek maken mislukt.");
      router.push(`/request/grid/${data.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Testverzoek maken mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="space-y-4">
      <div className="rounded-[24px] bg-orange-100 p-4 text-sm leading-6 text-orange-950">
        <p className="font-black">Grid sandbox · USD → sats</p>
        <p>Hiermee maak je een echte Satsway-link en test je een Grid-quote en sandboxuitbetaling. De dollars zijn fictief; er wordt geen bankrekening belast.</p>
      </div>
      <div className="rounded-[28px] bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-600">Ontvanger</p>
        <p className="mt-1 text-sm">{session?.user.name ?? "Kies een testaccount"}</p>
        <label className="mt-3 block text-xs font-bold text-slate-600">{DEMO_MODE ? "Toegangscode voor deze demo" : "Toegangscode voor gedeelde demo (lokaal niet nodig)"}
          <input type="password" autoComplete="off" value={demoCode} onChange={(event) => setDemoCode(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["noor", "sam"] as const).map((persona) => (
            <button key={persona} type="button" onClick={() => choosePersona(persona)} disabled={busy}
              className={`h-12 rounded-2xl text-sm font-black ${session?.user.email === `${persona}.demo@example.com` ? "bg-[#f7931a] text-[#281b14]" : "bg-orange-50 text-orange-800"}`}>
              Test als {persona === "noor" ? "Noor" : "Sam"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">De andere testpersoon kan straks de link openen en de betaling simuleren.</p>
      </div>
      <div className="rounded-[28px] bg-white p-5 shadow-sm">
        <label className="block text-sm font-bold text-slate-600">Bedrag in testdollars
          <div className="mt-2 flex items-center rounded-[24px] bg-slate-50 px-4">
            <span className="text-2xl font-black text-slate-400">$</span>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} required min="0.01" step="0.01" type="number" inputMode="decimal"
              className="h-20 w-full bg-transparent px-3 text-4xl font-black outline-none" />
          </div>
        </label>
        <label className="mt-4 block text-sm font-bold text-slate-600">Lightning-adres van ontvanger
          <input value={address} onChange={(event) => setAddress(event.target.value)} required type="text" autoComplete="off"
            className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold outline-none focus:border-orange-500" />
        </label>
        <p className="mt-2 text-xs leading-5 text-slate-500">Het voorbeeldadres is alleen voor de sandbox en ontvangt geen echte sats.</p>
      </div>
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
      <button disabled={busy || !session} className="primary-button h-16 w-full rounded-[24px] font-black disabled:opacity-50">
        {busy ? "Testverzoek maken…" : "Maak deelbare testlink"}
      </button>
    </form>
  );
}
