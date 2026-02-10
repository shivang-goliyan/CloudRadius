"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/session";
import { smsService } from "@/services/sms/sms.service";
import { smsGatewaySchema, testSmsSchema } from "@/lib/validations/sms-gateway.schema";
import type { SmsProvider } from "@prisma/client";

export async function createSmsGateway(formData: FormData) {
  try {
    const tenantId = await requireTenantId();

    const data = {
      provider: formData.get("provider") as SmsProvider,
      name: formData.get("name") as string,
      apiKey: formData.get("apiKey") as string,
      senderId: formData.get("senderId") as string,
      apiUrl: formData.get("apiUrl") as string,
      status: formData.get("status") as "ACTIVE" | "INACTIVE",
      config: formData.get("config") ? JSON.parse(formData.get("config") as string) : undefined,
    };

    // Validate input
    const validated = smsGatewaySchema.parse(data);

    // Create gateway
    await smsService.create(tenantId, validated);

    revalidatePath("/settings/sms-gateway");
    return { success: true, message: "SMS gateway created successfully" };
  } catch (error) {
    console.error("[Create SMS Gateway]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create SMS gateway",
    };
  }
}

export async function updateSmsGateway(id: string, formData: FormData) {
  try {
    const tenantId = await requireTenantId();

    const data = {
      name: formData.get("name") as string,
      apiKey: formData.get("apiKey") as string,
      senderId: formData.get("senderId") as string,
      apiUrl: formData.get("apiUrl") as string,
      status: formData.get("status") as "ACTIVE" | "INACTIVE",
      config: formData.get("config") ? JSON.parse(formData.get("config") as string) : undefined,
    };

    // Validate input (partial schema)
    const validated = smsGatewaySchema.partial().parse(data);

    // Update gateway
    await smsService.update(id, tenantId, validated);

    revalidatePath("/settings/sms-gateway");
    return { success: true, message: "SMS gateway updated successfully" };
  } catch (error) {
    console.error("[Update SMS Gateway]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update SMS gateway",
    };
  }
}

export async function deleteSmsGateway(id: string) {
  try {
    const tenantId = await requireTenantId();

    await smsService.delete(id, tenantId);

    revalidatePath("/settings/sms-gateway");
    return { success: true, message: "SMS gateway deleted successfully" };
  } catch (error) {
    console.error("[Delete SMS Gateway]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete SMS gateway",
    };
  }
}

export async function toggleSmsGatewayStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  try {
    const tenantId = await requireTenantId();

    await smsService.toggleStatus(id, tenantId, status);

    revalidatePath("/settings/sms-gateway");
    return { success: true, message: `SMS gateway ${status.toLowerCase()} successfully` };
  } catch (error) {
    console.error("[Toggle SMS Gateway Status]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to toggle SMS gateway status",
    };
  }
}

export async function testSmsGateway(id: string, phone: string, message: string) {
  try {
    const tenantId = await requireTenantId();

    // Validate input
    const validated = testSmsSchema.parse({ phone, message });

    // Get gateway
    const gateway = await smsService.getById(id, tenantId);

    if (!gateway) {
      return { success: false, message: "SMS gateway not found" };
    }

    // Test gateway
    const result = await smsService.testGateway(gateway, validated.phone, validated.message);

    if (result.success) {
      return { success: true, message: "Test SMS sent successfully" };
    } else {
      return { success: false, message: result.error || "Failed to send test SMS" };
    }
  } catch (error) {
    console.error("[Test SMS Gateway]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to test SMS gateway",
    };
  }
}

export async function getGatewayBalance() {
  try {
    const tenantId = await requireTenantId();

    const balance = await smsService.getBalance(tenantId);

    if (balance !== null) {
      return { success: true, balance };
    } else {
      return { success: false, message: "Balance not available" };
    }
  } catch (error) {
    console.error("[Get Gateway Balance]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to get balance",
    };
  }
}
