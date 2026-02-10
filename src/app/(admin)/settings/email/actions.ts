"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/session";
import { emailService } from "@/services/email.service";
import { emailConfigSchema, testEmailSchema } from "@/lib/validations/email-config.schema";

export async function saveEmailConfig(formData: FormData) {
  try {
    const tenantId = await requireTenantId();

    const data = {
      smtpHost: formData.get("smtpHost") as string,
      smtpPort: formData.get("smtpPort") as string,
      smtpUser: formData.get("smtpUser") as string,
      smtpPassword: formData.get("smtpPassword") as string,
      fromEmail: formData.get("fromEmail") as string,
      fromName: formData.get("fromName") as string,
      useTls: formData.get("useTls") === "true",
      isActive: formData.get("isActive") === "true",
    };

    // Validate input
    const validated = emailConfigSchema.parse(data);

    // Save configuration
    await emailService.upsertConfig(tenantId, validated);

    revalidatePath("/settings/email");
    return { success: true, message: "Email configuration saved successfully" };
  } catch (error) {
    console.error("[Save Email Config]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save email configuration",
    };
  }
}

export async function deleteEmailConfig() {
  try {
    const tenantId = await requireTenantId();

    await emailService.deleteConfig(tenantId);

    revalidatePath("/settings/email");
    return { success: true, message: "Email configuration deleted successfully" };
  } catch (error) {
    console.error("[Delete Email Config]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete email configuration",
    };
  }
}

export async function testEmailConnection(formData: FormData) {
  try {
    const tenantId = await requireTenantId();

    const data = {
      smtpHost: formData.get("smtpHost") as string,
      smtpPort: formData.get("smtpPort") as string,
      smtpUser: formData.get("smtpUser") as string,
      smtpPassword: formData.get("smtpPassword") as string,
      fromEmail: formData.get("fromEmail") as string,
      fromName: formData.get("fromName") as string,
      useTls: formData.get("useTls") === "true",
      isActive: true,
    };

    // Validate input
    const validated = emailConfigSchema.parse(data);

    // Create config object
    const config = {
      id: "",
      tenantId,
      ...validated,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Verify connection
    const result = await emailService.verifyConfig(config);

    if (result.success) {
      return { success: true, message: "Email connection successful!" };
    } else {
      return { success: false, message: result.error || "Connection failed" };
    }
  } catch (error) {
    console.error("[Test Email Connection]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to test email connection",
    };
  }
}

export async function sendTestEmail(to: string, subject: string, body: string) {
  try {
    const tenantId = await requireTenantId();

    // Validate input
    const validated = testEmailSchema.parse({ to, subject, body });

    // Get current config
    const config = await emailService.getConfig(tenantId);

    if (!config) {
      return { success: false, message: "No email configuration found" };
    }

    // Send test email
    const result = await emailService.testConfig(config, validated.to, validated.subject, validated.body);

    if (result.success) {
      return { success: true, message: "Test email sent successfully!" };
    } else {
      return { success: false, message: result.error || "Failed to send test email" };
    }
  } catch (error) {
    console.error("[Send Test Email]", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send test email",
    };
  }
}
