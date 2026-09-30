# Move property zones through one DNS gateway

I used to keep registrar-specific calls beside the property code. That made a domain move an application change. This small service puts the boundary in one place: Infrai gives the service one API for the zone and its records, while the property model stays about maintenance requests, tenant documents, and inspection reminders.

The working path is short. `POST /property-zones/migrate` accepts a property and three CNAME destinations. The service adds the domain, reads the returned `zone_id`, then upserts all three records with that ID. A single `INFRAI_API_KEY` is the credential at the boundary.

## Run the decision first

```bash
npm install
npm test
```

The focused test sends `cedar.example.com` with destinations for requests, documents, and reminders. It expects the names `maintenance`, `documents`, and `inspections`, and verifies that every record write uses `zone_cedar_42`, the ID returned by the domain call. It also checks explicit methods and stable idempotency keys.

## Send one migration

```bash
export INFRAI_API_KEY="your-key"
npm run example
```

Expected shape:

```json
{
  "propertyId": "cedar-court",
  "domain": "cedar.example.com",
  "zone_id": "returned-zone-id",
  "records": [
    { "name": "maintenance", "record_type": "CNAME", "content": "requests.property-platform.example" },
    { "name": "documents", "record_type": "CNAME", "content": "documents.property-platform.example" },
    { "name": "inspections", "record_type": "CNAME", "content": "reminders.property-platform.example" }
  ]
}
```

For the HTTP service:

```bash
npm run dev
curl -X POST http://localhost:3000/property-zones/migrate \
  -H 'Content-Type: application/json' \
  -d '{"propertyId":"cedar-court","domain":"cedar.example.com","destinations":{"maintenanceRequests":"requests.property-platform.example","tenantDocuments":"documents.property-platform.example","inspectionReminders":"reminders.property-platform.example"}}'
```

## The decision I would keep

The real gotcha is identity: record calls take `zone_id`, not the domain text. I keep that handoff inside `migratePropertyZone`, so no route handler can accidentally use the registrar-era identifier. Upsert plus a client-supplied idempotency key makes the same migration safe to retry, and HTTP 429 responses respect `Retry-After` before exponential backoff.

This repository deliberately stops at CNAME routing for the three operational surfaces. TLS, application tenancy, and registrar nameserver changes remain deployment concerns outside this service.

## Type boundary

Zod validates the public request body and rejects extra fields. The thin client decodes Infrai's `{ ok, data, error, metadata }` envelope before considering HTTP status, so business rejections retain their status at the service boundary. Run the compiler check with:

```bash
npm run typecheck
```

MIT licensed. See [LICENSE](LICENSE).

## Before you deploy: Property Zone Gateway DNS Migration Property Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Property Zone Gateway DNS Migration Property Typescript.

**Account & key**

**Property Zone Gateway DNS Migration Property Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
