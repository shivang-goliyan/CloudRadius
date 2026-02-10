import { Worker } from "bullmq";
import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { notificationQueue } from "../queue";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

/**
 * Billing Worker
 * Processes jobs related to billing, invoicing, and subscriber lifecycle
 */
export const billingWorker = new Worker(
  "billing",
  async (job) => {
    console.log(`[Billing Worker] Processing job: ${job.name}`);

    if (job.name === "check-expiring-subscribers") {
      await checkExpiringSubscribers();
    } else if (job.name === "disable-expired-subscribers") {
      await disableExpiredSubscribers();
    }

    console.log(`[Billing Worker] Job ${job.name} completed`);
  },
  { connection }
);

/**
 * Check for subscribers expiring in 3, 1, 0 days
 * Queue notifications for each
 */
async function checkExpiringSubscribers() {
  console.log("[Expiry Check] Starting expiry check...");

  // Get all tenants
  const tenants = await prisma.tenant.findMany({
    where: { status: { not: "SUSPENDED" } },
    select: { id: true, slug: true },
  });

  let totalNotifications = 0;

  for (const tenant of tenants) {
    // Check for subscribers expiring in 3, 1, 0 days
    const checkDays = [3, 1, 0];

    for (const days of checkDays) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const subscribers = await prisma.subscriber.findMany({
        where: {
          tenantId: tenant.id,
          status: "ACTIVE",
          expiryDate: {
            gte: targetDate,
            lte: endOfDay,
          },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          expiryDate: true,
        },
      });

      console.log(
        `[Expiry Check] Tenant ${tenant.slug}: Found ${subscribers.length} subscribers expiring in ${days} day(s)`
      );

      // Queue notification for each subscriber
      for (const subscriber of subscribers) {
        await notificationQueue.add("send-expiry-reminder", {
          subscriberId: subscriber.id,
          tenantId: tenant.id,
          type: "expiry-reminder",
          daysUntilExpiry: days,
        });
        totalNotifications++;
      }
    }
  }

  console.log(
    `[Expiry Check] Completed. Queued ${totalNotifications} notifications`
  );
}

/**
 * Disable subscribers past grace period
 * Also disconnect them from RADIUS
 */
async function disableExpiredSubscribers() {
  console.log("[Disable Expired] Starting expired subscriber check...");

  // Get all tenants
  const tenants = await prisma.tenant.findMany({
    where: { status: { not: "SUSPENDED" } },
    select: { id: true, slug: true, settings: true },
  });

  let totalDisabled = 0;

  for (const tenant of tenants) {
    const settings = (tenant.settings as any)?.billing || {};
    const gracePeriodDays = settings.gracePeriodDays || 3;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);
    cutoffDate.setHours(23, 59, 59, 999);

    const expiredSubscribers = await prisma.subscriber.findMany({
      where: {
        tenantId: tenant.id,
        status: "ACTIVE",
        expiryDate: {
          lte: cutoffDate,
        },
      },
      select: {
        id: true,
        username: true,
        name: true,
        expiryDate: true,
      },
    });

    console.log(
      `[Disable Expired] Tenant ${tenant.slug}: Found ${expiredSubscribers.length} expired subscribers (grace period: ${gracePeriodDays} days)`
    );

    for (const subscriber of expiredSubscribers) {
      try {
        // Update subscriber status to EXPIRED
        await prisma.subscriber.update({
          where: { id: subscriber.id },
          data: { status: "EXPIRED" },
        });

        // Remove from RADIUS (disable authentication)
        await prisma.$executeRaw`
          UPDATE radius.radcheck
          SET value = 'Reject'
          WHERE username = ${subscriber.username}
          AND attribute = 'Auth-Type'
        `;

        // Queue notification
        await notificationQueue.add("send-expired-notice", {
          subscriberId: subscriber.id,
          tenantId: tenant.id,
          type: "expired-notice",
        });

        totalDisabled++;
        console.log(
          `[Disable Expired] Disabled ${subscriber.username} (expired: ${subscriber.expiryDate})`
        );
      } catch (error) {
        console.error(
          `[Disable Expired] Failed to disable ${subscriber.username}:`,
          error
        );
      }
    }
  }

  console.log(`[Disable Expired] Completed. Disabled ${totalDisabled} subscribers`);
}

// Worker event handlers
billingWorker.on("completed", (job) => {
  console.log(`[Billing Worker] ✅ Job ${job.id} (${job.name}) completed`);
});

billingWorker.on("failed", (job, err) => {
  console.error(`[Billing Worker] ❌ Job ${job?.id} (${job?.name}) failed:`, err);
});

billingWorker.on("error", (err) => {
  console.error("[Billing Worker] Worker error:", err);
});

console.log("🚀 Billing Worker started");

export default billingWorker;
