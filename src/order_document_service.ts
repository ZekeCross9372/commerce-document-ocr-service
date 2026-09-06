import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { InfraiError, ocrCommercePdf } from "./infrai_pdf_ocr.js";
import { decideOrderUpdate } from "./order_update.js";

const scanBody = z.object({
  pdf: z.string().min(1),
  lang: z.string().min(2).max(12).default("eng"),
});

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export async function handleScan(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const match = request.url?.match(/^\/orders\/([^/]+)\/documents\/scan$/);
  if (request.method !== "POST" || !match) {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const body = scanBody.parse(await readJson(request));
    const orderId = decodeURIComponent(match[1]);
    const ocr = await ocrCommercePdf(body.pdf, `order-document:${orderId}`, body.lang);
    send(response, 200, { orderId, ...decideOrderUpdate(ocr.text) });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid scan request" });
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      send(response, error.status, { error: error.message, code: error.code });
      return;
    }
    send(response, 502, { error: error instanceof Error ? error.message : "OCR request failed" });
  }
}

const port = Number(process.env.PORT ?? 3000);
if (process.env.NODE_ENV !== "test") {
  createServer((request, response) => void handleScan(request, response)).listen(port, () => {
    console.log(`Order document service listening on http://localhost:${port}`);
  });
}
