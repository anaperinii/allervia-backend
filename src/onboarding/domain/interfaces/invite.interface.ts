import { Role } from "@prisma/client";

export interface CreateInviteData {
  email: string;
  fullName: string;
  roleType: Role;
  organizationId: string;
  createdById: string;
  token: string;
  expiresAt: Date;
  isActive: boolean;
}

export interface UpdateInviteData {
  id: string;
  professionalId: string | null;
  expiresAt: Date;
  isActive: boolean;
  usedAt: Date | null;
}

export interface FindInvitesFilters {
  roleType?: Role;
  onlyActive?: boolean;
  includeExpired?: boolean;
}