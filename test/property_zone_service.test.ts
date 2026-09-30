import assert from "node:assert/strict";
import test from "node:test";
import { InfraiDnsClient } from "../src/infrai_dns.js";
import { migratePropertyZone } from "../src/property_zone_service.js";

test("a property zone uses its returned zone_id for every operational record", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    const data = calls.length === 1 ? { zone_id: "zone_cedar_42" } : { record_id: `record_${calls.length}` };
    return new Response(JSON.stringify({ ok: true, data, metadata: {} }), { status: 200 });
  };

  const result = await migratePropertyZone(new InfraiDnsClient(process.env.INFRAI_API_KEY ?? "", fakeFetch), {
    propertyId: "cedar-court",
    domain: "cedar.example.com",
    destinations: {
      maintenanceRequests: "requests.property-platform.example",
      tenantDocuments: "documents.property-platform.example",
      inspectionReminders: "reminders.property-platform.example"
    }
  });

  assert.equal(result.zone_id, "zone_cedar_42");
  assert.deepEqual(result.records.map((record) => record.name), ["maintenance", "documents", "inspections"]);
  assert.equal(calls[0].init.method, "POST");
  for (const call of calls.slice(1)) {
    assert.equal(call.init.method, "PUT");
    assert.equal(JSON.parse(String(call.init.body)).zone_id, "zone_cedar_42");
    assert.match(String(new Headers(call.init.headers).get("Idempotency-Key")), /^property-zone:cedar-court:/);
  }
});
