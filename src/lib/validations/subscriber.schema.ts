import { z } from "zod";

export const subscriberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  alternatePhone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  gpsCoordinates: z.string().optional().or(z.literal("")),
  subscriberType: z.enum(["RESIDENTIAL", "COMMERCIAL"]).default("RESIDENTIAL"),
  connectionType: z.enum(["PPPOE", "HOTSPOT", "STATIC_IP", "MAC_BIND"]).default("PPPOE"),

  // Auth
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),

  // Network
  planId: z.string().uuid("Select a plan").optional().nullable(),
  nasDeviceId: z.string().uuid("Select a NAS device").optional().nullable(),
  locationId: z.string().uuid("Select a location").optional().nullable(),
  macAddress: z.string().optional().or(z.literal("")),
  ipAddress: z.string().optional().or(z.literal("")),
  staticIp: z.string().optional().or(z.literal("")),

  // Dates
  installationDate: z.string().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),

  // Status
  status: z.enum(["ACTIVE", "EXPIRED", "DISABLED", "SUSPENDED", "TRIAL"]).default("ACTIVE"),
  notes: z.string().optional().or(z.literal("")),
});

export const subscriberUpdateSchema = subscriberSchema
  .omit({ password: true })
  .extend({
    password: z.string().min(6).optional().or(z.literal("")),
  });

export type CreateSubscriberInput = z.infer<typeof subscriberSchema>;
export type UpdateSubscriberInput = z.infer<typeof subscriberUpdateSchema>;
