"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/session";
import { subscriberSchema, subscriberUpdateSchema } from "@/lib/validations/subscriber.schema";
import { subscriberService } from "@/services/subscriber.service";
import type { ActionResponse } from "@/lib/types";
import type { SubscriberStatus } from "@prisma/client";

export async function createSubscriber(formData: unknown): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const validated = subscriberSchema.safeParse(formData);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const subscriber = await subscriberService.create(tenantId, validated.data);
    revalidatePath("/subscribers");
    return { success: true, data: subscriber };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create subscriber" };
  }
}

export async function updateSubscriber(id: string, formData: unknown): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const validated = subscriberUpdateSchema.safeParse(formData);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const subscriber = await subscriberService.update(tenantId, id, validated.data);
    revalidatePath("/subscribers");
    revalidatePath(`/subscribers/${id}`);
    return { success: true, data: subscriber };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update subscriber" };
  }
}

export async function updateSubscriberStatus(
  id: string,
  status: SubscriberStatus
): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    const subscriber = await subscriberService.updateStatus(tenantId, id, status);
    revalidatePath("/subscribers");
    revalidatePath(`/subscribers/${id}`);
    return { success: true, data: subscriber };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update status" };
  }
}

export async function deleteSubscriber(id: string): Promise<ActionResponse> {
  try {
    const tenantId = await requireTenantId();
    await subscriberService.softDelete(tenantId, id);
    revalidatePath("/subscribers");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete subscriber" };
  }
}
