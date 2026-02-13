import { prisma } from "@/lib/prisma";
import type { SmsProvider, SmsGateway, Prisma } from "@/generated/prisma";
import type { SmsAdapter, SendSmsResponse } from "./sms.interface";
import { MSG91Adapter } from "./msg91.adapter";
import { TextlocalAdapter } from "./textlocal.adapter";
import { TwilioAdapter } from "./twilio.adapter";
import { WhatsAppAdapter } from "./whatsapp.adapter";

/**
 * SMS Service
 * Manages SMS gateways and sends SMS using the configured adapter
 */
export const smsService = {
  /**
   * Get active SMS gateway for a tenant
   */
  async getActiveGateway(tenantId: string): Promise<SmsGateway | null> {
    return prisma.smsGateway.findFirst({
      where: {
        tenantId,
        status: "ACTIVE",
      },
    });
  },

  /**
   * Get all SMS gateways for a tenant
   */
  async getAll(tenantId: string) {
    return prisma.smsGateway.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Get SMS gateway by ID
   */
  async getById(id: string, tenantId: string) {
    return prisma.smsGateway.findFirst({
      where: { id, tenantId },
    });
  },

  /**
   * Create a new SMS gateway
   */
  async create(
    tenantId: string,
    data: {
      provider: SmsProvider;
      name: string;
      apiKey: string;
      senderId: string;
      apiUrl?: string;
      status?: "ACTIVE" | "INACTIVE";
      config?: Prisma.InputJsonValue;
    }
  ) {
    // If this is the first gateway or marked as active, deactivate others
    if (data.status === "ACTIVE" || data.status === undefined) {
      await prisma.smsGateway.updateMany({
        where: { tenantId, status: "ACTIVE" },
        data: { status: "INACTIVE" },
      });
    }

    return prisma.smsGateway.create({
      data: {
        tenantId,
        ...data,
        status: data.status || "ACTIVE",
      },
    });
  },

  /**
   * Update an SMS gateway
   */
  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      apiKey?: string;
      senderId?: string;
      apiUrl?: string;
      status?: "ACTIVE" | "INACTIVE";
      config?: Prisma.InputJsonValue;
    }
  ) {
    // If marking as active, deactivate others
    if (data.status === "ACTIVE") {
      await prisma.smsGateway.updateMany({
        where: { tenantId, status: "ACTIVE", id: { not: id } },
        data: { status: "INACTIVE" },
      });
    }

    return prisma.smsGateway.update({
      where: { id },
      data,
    });
  },

  /**
   * Delete an SMS gateway
   */
  async delete(id: string, tenantId: string) {
    return prisma.smsGateway.delete({
      where: { id, tenantId },
    });
  },

  /**
   * Toggle gateway status
   */
  async toggleStatus(id: string, tenantId: string, status: "ACTIVE" | "INACTIVE") {
    // If activating, deactivate others
    if (status === "ACTIVE") {
      await prisma.smsGateway.updateMany({
        where: { tenantId, status: "ACTIVE", id: { not: id } },
        data: { status: "INACTIVE" },
      });
    }

    return prisma.smsGateway.update({
      where: { id, tenantId },
      data: { status },
    });
  },

  /**
   * Create SMS adapter instance from gateway configuration
   */
  createAdapter(gateway: SmsGateway): SmsAdapter {
    const config = {
      apiKey: gateway.apiKey,
      senderId: gateway.senderId,
      apiUrl: gateway.apiUrl || undefined,
      config: gateway.config as Record<string, unknown> | undefined,
    };

    switch (gateway.provider) {
      case "MSG91":
        return new MSG91Adapter(config);
      case "TEXTLOCAL":
        return new TextlocalAdapter(config);
      case "TWILIO":
        return new TwilioAdapter(config);
      case "WHATSAPP":
        return new WhatsAppAdapter(config);
      case "CUSTOM":
        throw new Error("Custom SMS gateway not implemented yet");
      default:
        throw new Error(`Unsupported SMS provider: ${gateway.provider}`);
    }
  },

  /**
   * Send SMS using active gateway
   */
  async sendSms(tenantId: string, to: string, message: string): Promise<SendSmsResponse> {
    try {
      // Get active gateway
      const gateway = await this.getActiveGateway(tenantId);

      if (!gateway) {
        return {
          success: false,
          error: "No active SMS gateway configured for this tenant",
        };
      }

      // Create adapter and send SMS
      const adapter = this.createAdapter(gateway);
      const result = await adapter.sendSms({ to, message });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Test SMS gateway with a test message
   */
  async testGateway(
    gateway: SmsGateway,
    to: string,
    message: string
  ): Promise<SendSmsResponse> {
    try {
      const adapter = this.createAdapter(gateway);
      return await adapter.sendSms({ to, message });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Send WhatsApp message using active WhatsApp gateway
   */
  async sendWhatsApp(tenantId: string, to: string, message: string): Promise<SendSmsResponse> {
    try {
      const gateway = await prisma.smsGateway.findFirst({
        where: { tenantId, provider: "WHATSAPP", status: "ACTIVE" },
      });

      if (!gateway) {
        return { success: false, error: "No active WhatsApp gateway configured" };
      }

      const adapter = this.createAdapter(gateway);
      return await adapter.sendSms({ to, message });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Get SMS gateway balance (if supported)
   */
  async getBalance(tenantId: string): Promise<number | null> {
    try {
      const gateway = await this.getActiveGateway(tenantId);

      if (!gateway) {
        return null;
      }

      const adapter = this.createAdapter(gateway);

      if (adapter.getBalance) {
        return await adapter.getBalance();
      }

      return null;
    } catch (error) {
      console.error("[SMS Service] Failed to get balance:", error);
      return null;
    }
  },
};
