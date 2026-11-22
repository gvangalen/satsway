import type { Currency, Rates } from "../types";

export function formatCurrency(amount: number, currency: Currency) {
  if (currency === "BTC") {
    return `${amount.toFixed(8)} BTC`;
  }

  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDisplayAmount(amountEur: number, currency: Currency, rates: Rates) {
  if (currency === "EUR") {
    return formatCurrency(amountEur, "EUR");
  }

  if (currency === "USD") {
    return formatCurrency(amountEur / rates.usd_eur, "USD");
  }

  const btc = amountEur / rates.btc_eur;
  const sats = Math.round(btc * 100_000_000);
  return `≈ ${btc.toFixed(8)} BTC (${sats.toLocaleString("nl-NL")} sats)`;
}
