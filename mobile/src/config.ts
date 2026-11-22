import type { AwarenessContent, Poster, Sponsor } from "./types";

export const API_BASE_URL = "http://134.98.148.12";
export const STORAGE_KEY = "satsway.mobile.requests";
export const BITCOIN_ORANGE = "#F7931A";

export const FEATURE_FLAGS = {
  sponsorLayer: true,
  educationHints: true,
  analytics: true,
  analyticsCharts: true,
  analyticsDebug: true,
  analyticsQueue: true,
  simulationMode: true,
  autoOptimizeAwareness: true,
};

export const SPONSORS: Sponsor[] = [
  {
    id: "sponsor-river",
    name: "River",
    type: "exchange",
    subtleStyle: "soft-green",
  },
  {
    id: "sponsor-strategy",
    name: "Strategy",
    type: "education",
    subtleStyle: "quiet-navy",
  },
  {
    id: "sponsor-miner-demo",
    name: "Bitcoin miner demo",
    type: "miner",
    subtleStyle: "warm-grid",
  },
];

export const AWARENESS_CONTENT_POOL: AwarenessContent[] = [
  {
    id: "edu-global-payments",
    type: "education",
    label: "Bitcoin tip",
    text: "Je kunt wereldwijd betalen zonder bank.",
    accent: "bitcoin",
    variant: "A",
  },
  {
    id: "awareness-river",
    type: "sponsor",
    sponsor: SPONSORS[0],
    variant: "A",
  },
  {
    id: "edu-no-middleman",
    type: "education",
    label: "Wist je dat?",
    text: "BTC betalingen werken zonder tussenpartij.",
    accent: "lightning",
    variant: "B",
  },
  {
    id: "awareness-strategy",
    type: "sponsor",
    sponsor: SPONSORS[1],
    variant: "B",
  },
  {
    id: "edu-sats",
    type: "education",
    label: "Sats",
    text: "1 BTC = 100.000.000 sats.",
    accent: "sats",
    variant: "A",
  },
];

export const DEMO_POSTERS: Poster[] = [
  {
    title: "Bitcoin betalen, euro ontvangen",
    text: "Satsway rekent de waarde om op het moment van betalen. Jij kiest hoe je wilt ontvangen.",
    image_url: "",
    sponsor_name: "Satsway Learn",
    sponsor_url: null,
    theme: "education",
  },
  {
    title: "Lightning voor kleine betalingen",
    text: "Snel, laag in kosten en ideaal voor betaalverzoeken tussen vrienden.",
    image_url: "",
    sponsor_name: "Voorbeeld partner",
    sponsor_url: null,
    theme: "bitcoin",
  },
  {
    title: "Sponsorplek voor BTC bedrijven",
    text: "Nette poster, geen harde advertentie. Zichtbaar rond betaalmomenten en success-schermen.",
    image_url: "",
    sponsor_name: "River demo",
    sponsor_url: null,
    theme: "sponsor",
  },
];
