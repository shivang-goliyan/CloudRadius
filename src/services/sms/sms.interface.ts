/**
 * SMS Gateway Adapter Interface
 * All SMS gateway implementations must implement this interface
 */

export interface SmsConfig {
  apiKey: string;
  senderId: string;
  apiUrl?: string;
  config?: Record<string, unknown>;
}

export interface SendSmsParams {
  to: string; // Phone number with country code (e.g., +919876543210)
  message: string;
}

export interface SendSmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  gatewayResponse?: Record<string, unknown>;
}

export interface SmsAdapter {
  /**
   * Send SMS to a single recipient
   */
  sendSms(params: SendSmsParams): Promise<SendSmsResponse>;

  /**
   * Get remaining balance (optional, if gateway supports it)
   */
  getBalance?(): Promise<number | null>;

  /**
   * Verify webhook signature (optional, for delivery reports)
   */
  verifyWebhookSignature?(payload: string, signature: string): boolean;
}
