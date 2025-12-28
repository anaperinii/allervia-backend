import { RoleType } from "@prisma/client";

export class UserRoleResponseDto {
    id: string;
    userId: string;
    roleTag: RoleType;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    user?: {
        organizationId: string | null;
    }
}