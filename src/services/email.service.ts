import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailConfig } from "@prisma/client";

export interface SendEmailParams {
  tenantId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
  }>;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email Service
 * Handles sending emails via SMTP using nodemailer
 */
export const emailService = {
  /**
   * Get email configuration for a tenant
   */
  async getConfig(tenantId: string): Promise<EmailConfig | null> {
    return prisma.emailConfig.findUnique({
      where: { tenantId, isActive: true },
    });
  },

  /**
   * Create or update email configuration
   */
  async upsertConfig(
    tenantId: string,
    data: {
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPassword: string;
      fromEmail: string;
      fromName: string;
      useTls?: boolean;
      isActive?: boolean;
    }
  ) {
    return prisma.emailConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...data,
        useTls: data.useTls ?? true,
        isActive: data.isActive ?? true,
      },
      update: data,
    });
  },

  /**
   * Delete email configuration
   */
  async deleteConfig(tenantId: string) {
    return prisma.emailConfig.delete({
      where: { tenantId },
    });
  },

  /**
   * Create nodemailer transporter from config
   */
  createTransporter(config: EmailConfig): Transporter {
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.useTls, // true for 465, false for other ports
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });
  },

  /**
   * Send email using tenant's email configuration
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResponse> {
    try {
      // Get email configuration
      const config = await this.getConfig(params.tenantId);

      if (!config) {
        return {
          success: false,
          error: "No email configuration found for this tenant",
        };
      }

      // Create transporter
      const transporter = this.createTransporter(config);

      // Send email
      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        attachments: params.attachments,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error("[Email Service] Failed to send email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Test email configuration
   */
  async testConfig(
    config: EmailConfig,
    testEmail: string,
    testSubject: string,
    testBody: string
  ): Promise<SendEmailResponse> {
    try {
      const transporter = this.createTransporter(config);

      // Verify transporter connection
      await transporter.verify();

      // Send test email
      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: testEmail,
        subject: testSubject,
        html: testBody,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error("[Email Service] Test failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Verify email configuration (check SMTP connection)
   */
  async verifyConfig(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = this.createTransporter(config);
      await transporter.verify();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },
};
