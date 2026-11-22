"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatEuro } from "@/lib/satsway";

const receiptItems = [
  { name: "Flat white", amount: 4.2 },
  { name: "Lunch bowl", amount: 13.5 },
  { name: "Frites tafel", amount: 7.8 },
  { name: "Service", amount: 2.5 },
];

export default function ScanReceiptPage() {
  const [hasScanned, setHasScanned] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const total = receiptItems.reduce((sum, item) => sum + item.amount, 0);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    setCameraError("");
    setIsStartingCamera(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Je browser ondersteunt camera scannen niet.");
      setIsStartingCamera(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
    } catch {
      setCameraError("Camera toegang geweigerd of niet beschikbaar.");
    } finally {
      setIsStartingCamera(false);
    }
  }

  function scanReceipt() {
    setHasScanned(true);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  }

  return (
    <main className="min-h-screen bg-[#edf3ef] px-4 py-5 text-slate-950">
      <section className="mx-auto min-h-[calc(100vh-40px)] w-full max-w-[430px] rounded-[34px] bg-[#f8faf9] px-5 py-6 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl font-black shadow-sm"
          >
            ‹
          </Link>
          <div>
            <p className="text-sm font-semibold text-emerald-700">Bon scannen</p>
            <h1 className="text-3xl font-black tracking-normal">Scan je bon</h1>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[32px] bg-slate-950 p-4 text-white shadow-xl shadow-slate-900/20">
          <div className="relative flex h-[430px] flex-col justify-between overflow-hidden rounded-[24px] border border-white/20 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.28),transparent_35%),linear-gradient(180deg,#0f172a,#020617)] p-5">
            {isCameraActive && (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {isCameraActive && (
              <div className="pointer-events-none absolute inset-0 bg-slate-950/20">
                <div className="absolute left-1/2 top-20 h-56 w-40 -translate-x-1/2 rounded-3xl border-2 border-emerald-300 shadow-[0_0_0_999px_rgba(2,6,23,0.35)]" />
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="relative z-10 rounded-full bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur">
                {isCameraActive ? "Live camera" : "Camera"}
              </span>
              <span className="relative z-10 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
            </div>

            {!isCameraActive && (
              <div className="relative z-10 mx-auto flex h-56 w-40 rotate-[-3deg] flex-col rounded-2xl bg-white p-4 text-slate-950 shadow-2xl">
                <div className="mx-auto mb-4 h-2 w-16 rounded-full bg-slate-200" />
                <div className="space-y-2">
                  {receiptItems.map((item) => (
                    <div key={item.name} className="flex justify-between text-[11px]">
                      <span>{item.name}</span>
                      <span>{formatEuro(item.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto border-t border-dashed border-slate-300 pt-3 text-sm font-black">
                  Totaal {formatEuro(total)}
                </div>
              </div>
            )}

            <div className="relative z-10">
              <p className="text-lg font-black">
                {isCameraActive
                  ? "Plaats je bon binnen het kader"
                  : "Scan je bon en Satsway maakt automatisch een betaalverzoek"}
              </p>
              {cameraError && (
                <p className="mt-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100">
                  {cameraError}
                </p>
              )}
              <button
                type="button"
                onClick={isCameraActive ? scanReceipt : startCamera}
                disabled={isStartingCamera}
                className="mt-4 h-14 w-full rounded-2xl bg-emerald-500 text-base font-black text-slate-950"
              >
                {isStartingCamera
                  ? "Camera openen..."
                  : isCameraActive
                    ? "Maak scan"
                    : "Bon scannen"}
              </button>
            </div>
          </div>
        </div>

        {hasScanned && (
          <div className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500">Gescand resultaat</p>
                <p className="mt-1 text-3xl font-black">{formatEuro(total)}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                3 personen
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {receiptItems.map((item) => (
                <div key={item.name} className="flex justify-between text-sm font-semibold">
                  <span>{item.name}</span>
                  <span>{formatEuro(item.amount)}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Voorgestelde split</p>
              <p className="mt-1 text-xl font-black">{formatEuro(total / 3)} per persoon</p>
            </div>

            <Link
              href={`/create?amount=${total.toFixed(2)}&description=Lunch%20bon`}
              className="mt-4 flex h-14 items-center justify-center rounded-2xl bg-slate-950 font-black text-white"
            >
              Maak split van bon
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
