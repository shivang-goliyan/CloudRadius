"use server";

import { requireTenantUser } from "@/lib/session";
import { radiusService } from "@/services/radius.service";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface ActionResponse {
  success: boolean;
  error?: string;
}

export async function disconnectUserAction(
  radiusUsername: string,
  nasIp: string
): Promise<ActionResponse> {
  try {
    const user = await requireTenantUser();

    if (!user.tenantId) {
      return { success: false, error: "No tenant context" };
    }

    // Get NAS secret
    const nas = await prisma.nasDevice.findFirst({
      where: { tenantId: user.tenantId, nasIp },
    });

    if (!nas) {
      return { success: false, error: "NAS device not found" };
    }

    // Send CoA disconnect
    const success = await radiusService.disconnectUser(
      nasIp,
      radiusUsername,
      nas.secret
    );

    if (!success) {
      return { success: false, error: "Failed to send disconnect command" };
    }

    revalidatePath("/online-users");
    return { success: true };
  } catch (error) {
    console.error("Disconnect action error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
    };
  }
}
