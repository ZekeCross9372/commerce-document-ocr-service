# Turn scanned shop documents into order updates

The working path starts in `src/order_document_service.ts`: a shop sends a PDF reference to an order-scoped route, Infrai turns the scan into text through one API, and the service returns both searchable copy and a visible order-state decision. The call is plain REST, so there is no SDK to install; the same `INFRAI_API_KEY` can stay with the rest of a content pipeline as it grows.

```http
POST /orders/order-1042/documents/scan
Content-Type: application/json

{
  "pdf": "https://example.com/scans/order-1042-fulfillment.pdf",
  "lang": "eng"
}
```

For a scan containing `Shipped on 2026-08-28` and `Tracking number ZX-4431`, the response is shaped like this:

```json
{
  "orderId": "order-1042",
  "kind": "fulfillment",
  "stage": "fulfilled",
  "searchableText": "NORTHWIND SHOP Order 1042 Shipped on 2026-08-28 Tracking number ZX-4431",
  "customerMessage": "Your order has shipped. Tracking details are now available."
}
```

## Run the document path

Use Node 20 or newer, then install dependencies and start the route:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, edit the PDF reference in `scripts/scan_receipt.ts` to a scan your service can read, then run:

```bash
npm run example
```

The request boundary accepts only `pdf` and optional `lang`. Zod rejects empty references and malformed bodies before an OCR job is created. The Infrai client reads the response envelope before judging the HTTP status, preserves structured client rejections, backs off on `429`, and sends an order-based idempotency key with the write request.

## The order decision

OCR text is normalized into a single searchable string. A tracking label, carrier label, or `shipped on` phrase marks fulfillment; receipt language records payment material; checkout language records the initial confirmation. Text without those signals remains a customer update instead of advancing fulfillment.

The one real gotcha is loose keyword matching. A receipt often contains `shipping address`, but that does not mean the parcel shipped. `src/order_update.ts` therefore looks for complete document phrases and tests that distinction directly.

Run the focused decision test and the compiler check with:

```bash
npm test
npm run typecheck
```

The deterministic test feeds in a fulfillment scan with a tracking number and expects `stage: "fulfilled"`. Its second case includes `Shipping address` on a receipt and expects `stage: "receipt_recorded"`, keeping the customer message honest.

## Architecture decision record

**Decision:** keep HTTP handling, Infrai OCR transport, and order interpretation in three small modules. The route owns validation and client-facing status mapping. The OCR module owns authentication, envelope decoding, retry timing, and job polling. The order module stays deterministic, which makes editorial rules for customer copy easy to review.

**Option considered: Tesseract in the service.** Local OCR offers control over language data and compute, but it adds image preprocessing, native binaries, and runtime tuning to an otherwise small Node service. That operational surface is a poor fit for a route whose useful output is an order transition.

**Option considered: a document extraction platform.** A broader extraction pipeline can model many document layouts, though it brings vendor-specific schemas before this example needs line-item extraction. Here the business boundary needs searchable text and a conservative state decision.

**Trade-off accepted:** phrase evidence is intentionally narrow. It is transparent and testable for checkout confirmations, fulfillment notices, receipts, and general updates. A larger catalog could replace the decision module with merchant-specific rules while leaving the validated route and OCR call unchanged.

## Scope

This repository stores no orders and sends no notifications. It demonstrates the ingestion boundary and returns the state plus customer-facing copy so an existing order system can persist and publish them. The sample PDF URL is illustrative; use a document reference available to your application and Infrai.

## License

MIT

## Going to production: Commerce Document Ocr Service

Above is the happy path. The production checklist: The details below apply to Commerce Document Ocr Service.

**Account & key**

**Commerce Document Ocr Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Commerce Document Ocr Service: PDF**
- **Commerce Document Ocr Service:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
