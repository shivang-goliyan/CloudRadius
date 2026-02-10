"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId, requireTenantUser } from "@/lib/session";
import { paymentSchema } from "@/lib/validations/payment.schema";
import { paymentService } from "@/services/payment.service";
import type { ActionResponse } from "@/lib/types";

export async function recordPayment(formData: unknown): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const user = await requireTenantUser();
    const validated = paymentSchema.safeParse(formData);

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const payment = await paymentService.recordPayment(
      tenantId,
      validated.data,
      user.id
    );

    revalidatePath("/billing/payments");
    revalidatePath("/billing/invoices");
    if (validated.data.invoiceId) {
      revalidatePath(`/billing/invoices/${validated.data.invoiceId}`);
    }

    return { success: true, data: payment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record payment",
    };
  }
}
