import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiDnsClient, InfraiError } from "./infrai_dns.js";
import { migratePropertyZone, migrationRequestSchema } from "./property_zone_service.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const dns = new InfraiDnsClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

function reply(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/property-zones/migrate") {
    reply(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = await migratePropertyZone(dns, migrationRequestSchema.parse(body));
    reply(response, 201, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      reply(response, 400, { error: "Invalid migration request" });
      return;
    }
    if (error instanceof InfraiError) {
      reply(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code
      });
      return;
    }
    reply(response, 502, { error: "Gateway request failed" });
  }
}).listen(port, () => {
  console.log(`Property zone service listening on http://localhost:${port}`);
});
