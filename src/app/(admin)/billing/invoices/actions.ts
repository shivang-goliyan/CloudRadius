"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/session";
import { invoiceSchema } from "@/lib/validations/invoice.schema";
import { billingService } from "@/services/billing.service";
import type { ActionResponse } from "@/lib/types";

export async function createInvoice(formData: unknown): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const validated = invoiceSchema.safeParse(formData);

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const invoice = await billingService.createInvoice(tenantId, validated.data);
    revalidatePath("/billing/invoices");
    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create invoice",
    };
  }
}

export async function updateInvoice(
  id: string,
  formData: unknown
): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const validated = invoiceSchema.partial().safeParse(formData);

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const invoice = await billingService.updateInvoice(tenantId, id, validated.data);
    revalidatePath("/billing/invoices");
    revalidatePath(`/billing/invoices/${id}`);
    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update invoice",
    };
  }
}

export async function cancelInvoice(id: string, reason?: string): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const invoice = await billingService.voidInvoice(tenantId, id, reason);
    revalidatePath("/billing/invoices");
    revalidatePath(`/billing/invoices/${id}`);
    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel invoice",
    };
  }
}

export async function downloadInvoicePdf(id: string): Promise<ActionResponse<string>> {
  try {
    await requireTenantId();
    // Return the PDF URL
    return { success: true, data: `/api/invoices/${id}/pdf` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate PDF",
    };
  }
}
