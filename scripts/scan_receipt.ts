export {};

const response = await fetch("http://localhost:3000/orders/order-1042/documents/scan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    pdf: "https://example.com/scans/order-1042-receipt.pdf",
    lang: "eng",
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));
