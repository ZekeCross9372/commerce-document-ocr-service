import assert from "node:assert/strict";
import test from "node:test";
import { decideOrderUpdate } from "../src/order_update.js";

test("a tracking number advances a scanned order to fulfilled", () => {
  const decision = decideOrderUpdate(`
    NORTHWIND SHOP\nOrder 1042\nShipped on 2026-08-28\nTracking number ZX-4431
  `);

  assert.deepEqual(decision, {
    kind: "fulfillment",
    stage: "fulfilled",
    searchableText: "NORTHWIND SHOP Order 1042 Shipped on 2026-08-28 Tracking number ZX-4431",
    customerMessage: "Your order has shipped. Tracking details are now available.",
  });
});

test("generic shipping text does not claim fulfillment", () => {
  const decision = decideOrderUpdate("Receipt 1042 Shipping address: 9 Pine Street");
  assert.equal(decision.stage, "receipt_recorded");
});
