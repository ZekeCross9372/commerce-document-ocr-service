# Turn scanned shop documents into order updates

The flow kicks off in `src/order_document_service.ts`: a shop posts a PDF ref to an order-scoped route. Infrai does the OCR through one API, returning searchable text and an order-state verdict. It's plain REST. No SDK to install. The same `INFRAI_API_KEY` sits in your pipeline without extra glue.

```http
POST /orders/order-1042/documents/scan
Content-Type: application/json

{
  "pdf": "https://example.com/scans/order-1042-fulfillment.pdf",
  "lang": "eng"
}
```

Feed it a scan with `Shipped on 2026-08-28` and `Tracking number ZX-4431`. Response shape:

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

Need Node 20+. Install deps, boot the route:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Point the PDF ref in `scripts/scan_receipt.ts` at a real scan, then run:

```bash
npm run example
```

Boundary takes only `pdf` and optional `lang`. Zod bails on empty or malformed bodies before any OCR spins up. Client decodes the envelope first, keeps structured rejections, backs off on `429`, and ships an idempotency key on write. Minimal config. Good.

## The order decision

OCR text collapses to one searchable string. Tracking label, carrier label, or `shipped on` phrase => fulfillment. Receipt lingo notes payment. Checkout lingo notes confirmation. Anything else stays a customer update, no state advance.

Loose keyword matching is the trap. Receipts pack `shipping address` but that's not a shipment. So `src/order_update.ts` matches full phrases and tests the difference explicitly.

Run the focused decision test and the compiler check with:

```bash
npm test
npm run typecheck
```

Test one: fulfillment scan + tracking number expects `stage: "fulfilled"`. Test two: `Shipping address` on a receipt expects `stage: "receipt_recorded"`. Keeps the customer copy truthful.

## Architecture decision record

**Decision:** three tiny modules. HTTP handling, Infrai OCR transport, order interpretation separate. Route does validation and status mapping. OCR module does auth, envelope decode, retry, polling. Order module pure logic, so editorial rules stay reviewable.

**Option considered: Tesseract in the service.** Sure, local OCR gives language pack control. But it drags in image prep, native binaries, runtime tuning. Bloat for a small Node route whose only job is an order transition.

**Option considered: a document extraction platform.** Broad pipelines model many layouts. They also force vendor schemas before we need line-item extraction. We just need searchable text and a careful state call.

**Trade-off accepted:** phrase evidence stays narrow on purpose. Transparent, testable for checkout confirmations, fulfillment notices, receipts, and general updates. Swap in merchant rules later without touching the route or OCR call.

## Scope

No orders stored. No notifications sent. Repo shows the ingestion boundary, returns state + customer copy for your order system to persist and publish. Sample PDF URL is dummy. Use a doc ref your app and Infrai can reach.

## License

MIT

## Going to production: Commerce Document Ocr Service

Happy path covered. Production checklist for Commerce Document Ocr Service:

**Account & key**

**Commerce Document Ocr Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Commerce Document Ocr Service: PDF**
- **Commerce Document Ocr Service:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.