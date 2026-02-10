"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/session";
import { locationSchema } from "@/lib/validations/location.schema";
import { locationService } from "@/services/location.service";
import type { ActionResponse } from "@/lib/types";

export async function createLocation(formData: unknown): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const validated = locationSchema.safeParse(formData);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const location = await locationService.create(tenantId, validated.data);
    revalidatePath("/locations");
    return { success: true, data: location };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create location" };
  }
}

export async function updateLocation(id: string, formData: unknown): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const validated = locationSchema.safeParse(formData);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const location = await locationService.update(tenantId, id, validated.data);
    revalidatePath("/locations");
    return { success: true, data: location };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update location" };
  }
}

export async function deleteLocation(id: string): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    await locationService.delete(tenantId, id);
    revalidatePath("/locations");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete location" };
  }
}
