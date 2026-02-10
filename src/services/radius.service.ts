import { prisma } from "@/lib/prisma";
import {
  buildMikroTikRateLimit,
  buildRadiusUsername,
  buildRadiusGroupname,
  planToRadiusAttributes,
} from "@/lib/radius-utils";
import { sendCoaDisconnect, sendCoaChangeRate } from "@/lib/radius-client";
import type { Subscriber, Plan, NasDevice, Prisma } from "@prisma/client";

export interface SessionHistoryParams {
  tenantSlug: string;
  subscriberUsername?: string;
  nasIp?: string;
  startDate?: Date;
  endDate?: Date;
  onlyActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const radiusService = {
  /**
   * Sync subscriber authentication to radcheck table
   * Creates or updates username/password entry for RADIUS authentication
   */
  async syncSubscriberAuth(
    tenantSlug: string,
    subscriber: Subscriber
  ): Promise<void> {
    const radiusUsername = buildRadiusUsername(tenantSlug, subscriber.username);

    try {
      await prisma.$transaction(async (tx) => {
        // Delete existing auth entry
        await tx.radCheck.deleteMany({
          where: { username: radiusUsername },
        });

        // Create new auth entry with cleartext password
        // Note: RADIUS will read this directly, bcrypt hash is stored in subscriber table
        await tx.radCheck.create({
          data: {
            username: radiusUsername,
            attribute: "Cleartext-Password",
            op: ":=",
            value: subscriber.passwordHash,
          },
        });
      });

      console.log(
        `[RADIUS] Synced auth for ${radiusUsername} (subscriber: ${subscriber.id})`
      );
    } catch (error) {
      console.error(`[RADIUS] Failed to sync auth for ${radiusUsername}:`, error);
      throw error;
    }
  },

  /**
   * Sync subscriber-to-plan mapping in radusergroup
   * Establishes the relationship between user and bandwidth group
   */
  async syncSubscriberPlan(
    tenantSlug: string,
    username: string,
    planId: string | null
  ): Promise<void> {
    const radiusUsername = buildRadiusUsername(tenantSlug, username);

    try {
      await prisma.$transaction(async (tx) => {
        // Remove existing group mappings
        await tx.radUserGroup.deleteMany({
          where: { username: radiusUsername },
        });

        // Add new mapping if plan exists
        if (planId) {
          const groupname = buildRadiusGroupname(tenantSlug, planId);
          await tx.radUserGroup.create({
            data: {
              username: radiusUsername,
              groupname,
              priority: 1,
            },
          });
          console.log(
            `[RADIUS] Mapped ${radiusUsername} to group ${groupname}`
          );
        } else {
          console.log(`[RADIUS] Removed plan mapping for ${radiusUsername}`);
        }
      });
    } catch (error) {
      console.error(
        `[RADIUS] Failed to sync plan mapping for ${radiusUsername}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Sync plan bandwidth rules to radgroupreply
   * Creates MikroTik-Rate-Limit and other attributes for the plan group
   */
  async syncPlanBandwidth(tenantSlug: string, plan: Plan): Promise<void> {
    const groupname = buildRadiusGroupname(tenantSlug, plan.id);

    try {
      await prisma.$transaction(async (tx) => {
        // Delete existing group attributes
        await tx.radGroupReply.deleteMany({
          where: { groupname },
        });

        // Get all attributes for this plan
        const attributes = planToRadiusAttributes(plan);

        // Insert all attributes
        for (const attr of attributes) {
          await tx.radGroupReply.create({
            data: {
              groupname,
              attribute: attr.attribute,
              op: ":=",
              value: attr.value,
              priority: attr.priority,
            },
          });
        }

        console.log(
          `[RADIUS] Synced plan bandwidth for group ${groupname} (${attributes.length} attributes)`
        );
      });
    } catch (error) {
      console.error(
        `[RADIUS] Failed to sync plan bandwidth for ${groupname}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Remove plan bandwidth rules from RADIUS
   */
  async removePlanBandwidth(tenantSlug: string, planId: string): Promise<void> {
    const groupname = buildRadiusGroupname(tenantSlug, planId);

    try {
      await prisma.radGroupReply.deleteMany({
        where: { groupname },
      });
      console.log(`[RADIUS] Removed plan bandwidth for group ${groupname}`);
    } catch (error) {
      console.error(
        `[RADIUS] Failed to remove plan bandwidth for ${groupname}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Sync NAS device to radius.nas table
   * FreeRADIUS reads NAS list from this table for client authentication
   */
  async syncNasDevice(nas: NasDevice): Promise<void> {
    try {
      await prisma.radNas.upsert({
        where: { nasname: nas.nasIp },
        create: {
          nasname: nas.nasIp,
          shortname: nas.name.substring(0, 32), // NAS shortname has length limit
          type: nas.nasType.toLowerCase(),
          secret: nas.secret,
          description: nas.description || undefined,
        },
        update: {
          shortname: nas.name.substring(0, 32),
          type: nas.nasType.toLowerCase(),
          secret: nas.secret,
          description: nas.description || undefined,
        },
      });

      console.log(`[RADIUS] Synced NAS device ${nas.nasIp} (${nas.name})`);
    } catch (error) {
      console.error(`[RADIUS] Failed to sync NAS device ${nas.nasIp}:`, error);
      throw error;
    }
  },

  /**
   * Remove NAS device from RADIUS
   */
  async removeNasDevice(nasIp: string): Promise<void> {
    try {
      await prisma.radNas.delete({
        where: { nasname: nasIp },
      });
      console.log(`[RADIUS] Removed NAS device ${nasIp}`);
    } catch (error) {
      // Ignore if already deleted
      if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
        console.log(`[RADIUS] NAS device ${nasIp} already removed`);
      } else {
        console.error(`[RADIUS] Failed to remove NAS device ${nasIp}:`, error);
        throw error;
      }
    }
  },

  /**
   * Remove subscriber from RADIUS tables
   * Deletes auth entry and group mappings
   */
  async removeSubscriberAuth(
    tenantSlug: string,
    username: string
  ): Promise<void> {
    const radiusUsername = buildRadiusUsername(tenantSlug, username);

    try {
      await prisma.$transaction([
        prisma.radCheck.deleteMany({ where: { username: radiusUsername } }),
        prisma.radUserGroup.deleteMany({ where: { username: radiusUsername } }),
      ]);

      console.log(`[RADIUS] Removed subscriber auth for ${radiusUsername}`);
    } catch (error) {
      console.error(
        `[RADIUS] Failed to remove subscriber auth for ${radiusUsername}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Get currently online users for a tenant
   * Queries radacct table for sessions without stop time
   */
  async getOnlineUsers(tenantSlug: string) {
    try {
      return await prisma.radAcct.findMany({
        where: {
          username: { startsWith: `${tenantSlug}_` },
          acctstoptime: null,
        },
        orderBy: { acctstarttime: "desc" },
      });
    } catch (error) {
      console.error(`[RADIUS] Failed to get online users for ${tenantSlug}:`, error);
      throw error;
    }
  },

  /**
   * Get active sessions for a specific subscriber
   */
  async getUserActiveSessions(tenantSlug: string, username: string) {
    const radiusUsername = buildRadiusUsername(tenantSlug, username);

    try {
      return await prisma.radAcct.findMany({
        where: {
          username: radiusUsername,
          acctstoptime: null,
        },
        orderBy: { acctstarttime: "desc" },
      });
    } catch (error) {
      console.error(
        `[RADIUS] Failed to get active sessions for ${radiusUsername}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Get session history with filters and pagination
   */
  async getSessionHistory(params: SessionHistoryParams): Promise<{
    data: Awaited<ReturnType<typeof prisma.radAcct.findMany>>;
    meta: PaginationMeta;
  }> {
    const {
      tenantSlug,
      subscriberUsername,
      nasIp,
      startDate,
      endDate,
      onlyActive = false,
      page = 1,
      pageSize = 50,
    } = params;

    const where: Prisma.RadAcctWhereInput = {
      username: { startsWith: `${tenantSlug}_` },
    };

    // Filter by specific subscriber
    if (subscriberUsername) {
      where.username = buildRadiusUsername(tenantSlug, subscriberUsername);
    }

    // Filter by NAS IP
    if (nasIp) {
      where.nasipaddress = nasIp;
    }

    // Filter by date range
    if (startDate || endDate) {
      where.acctstarttime = {};
      if (startDate) where.acctstarttime.gte = startDate;
      if (endDate) where.acctstarttime.lte = endDate;
    }

    // Filter active sessions only
    if (onlyActive) {
      where.acctstoptime = null;
    }

    try {
      const [data, total] = await Promise.all([
        prisma.radAcct.findMany({
          where,
          orderBy: { acctstarttime: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.radAcct.count({ where }),
      ]);

      return {
        data,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      console.error(
        `[RADIUS] Failed to get session history for ${tenantSlug}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Disconnect user via CoA (Change of Authorization)
   * Sends UDP packet to NAS to terminate session
   */
  async disconnectUser(
    nasIp: string,
    username: string,
    secret: string
  ): Promise<boolean> {
    try {
      const success = await sendCoaDisconnect({ nasIp, secret, username });

      if (success) {
        console.log(`[RADIUS] Disconnected user ${username} from ${nasIp}`);
      } else {
        console.warn(
          `[RADIUS] Failed to disconnect user ${username} from ${nasIp}`
        );
      }

      return success;
    } catch (error) {
      console.error(
        `[RADIUS] Error disconnecting user ${username} from ${nasIp}:`,
        error
      );
      return false;
    }
  },

  /**
   * Change user bandwidth in real-time via CoA
   * Sends UDP packet to NAS with new rate limit
   */
  async changeUserBandwidth(
    nasIp: string,
    username: string,
    secret: string,
    rateLimit: string
  ): Promise<boolean> {
    try {
      const success = await sendCoaChangeRate({
        nasIp,
        secret,
        username,
        rateLimit,
      });

      if (success) {
        console.log(
          `[RADIUS] Changed bandwidth for ${username} on ${nasIp} to ${rateLimit}`
        );
      } else {
        console.warn(
          `[RADIUS] Failed to change bandwidth for ${username} on ${nasIp}`
        );
      }

      return success;
    } catch (error) {
      console.error(
        `[RADIUS] Error changing bandwidth for ${username} on ${nasIp}:`,
        error
      );
      return false;
    }
  },

  /**
   * Disconnect all active sessions for a subscriber
   * Used when subscriber is disabled, suspended, or expired
   */
  async disconnectAllUserSessions(
    tenantSlug: string,
    username: string,
    nasSecret: string
  ): Promise<number> {
    const activeSessions = await this.getUserActiveSessions(
      tenantSlug,
      username
    );

    let disconnected = 0;

    for (const session of activeSessions) {
      const radiusUsername = buildRadiusUsername(tenantSlug, username);
      const success = await this.disconnectUser(
        session.nasipaddress,
        radiusUsername,
        nasSecret
      );

      if (success) disconnected++;
    }

    console.log(
      `[RADIUS] Disconnected ${disconnected}/${activeSessions.length} sessions for ${username}`
    );

    return disconnected;
  },
};
