import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import type { GenerateVoucherBatchInput } from "@/lib/validations/voucher.schema";
import type { Prisma } from "@/generated/prisma";

export const voucherService = {
  /**
   * Generate a unique alphanumeric code
   */
  generateCode(length: number, prefix: string): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0/O/1/I to avoid confusion
    let code = "";
    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return prefix ? `${prefix}-${code}` : code;
  },

  /**
   * Generate next batch number for a tenant
   */
  async getNextBatchNumber(tenantId: string): Promise<string> {
    const lastBatch = await prisma.voucherBatch.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { batchNumber: true },
    });

    if (!lastBatch) return "BATCH-001";

    const lastNum = parseInt(lastBatch.batchNumber.replace("BATCH-", ""), 10);
    return `BATCH-${String(lastNum + 1).padStart(3, "0")}`;
  },

  /**
   * Generate a batch of vouchers
   */
  async generateBatch(tenantId: string, input: GenerateVoucherBatchInput) {
    const batchNumber = await this.getNextBatchNumber(tenantId);

    // Verify plan exists and belongs to tenant
    const plan = await prisma.plan.findFirst({
      where: { id: input.planId, tenantId },
    });
    if (!plan) throw new Error("Plan not found");

    // Create batch
    const batch = await prisma.voucherBatch.create({
      data: {
        tenantId,
        planId: input.planId,
        batchNumber,
        prefix: input.prefix || "",
        quantity: input.quantity,
        codeLength: input.codeLength || 8,
        validityDays: input.validityDays,
        notes: input.notes,
      },
    });

    // Generate unique voucher codes
    const existingCodes = new Set<string>();
    const vouchers: Prisma.VoucherCreateManyInput[] = [];

    for (let i = 0; i < input.quantity; i++) {
      let code: string;
      do {
        code = this.generateCode(input.codeLength || 8, input.prefix || "");
      } while (existingCodes.has(code));

      existingCodes.add(code);
      vouchers.push({
        tenantId,
        batchId: batch.id,
        code,
        serialNumber: i + 1,
        status: "GENERATED",
      });
    }

    await prisma.voucher.createMany({ data: vouchers });

    return prisma.voucherBatch.findUnique({
      where: { id: batch.id },
      include: {
        plan: { select: { id: true, name: true, price: true, validityDays: true } },
        _count: { select: { vouchers: true } },
      },
    });
  },

  /**
   * List voucher batches for a tenant
   */
  async listBatches(
    tenantId: string,
    params?: { page?: number; pageSize?: number }
  ) {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [batches, total] = await Promise.all([
      prisma.voucherBatch.findMany({
        where: { tenantId },
        include: {
          plan: { select: { id: true, name: true, price: true, validityDays: true } },
          _count: { select: { vouchers: true } },
          vouchers: {
            select: { status: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.voucherBatch.count({ where: { tenantId } }),
    ]);

    // Calculate status counts per batch
    const batchesWithStats = batches.map((batch) => {
      const statusCounts = {
        GENERATED: 0,
        SOLD: 0,
        REDEEMED: 0,
        EXPIRED: 0,
      };
      batch.vouchers.forEach((v) => {
        statusCounts[v.status]++;
      });
      // eslint-disable-next-line no-unused-vars
      const { vouchers: _, ...rest } = batch;
      return { ...rest, statusCounts };
    });

    return {
      data: batchesWithStats,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  },

  /**
   * List vouchers in a batch (or all for tenant)
   */
  async listVouchers(
    tenantId: string,
    params?: {
      batchId?: string;
      status?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const where: Prisma.VoucherWhereInput = { tenantId };
    if (params?.batchId) where.batchId = params.batchId;
    if (params?.status) where.status = params.status as Prisma.EnumVoucherStatusFilter;
    if (params?.search) {
      where.OR = [
        { code: { contains: params.search, mode: "insensitive" } },
        { soldTo: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        include: {
          batch: {
            select: {
              batchNumber: true,
              validityDays: true,
              plan: { select: { id: true, name: true, price: true } },
            },
          },
          redeemedBy: { select: { id: true, name: true, phone: true } },
        },
        orderBy: [{ batchId: "desc" }, { serialNumber: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.voucher.count({ where }),
    ]);

    return {
      data: vouchers,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  },

  /**
   * Get vouchers for PDF printing (all vouchers in a batch)
   */
  async getVouchersForPrint(tenantId: string, batchId: string) {
    const batch = await prisma.voucherBatch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        plan: { select: { name: true, price: true, downloadSpeed: true, uploadSpeed: true, speedUnit: true, validityDays: true, validityUnit: true, dataLimit: true, dataUnit: true } },
      },
    });
    if (!batch) throw new Error("Batch not found");

    const vouchers = await prisma.voucher.findMany({
      where: { batchId, tenantId },
      orderBy: { serialNumber: "asc" },
    });

    return { batch, vouchers };
  },

  /**
   * Mark vouchers as sold
   */
  async markAsSold(tenantId: string, voucherIds: string[], soldTo: string) {
    return prisma.voucher.updateMany({
      where: {
        id: { in: voucherIds },
        tenantId,
        status: "GENERATED",
      },
      data: {
        status: "SOLD",
        soldTo,
        soldAt: new Date(),
      },
    });
  },

  /**
   * Redeem a voucher (for hotspot login)
   * Returns the plan details if successful
   */
  async redeemVoucher(tenantId: string, code: string, subscriberId?: string) {
    const voucher = await prisma.voucher.findFirst({
      where: {
        tenantId,
        code: code.toUpperCase(),
        status: { in: ["GENERATED", "SOLD"] },
      },
      include: {
        batch: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!voucher) {
      return { success: false as const, error: "Invalid or already used voucher code" };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + voucher.batch.validityDays * 24 * 60 * 60 * 1000);

    await prisma.voucher.update({
      where: { id: voucher.id },
      data: {
        status: "REDEEMED",
        redeemedById: subscriberId || null,
        redeemedAt: now,
        expiresAt,
      },
    });

    return {
      success: true as const,
      plan: voucher.batch.plan,
      expiresAt,
    };
  },

  /**
   * Delete a batch and all its vouchers
   */
  async deleteBatch(tenantId: string, batchId: string) {
    const batch = await prisma.voucherBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!batch) throw new Error("Batch not found");

    // Check if any vouchers have been redeemed
    const redeemedCount = await prisma.voucher.count({
      where: { batchId, status: "REDEEMED" },
    });
    if (redeemedCount > 0) {
      throw new Error("Cannot delete batch with redeemed vouchers");
    }

    await prisma.voucher.deleteMany({ where: { batchId } });
    await prisma.voucherBatch.delete({ where: { id: batchId } });
  },

  /**
   * Get voucher stats for a tenant
   */
  async getStats(tenantId: string) {
    const [total, generated, sold, redeemed, expired] = await Promise.all([
      prisma.voucher.count({ where: { tenantId } }),
      prisma.voucher.count({ where: { tenantId, status: "GENERATED" } }),
      prisma.voucher.count({ where: { tenantId, status: "SOLD" } }),
      prisma.voucher.count({ where: { tenantId, status: "REDEEMED" } }),
      prisma.voucher.count({ where: { tenantId, status: "EXPIRED" } }),
    ]);

    return { total, generated, sold, redeemed, expired };
  },

  /**
   * Export all vouchers in a batch as CSV data
   */
  async exportBatchCsv(tenantId: string, batchId: string) {
    const vouchers = await prisma.voucher.findMany({
      where: { batchId, tenantId },
      include: {
        batch: {
          select: {
            batchNumber: true,
            plan: { select: { name: true, price: true } },
          },
        },
      },
      orderBy: { serialNumber: "asc" },
    });

    return vouchers.map((v) => ({
      serialNumber: v.serialNumber,
      code: v.code,
      plan: v.batch.plan.name,
      price: v.batch.plan.price.toString(),
      status: v.status,
      soldTo: v.soldTo || "",
      soldAt: v.soldAt?.toISOString() || "",
      redeemedAt: v.redeemedAt?.toISOString() || "",
      expiresAt: v.expiresAt?.toISOString() || "",
    }));
  },
};
