import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type {
  CreateSubscriberInput,
  UpdateSubscriberInput,
} from "@/lib/validations/subscriber.schema";
import type { Prisma, SubscriberStatus } from "@prisma/client";
import { radiusService } from "./radius.service";

export interface SubscriberListParams {
  tenantId: string;
  search?: string;
  status?: string;
  planId?: string;
  nasDeviceId?: string;
  locationId?: string;
  connectionType?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const subscriberService = {
  async list(params: SubscriberListParams) {
    const {
      tenantId,
      search,
      status,
      planId,
      nasDeviceId,
      locationId,
      connectionType,
      page = 1,
      pageSize = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const where: Prisma.SubscriberWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) where.status = status as SubscriberStatus;
    if (planId) where.planId = planId;
    if (nasDeviceId) where.nasDeviceId = nasDeviceId;
    if (locationId) where.locationId = locationId;
    if (connectionType) where.connectionType = connectionType as Prisma.EnumConnectionTypeFilter["equals"];

    const [data, total] = await Promise.all([
      prisma.subscriber.findMany({
        where,
        include: {
          plan: { select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true, speedUnit: true } },
          nasDevice: { select: { id: true, name: true, nasIp: true } },
          location: { select: { id: true, name: true, type: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.subscriber.count({ where }),
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
  },

  async getById(tenantId: string, id: string) {
    return prisma.subscriber.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        plan: true,
        nasDevice: { include: { location: true } },
        location: true,
      },
    });
  },

  async create(tenantId: string, input: CreateSubscriberInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);

    const subscriber = await prisma.subscriber.create({
      data: {
        tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        alternatePhone: input.alternatePhone || null,
        address: input.address || null,
        gpsCoordinates: input.gpsCoordinates || null,
        subscriberType: input.subscriberType,
        connectionType: input.connectionType,
        username: input.username,
        passwordHash,
        planId: input.planId ?? null,
        nasDeviceId: input.nasDeviceId ?? null,
        locationId: input.locationId ?? null,
        macAddress: input.macAddress || null,
        ipAddress: input.ipAddress || null,
        staticIp: input.staticIp || null,
        installationDate: input.installationDate ? new Date(input.installationDate) : null,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        lastRenewalDate: new Date(),
        status: input.status,
        notes: input.notes || null,
      },
    });

    // Sync to RADIUS
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { slug: true },
    });

    try {
      await radiusService.syncSubscriberAuth(tenant.slug, subscriber);
      if (subscriber.planId) {
        await radiusService.syncSubscriberPlan(
          tenant.slug,
          subscriber.username,
          subscriber.planId
        );
      }
    } catch (error) {
      console.error("[SUBSCRIBER] RADIUS sync failed on create:", error);
      // Continue - don't block subscriber creation
    }

    return subscriber;
  },

  async update(tenantId: string, id: string, input: UpdateSubscriberInput) {
    const existing = await prisma.subscriber.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new Error("Subscriber not found");

    const data: Prisma.SubscriberUncheckedUpdateInput = {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      alternatePhone: input.alternatePhone || null,
      address: input.address || null,
      gpsCoordinates: input.gpsCoordinates || null,
      subscriberType: input.subscriberType,
      connectionType: input.connectionType,
      username: input.username,
      planId: input.planId ?? null,
      nasDeviceId: input.nasDeviceId ?? null,
      locationId: input.locationId ?? null,
      macAddress: input.macAddress || null,
      ipAddress: input.ipAddress || null,
      staticIp: input.staticIp || null,
      installationDate: input.installationDate ? new Date(input.installationDate) : null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      status: input.status,
      notes: input.notes || null,
    };

    // Only update password if provided
    if (input.password) {
      data.passwordHash = await bcrypt.hash(input.password, 12);
    }

    const updated = await prisma.subscriber.update({
      where: { id },
      data,
    });

    // Sync to RADIUS
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { slug: true },
    });

    try {
      await radiusService.syncSubscriberAuth(tenant.slug, updated);
      await radiusService.syncSubscriberPlan(
        tenant.slug,
        updated.username,
        updated.planId
      );
    } catch (error) {
      console.error("[SUBSCRIBER] RADIUS sync failed on update:", error);
    }

    return updated;
  },

  async updateStatus(tenantId: string, id: string, status: SubscriberStatus) {
    const existing = await prisma.subscriber.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { nasDevice: true },
    });
    if (!existing) throw new Error("Subscriber not found");

    const updated = await prisma.subscriber.update({
      where: { id },
      data: { status },
    });

    // Disconnect active sessions if subscriber is disabled, suspended, or expired
    if (["DISABLED", "SUSPENDED", "EXPIRED"].includes(status)) {
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { slug: true },
      });

      if (existing.nasDevice) {
        try {
          await radiusService.disconnectAllUserSessions(
            tenant.slug,
            existing.username,
            existing.nasDevice.secret
          );
        } catch (error) {
          console.error("[SUBSCRIBER] Failed to disconnect sessions:", error);
        }
      }
    }

    return updated;
  },

  async softDelete(tenantId: string, id: string) {
    const existing = await prisma.subscriber.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new Error("Subscriber not found");

    const deleted = await prisma.subscriber.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DISABLED" },
    });

    // Remove from RADIUS
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { slug: true },
    });

    try {
      await radiusService.removeSubscriberAuth(tenant.slug, existing.username);
    } catch (error) {
      console.error("[SUBSCRIBER] RADIUS cleanup failed on delete:", error);
    }

    return deleted;
  },

  async getStats(tenantId: string) {
    const [total, active, expired, disabled, suspended] = await Promise.all([
      prisma.subscriber.count({ where: { tenantId, deletedAt: null } }),
      prisma.subscriber.count({ where: { tenantId, deletedAt: null, status: "ACTIVE" } }),
      prisma.subscriber.count({ where: { tenantId, deletedAt: null, status: "EXPIRED" } }),
      prisma.subscriber.count({ where: { tenantId, deletedAt: null, status: "DISABLED" } }),
      prisma.subscriber.count({ where: { tenantId, deletedAt: null, status: "SUSPENDED" } }),
    ]);

    return { total, active, expired, disabled, suspended };
  },

  async exportAll(tenantId: string) {
    return prisma.subscriber.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        plan: { select: { name: true } },
        nasDevice: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
