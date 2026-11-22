"use client";

import { useEffect, useState } from "react";

const posters = [
  {
    eyebrow: "Voorbeeldadvertentie · geen sponsor",
    brand: "NORTH / NODE",
    title: "Bitcoin beweegt mee.",
    detail: "Een plek voor je eerste stappen met sats.",
    kind: "sponsor",
  },
  {
    eyebrow: "Bitcoin uitgelegd · Satsway",
    brand: "LEER IN 30 SEC",
    title: "Wat zijn sats?",
    detail: "Een sat is een klein deel van één bitcoin. Handig voor alledaagse bedragen.",
    kind: "learn",
  },
  {
    eyebrow: "Voorbeeldadvertentie · geen sponsor",
    brand: "SAT / STUDIO",
    title: "Kleine bedragen. Groot idee.",
    detail: "Een conceptposter voor een toekomstige Bitcoin-partner.",
    kind: "studio",
  },
] as const;

export default function PosterCarousel({ backdrop = false }: { backdrop?: boolean }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActive((current) => (current + 1) % posters.length);
    }, 5500);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className={`poster-carousel ${backdrop ? "poster-carousel--backdrop" : ""}`}
      aria-label={backdrop ? undefined : "Voorbeeldposters en Bitcoin-uitleg"}
      aria-hidden={backdrop || undefined}>
      {posters.map((poster, index) => (
        <div key={poster.brand}
          className={`poster-slide poster-slide--${poster.kind} ${active === index ? "is-active" : ""}`}>
          <div className="poster-grain" />
          <div className="poster-orbit poster-orbit--one" />
          <div className="poster-orbit poster-orbit--two" />
          <div className="poster-content">
            <p className="poster-eyebrow">{poster.eyebrow}</p>
            <p className="poster-brand">{poster.brand}</p>
            <h2 className="poster-title">{poster.title}</h2>
            <p className="poster-detail">{poster.detail}</p>
          </div>
          <span className="poster-mark" aria-hidden="true">₿</span>
        </div>
      ))}
      {!backdrop && (
        <div className="poster-controls" aria-label="Kies een voorbeeldposter">
          {posters.map((poster, index) => (
            <button key={poster.brand} type="button" onClick={() => setActive(index)}
              className={active === index ? "is-active" : ""}
              aria-label={`Toon poster ${index + 1}`} aria-current={active === index ? "true" : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
