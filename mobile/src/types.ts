export type Screen = "home" | "create" | "request" | "pay" | "scan" | "requests" | "wallet" | "gridSandbox";
export type TabScreen = "home" | "create" | "scan" | "requests" | "wallet";
export type Currency = "EUR" | "USD" | "BTC";
export type RequestStatus = "pending" | "paid" | "expired";

export type Poster = {
  title: string;
  text: string;
  image_url: string;
  sponsor_name: string | null;
  sponsor_url: string | null;
  theme?: "bitcoin" | "sponsor" | "education";
};

export type Sponsor = {
  id: string;
  name: string;
  type: "miner" | "exchange" | "education";
  subtleStyle: string;
};

export type AwarenessContent =
  | {
      id: string;
      type: "education";
      text: string;
      label: string;
      accent: "bitcoin" | "lightning" | "sats";
      variant?: "A" | "B";
    }
  | {
      id: string;
      type: "sponsor";
      sponsor: Sponsor;
      variant?: "A" | "B";
    };

export type PaymentShare = {
  id: string;
  request_id: string;
  position: number;
  amount_eur: number;
  status: RequestStatus;
  paid_at: string | null;
  locked_sats?: number | null;
  locked_rate?: string | number | null;
  locked_at?: string | null;
  invoice_id?: string | null;
  invoice_expires_at?: string | null;
  lightning_invoice?: string | null;
  created_at: string;
};

export type SplitRequest = {
  id: string;
  amount: number;
  settlementCurrency: Currency;
  description: string;
  participants: number;
  splitMode: "even" | "custom";
  status: RequestStatus;
  checkoutUrl?: string;
  createdAt: string;
  poster?: Poster | null;
  paidCount: number;
  shares: PaymentShare[];
};

export type Rates = {
  base: "EUR";
  btc_eur: number;
  usd_eur: number;
  source: string;
  updated_at: string;
};

export type BtcQuote = {
  quote_id: string;
  amount_eur: string | number;
  btc_amount: string | number;
  sats: number;
  rate: string | number;
  source: string;
  updated_at: string;
  expires_at: string;
  request_id?: string | null;
  share_id?: string | null;
};

export type BackendRequest = {
  id: string;
  amount_eur: string | number;
  settlement_currency?: Currency;
  description: string | null;
  status: RequestStatus;
  participant_count?: number;
  paid_count?: number;
  shares?: PaymentShare[];
  created_at: string;
  poster?: Poster | null;
};
