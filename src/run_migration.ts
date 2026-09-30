import { InfraiDnsClient } from "./infrai_dns.js";
import { migratePropertyZone } from "./property_zone_service.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const result = await migratePropertyZone(new InfraiDnsClient(apiKey), {
  propertyId: "cedar-court",
  domain: "cedar.example.com",
  destinations: {
    maintenanceRequests: "requests.property-platform.example",
    tenantDocuments: "documents.property-platform.example",
    inspectionReminders: "reminders.property-platform.example"
  }
});

console.log(JSON.stringify(result, null, 2));
