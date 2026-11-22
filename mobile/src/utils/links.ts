import { API_BASE_URL } from "../config";
import type { PaymentShare, SplitRequest } from "../types";

export function buildWebPayLink(request: SplitRequest, share?: PaymentShare) {
  return `${API_BASE_URL}/pay/${request.id}${share ? `?share=${share.id}` : ""}`;
}

export function buildAppPayLink(request: SplitRequest, share?: PaymentShare) {
  return `satsway:///pay/${request.id}${share?.id ? `/${share.id}` : ""}`;
}

export function buildShareMessage(request: SplitRequest, share?: PaymentShare) {
  const amount = share ? `€ ${Number(share.amount_eur).toFixed(2).replace(".", ",")}` : `€ ${request.amount.toFixed(2).replace(".", ",")}`;

  return [
    `Je hebt een Satsway betaalverzoek ontvangen voor ${amount}.`,
    `Open in de app: ${buildAppPayLink(request, share)}`,
    `Of betaal via web: ${buildWebPayLink(request, share)}`,
  ].join("\n");
}
