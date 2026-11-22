"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  amountPerPerson,
  buildShareUrl,
  fetchRequestById,
  formatCurrency,
  getStoredRequest,
  SplitRequest,
  syncRequestStatus,
} from "@/lib/satsway";

export default function RequestResultPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [request, setRequest] = useState<SplitRequest | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsOwner(Boolean(getStoredRequest(id)));

    async function loadRequest() {
      const loadedRequest = await fetchRequestById(id);
      if (!isMounted) {
        return;
      }

      if (loadedRequest) {
        setRequest(loadedRequest);
        syncRequestStatus(loadedRequest).then((updatedRequest) => {
          if (isMounted) {
            setRequest(updatedRequest);
          }
        });
      }
    }

    loadRequest();

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

  const firstShare = request?.shares[0];
  const paidCount = request?.paidCount ?? 0;
  const totalCount = request?.shares.length || request?.participants || 1;
  const progressPercent = Math.round((paidCount / totalCount) * 100);
  const shareUrl = useMemo(() => buildShareUrl(id, firstShare?.id), [id, firstShare?.id]);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Betaal je Satsway verzoek hier: ${shareUrl}`,
  )}`;

  async function copyLink() {
    await copyText(shareUrl);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  async function copyShareLink(shareId: string) {
    await copyText(buildShareUrl(id, shareId));
    setCopiedShareId(shareId);
    window.setTimeout(() => setCopiedShareId(null), 1800);
  }

  if (!request) {
    return (
      <main className="app-canvas">
        <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[430px] items-center justify-center rounded-[34px] bg-[#f8faf9] p-6 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
          <div className="rounded-[28px] bg-white p-6 text-center shadow-sm">
            <p className="text-3xl">⌁</p>
            <h1 className="mt-3 text-xl font-black">Verzoek niet gevonden</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Maak een nieuwe split om een deelbare link te genereren.
            </p>
            <Link
              href="/create"
              className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 font-black text-white"
            >
              Nieuwe split
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-canvas">
      <section className="app-surface px-5 py-6">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl font-black shadow-sm"
          >
            ‹
          </Link>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">
            Status: {request.status === "paid" ? "betaald" : "pending"}
          </span>
        </div>

        {isOwner && (
          <div className="mb-5 rounded-[24px] bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
            Jij hebt dit betaalverzoek gemaakt
          </div>
        )}

        <div className="relative overflow-hidden rounded-[32px] bg-[#281b14] p-6 text-white shadow-xl shadow-[#281b14]/20">
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full border border-white/15" />
          <p className="eyebrow text-[#ffbd6e]">JOUW BETAALVERZOEK</p>
          <h1 className="mt-3 text-5xl font-black tracking-normal">
            {formatCurrency(request.amount, "EUR")}
          </h1>
          <p className="mt-3 text-lg font-bold text-slate-200">
            {request.description || "Satsway verzoek"}
          </p>
          {request.settlementCurrency === "BTC" && (
            <p className="mt-3 text-sm font-bold text-orange-200">
              Ontvang in sats · Grid-betaling nog niet beschikbaar
            </p>
          )}

          <div className="mt-6 rounded-[24px] bg-white/8 p-4">
            <div className="flex justify-between text-sm font-bold">
              <span>{paidCount} van {totalCount} betalingen voltooid</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-3 h-3 rounded-full bg-white/10">
              <div
                className="h-3 rounded-full bg-emerald-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-600">Links per ontvanger</p>
          <div className="mt-4 space-y-2">
            {request.shares.map((share) => (
              <div
                key={share.id}
                className="rounded-2xl bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">
                      Stuur deze link naar persoon {share.position}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      {formatCurrency(Number(share.amount_eur), "EUR")} · {share.status}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                    {share.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyShareLink(share.id)}
                  className="mt-3 h-10 w-full rounded-xl bg-slate-950 px-4 text-xs font-black text-white"
                >
                  {copiedShareId === share.id ? "Gekopieerd" : "Kopieer link"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-600">
            Eerste betaallink
          </p>
          <p className="mt-3 break-all rounded-2xl bg-slate-50 p-4 font-mono text-xs text-slate-600">
            {shareUrl}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="h-12 rounded-2xl bg-slate-950 text-sm font-black text-white"
            >
              {copyState === "copied" ? "Gekopieerd" : "Kopieer link"}
            </button>
            <a
              href={whatsappUrl}
              className="flex h-12 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-black text-white"
            >
              WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[140px_1fr] gap-4">
          <div className="grid aspect-square place-items-center rounded-[28px] bg-white p-4 shadow-sm">
            <div className="grid h-full w-full grid-cols-5 grid-rows-5 gap-1">
              {Array.from({ length: 25 }).map((_, index) => (
                <span
                  key={index}
                  className={`rounded-sm ${
                    [0, 1, 3, 4, 6, 8, 12, 16, 18, 20, 21, 23, 24].includes(index)
                      ? "bg-slate-950"
                      : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-600">Per persoon</p>
            <p className="mt-2 text-2xl font-black">
              {formatCurrency(
                amountPerPerson(request.amount, request.participants),
                "EUR",
              )}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {request.participants} ontvanger{request.participants === 1 ? "" : "s"} kunnen kiezen voor euro of bitcoin.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}
