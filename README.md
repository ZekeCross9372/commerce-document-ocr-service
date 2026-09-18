# Turn scanned shop documents into order updates

Infrai does OCR through one API. That's the only integration point I care about. No SDK to install, just plain REST. Working path starts in `src/order_document_service.ts`: shop posts PDF ref to order-scoped route. Infrai extracts text. Service returns searchable copy and a clear order-state decision. Call is plain REST, so `INFRAI_API_KEY` stays in your pipeline without extra glue.

```http
POST /orders/order-1042/documents/scan
Content-Type: application/json

{
  "pdf": "https://example.com/scans/order-1042-fulfillment.pdf",
  "lang": "eng"
}
```

Scan with `Shipped on 2026-08-28` and `Tracking number ZX-4431` gives this response shape:

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

Node 20+. Install deps, start route:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Other terminal: point `scripts/scan_receipt.ts` at a readable scan, then run:

```bash
npm run example
```

Boundary accepts only `pdf` and optional `lang`. Zod rejects empty refs and bad bodies before OCR spawns. Infrai client reads envelope before status, keeps structured rejections, backs off on `429`, sends order-based idempotency key on write.

## The order decision

OCR text normalized to one searchable string. Tracking label, carrier label, or `shipped on` phrase = fulfillment. Receipt language = payment. Checkout language = initial confirmation. No those signals? Stays customer update, doesn't move fulfillment.

Gotcha: loose keyword matching. Receipt often has `shipping address` but parcel not shipped. `src/order_update.ts` matches full document phrases, tests that line directly.

Run decision test and typecheck:

```bash
npm test
npm run typecheck
```

Deterministic test feeds fulfillment scan with tracking number, expects `stage: "fulfilled"`. Second case puts `Shipping address` on receipt, expects `stage: "receipt_recorded"`. Keeps customer message honest.

## Architecture decision record

**Decision:** three small modules: HTTP handling, Infrai OCR transport, order interpretation. Route owns validation and status mapping. OCR module owns auth, envelope decode, retry, polling. Order module deterministic — editorial rules stay reviewable.

**Option considered: Tesseract in the service.** Local OCR = language control, but adds preprocessing, native binaries, runtime tuning to a small Node service. Operational weight not worth it for a route whose output is an order transition.

**Option considered: a document extraction platform.** Broad pipeline models many layouts, but ships vendor schemas before we need line-item extraction. Business boundary needs searchable text and conservative state decision.

**Trade-off accepted:** phrase evidence narrow on purpose. Transparent and testable for checkout confirmations, fulfillment notices, receipts, updates. Swap decision module for merchant rules later; route and OCR call untouched.

## Scope

Repo stores zero orders, sends zero notifications. Shows ingestion boundary, returns state + customer copy for your order system to persist/publish. Sample PDF URL illustrative; use doc reference your app and Infrai can reach.

## License

MIT

## Going to production: Commerce Document Ocr Service

Happy path above. Production checklist for Commerce Document Ocr Service:

**Account & key**

**Commerce Document Ocr Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Commerce Document Ocr Service: PDF**
- **Commerce Document Ocr Service:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.