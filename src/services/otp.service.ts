import { prisma } from "@/lib/prisma";
import { smsService } from "./sms/sms.service";
import { templateService } from "./notification/template.service";

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "3", 10);

export interface SendOtpParams {
  tenantId: string;
  phone: string;
  purpose: string;
}

export interface SendOtpResponse {
  success: boolean;
  expiresAt?: Date;
  error?: string;
}

export interface VerifyOtpParams {
  tenantId: string;
  phone: string;
  code: string;
  purpose: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  error?: string;
}

/**
 * OTP Service
 * Handles OTP generation, sending, and verification
 */
export const otpService = {
  /**
   * Generate a 6-digit OTP code
   */
  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Send OTP to a phone number
   */
  async sendOtp(params: SendOtpParams): Promise<SendOtpResponse> {
    try {
      const { tenantId, phone, purpose } = params;

      // Check if there's a recent OTP (within 1 minute)
      const recentOtp = await prisma.otp.findFirst({
        where: {
          tenantId,
          phone,
          purpose,
          createdAt: {
            gte: new Date(Date.now() - 60 * 1000), // 1 minute ago
          },
        },
      });

      if (recentOtp) {
        return {
          success: false,
          error: "Please wait 1 minute before requesting another OTP",
        };
      }

      // Generate OTP
      const code = this.generateOtp();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP in database
      await prisma.otp.create({
        data: {
          tenantId,
          phone,
          code,
          purpose,
          expiresAt,
        },
      });

      // Get OTP SMS template
      const template = await templateService.getTemplate(tenantId, "OTP", "SMS");

      let message: string;
      if (template) {
        // Render template with OTP code
        message = templateService.renderTemplate(template.template, {
          password: code, // Using "password" variable name for OTP
          tenantName: "", // Will be filled by notification worker
        });
      } else {
        // Fallback message
        message = `Your OTP is ${code}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`;
      }

      // Send SMS
      const smsResult = await smsService.sendSms(tenantId, phone, message);

      if (!smsResult.success) {
        return {
          success: false,
          error: `Failed to send OTP: ${smsResult.error}`,
        };
      }

      return {
        success: true,
        expiresAt,
      };
    } catch (error) {
      console.error("[OTP Service] Failed to send OTP:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Verify OTP code
   */
  async verifyOtp(params: VerifyOtpParams): Promise<VerifyOtpResponse> {
    try {
      const { tenantId, phone, code, purpose } = params;

      // Find the most recent OTP for this phone and purpose
      const otp = await prisma.otp.findFirst({
        where: {
          tenantId,
          phone,
          purpose,
          verified: false,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!otp) {
        return {
          success: false,
          error: "No OTP found or OTP already verified",
        };
      }

      // Check if OTP has expired
      if (new Date() > otp.expiresAt) {
        return {
          success: false,
          error: "OTP has expired. Please request a new one",
        };
      }

      // Check attempts
      if (otp.attempts >= OTP_MAX_ATTEMPTS) {
        return {
          success: false,
          error: "Too many failed attempts. Please request a new OTP",
        };
      }

      // Verify OTP code
      if (otp.code !== code) {
        // Increment attempts
        await prisma.otp.update({
          where: { id: otp.id },
          data: { attempts: otp.attempts + 1 },
        });

        return {
          success: false,
          error: `Invalid OTP. ${OTP_MAX_ATTEMPTS - otp.attempts - 1} attempts remaining`,
        };
      }

      // Mark OTP as verified
      await prisma.otp.update({
        where: { id: otp.id },
        data: { verified: true },
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error("[OTP Service] Failed to verify OTP:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Clean up expired OTPs (run periodically)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await prisma.otp.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return result.count;
    } catch (error) {
      console.error("[OTP Service] Failed to cleanup expired OTPs:", error);
      return 0;
    }
  },

  /**
   * Get OTP statistics for a tenant
   */
  async getStats(tenantId: string, startDate?: Date, endDate?: Date) {
    const where: any = { tenantId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, verified, expired] = await Promise.all([
      prisma.otp.count({ where }),
      prisma.otp.count({ where: { ...where, verified: true } }),
      prisma.otp.count({
        where: {
          ...where,
          verified: false,
          expiresAt: { lt: new Date() },
        },
      }),
    ]);

    return {
      total,
      verified,
      expired,
      pending: total - verified - expired,
      verificationRate: total > 0 ? ((verified / total) * 100).toFixed(2) : "0",
    };
  },
};
