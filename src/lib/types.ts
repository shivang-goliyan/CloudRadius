import type { User, Tenant, UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  tenantSlug: string | null;
}

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export type UserWithTenant = User & {
  tenant: Tenant | null;
};
