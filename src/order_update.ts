export type DocumentKind = "checkout" | "fulfillment" | "receipt" | "customer_update";
export type OrderStage = "checked_out" | "fulfilled" | "receipt_recorded" | "update_recorded";

export type OrderDocumentDecision = {
  kind: DocumentKind;
  stage: OrderStage;
  searchableText: string;
  customerMessage: string;
};

const evidence: Array<{
  kind: DocumentKind;
  stage: OrderStage;
  phrases: RegExp[];
  message: string;
}> = [
  {
    kind: "fulfillment",
    stage: "fulfilled",
    phrases: [/\bshipped\s+on\b/i, /\btracking\s+(number|no\.?|id)\b/i, /\bcarrier\b/i],
    message: "Your order has shipped. Tracking details are now available.",
  },
  {
    kind: "receipt",
    stage: "receipt_recorded",
    phrases: [/\breceipt\b/i, /\bamount\s+paid\b/i, /\bpayment\s+(received|approved)\b/i],
    message: "Your receipt has been added to the order record.",
  },
  {
    kind: "checkout",
    stage: "checked_out",
    phrases: [/\border\s+confirmation\b/i, /\bcheckout\b/i, /\bbilling\s+address\b/i],
    message: "Your order is confirmed and being prepared.",
  },
];

export function decideOrderUpdate(text: string): OrderDocumentDecision {
  const searchableText = text.replace(/\s+/g, " ").trim();
  const match = evidence.find((candidate) =>
    candidate.phrases.some((phrase) => phrase.test(searchableText)),
  );

  if (!match) {
    return {
      kind: "customer_update",
      stage: "update_recorded",
      searchableText,
      customerMessage: "A document update has been added to your order.",
    };
  }

  return {
    kind: match.kind,
    stage: match.stage,
    searchableText,
    customerMessage: match.message,
  };
}
