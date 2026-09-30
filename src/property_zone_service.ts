import { z } from "zod";
import { InfraiDnsClient } from "./infrai_dns.js";

export const migrationRequestSchema = z.object({
  propertyId: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  domain: z.string().trim().min(3),
  destinations: z.object({
    maintenanceRequests: z.string().trim().min(3),
    tenantDocuments: z.string().trim().min(3),
    inspectionReminders: z.string().trim().min(3)
  }).strict()
}).strict();

export type MigrationRequest = z.infer<typeof migrationRequestSchema>;

export type MigrationResult = {
  propertyId: string;
  domain: string;
  zone_id: string;
  records: Array<{ name: string; record_type: "CNAME"; content: string }>;
};

export async function migratePropertyZone(
  dns: InfraiDnsClient,
  input: MigrationRequest
): Promise<MigrationResult> {
  const request = migrationRequestSchema.parse(input);
  const operationKey = `property-zone:${request.propertyId}:${request.domain}`;
  const zone_id = await dns.addDomain(request.domain, `${operationKey}:domain`);

  const records = [
    { name: "maintenance", record_type: "CNAME" as const, content: request.destinations.maintenanceRequests },
    { name: "documents", record_type: "CNAME" as const, content: request.destinations.tenantDocuments },
    { name: "inspections", record_type: "CNAME" as const, content: request.destinations.inspectionReminders }
  ];

  await Promise.all(records.map((record) => dns.upsertRecord(
    {
      zone_id,
      record_type: record.record_type,
      name: record.name,
      content: record.content,
      ttl: 300
    },
    `${operationKey}:${record.name}`
  )));

  return { propertyId: request.propertyId, domain: request.domain, zone_id, records };
}
