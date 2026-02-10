"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/session";
import { paymentGatewaySchema } from "@/lib/validations/payment-gateway.schema";
import { prisma } from "@/lib/prisma";
import type { ActionResponse } from "@/lib/types";

export async function createPaymentGateway(
  formData: unknown
): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const validated = paymentGatewaySchema.safeParse(formData);

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    // Check if gateway with this provider already exists for tenant
    const existing = await prisma.paymentGateway.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: validated.data.provider,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: "Gateway for this provider already configured. Delete the existing one first.",
      };
    }

    const gateway = await prisma.paymentGateway.create({
      data: {
        ...validated.data,
        tenantId,
        status: "ACTIVE",
      },
    });

    revalidatePath("/settings/payment-gateway");
    return { success: true, data: gateway };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to configure gateway",
    };
  }
}

export async function deletePaymentGateway(
  id: string
): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();

    await prisma.paymentGateway.delete({
      where: { id, tenantId },
    });

    revalidatePath("/settings/payment-gateway");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete gateway",
    };
  }
}
