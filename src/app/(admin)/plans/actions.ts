"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/session";
import { planSchema } from "@/lib/validations/plan.schema";
import { planService } from "@/services/plan.service";
import type { ActionResponse } from "@/lib/types";

export async function createPlan(formData: unknown): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const validated = planSchema.safeParse(formData);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const plan = await planService.create(tenantId, validated.data);
    revalidatePath("/plans");
    return { success: true, data: plan };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create plan" };
  }
}

export async function updatePlan(id: string, formData: unknown): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const validated = planSchema.safeParse(formData);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const plan = await planService.update(tenantId, id, validated.data);
    revalidatePath("/plans");
    return { success: true, data: plan };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update plan" };
  }
}

export async function togglePlanStatus(id: string): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const plan = await planService.toggleStatus(tenantId, id);
    revalidatePath("/plans");
    return { success: true, data: plan };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to toggle plan status" };
  }
}

export async function deletePlan(id: string): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    await planService.delete(tenantId, id);
    revalidatePath("/plans");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete plan" };
  }
}
