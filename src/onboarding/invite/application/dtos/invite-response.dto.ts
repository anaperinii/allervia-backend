import { RoleType } from "@prisma/client";

export class InviteResponseDto {
    id: string;
    email: string;
    fullName: string;
    roleType: RoleType;
    organizationId: string;
    professionalId: string | null;
    createdById: string;
    createdByName?: string;
    createdByEmail?: string;
    token: string;
    expiresAt: Date;
    isActive: boolean;
    usedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}