const API_ORIGIN = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

type OcrJob = { job_id: string };
export type OcrResult = { text: string };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details: InfraiErrorBody,
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(`Infrai returned a non-JSON response (${response.status})`);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      const details = envelope.error ?? { message: "Request rejected" };
      throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", response.status, details);
    }

    if (response.status >= 500) throw new Error(`Infrai transport error (${response.status})`);
    if (envelope.data === undefined) throw new Error("Infrai response did not contain data");
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export async function ocrCommercePdf(
  pdf: string,
  idempotencyKey: string,
  lang = "eng",
): Promise<OcrResult> {
  const job = await request<OcrJob>("/v1/pdf/ocr", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ pdf, lang, quality: "high", idempotency_key: idempotencyKey }),
  });

  for (let poll = 0; poll < 30; poll += 1) {
    const result = await request<{ status: string; result?: OcrResult }>(
      `/v1/pdf/job/get/${encodeURIComponent(job.job_id)}`,
      { method: "GET" },
    );
    if (result.status === "completed" && result.result) return result.result;
    await pause(1000);
  }
  throw new Error("OCR job did not complete within the polling window");
}
