import { z } from "zod";
import { PaymentGatewayProvider } from "@prisma/client";

export const paymentGatewaySchema = z.object({
  provider: z.nativeEnum(PaymentGatewayProvider),
  name: z.string().min(2, "Name must be at least 2 characters"),
  apiKey: z.string().min(1, "API Key is required"),
  apiSecret: z.string().min(1, "API Secret is required"),
  webhookSecret: z.string().optional(),
  isTestMode: z.boolean().default(true),
});

export type CreatePaymentGatewayInput = z.infer<typeof paymentGatewaySchema>;
