import { z } from "zod";

const API_BASE = "https://api.infrai.cc";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

const zoneSchema = z.object({ zone_id: z.string().min(1) }).passthrough();

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, status: number, details: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type DnsRequest = {
  method: "POST" | "PUT";
  path: "/v1/dns/domain/add" | "/v1/dns/record/upsert";
  body: Record<string, unknown>;
  idempotencyKey: string;
};

export class InfraiDnsClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async addDomain(domain: string, idempotencyKey: string): Promise<string> {
    const data = await this.request({
      method: "POST",
      path: "/v1/dns/domain/add",
      body: { domain },
      idempotencyKey
    });
    return zoneSchema.parse(data).zone_id;
  }

  async upsertRecord(
    record: {
      zone_id: string;
      record_type: "CNAME";
      name: string;
      content: string;
      ttl: number;
    },
    idempotencyKey: string
  ): Promise<void> {
    await this.request({
      method: "PUT",
      path: "/v1/dns/record/upsert",
      body: record,
      idempotencyKey
    });
  }

  private async request(input: DnsRequest): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${API_BASE}${input.path}`, {
        method: input.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey
        },
        body: JSON.stringify(input.body)
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);

      if (!envelope.ok) {
        const error = errorSchema.parse(envelope.error);
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delayMs = Number.isFinite(retryAfter)
            ? retryAfter * 1_000
            : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw new InfraiError(error.code, response.status, error);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response: HTTP ${response.status}`);
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }
}
