import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "src/security/decorators/current-user.decorator";
import type { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { Roles } from "src/security/decorators/roles.decorator";
import { AddMembershipDto } from "../../application/dtos/add-membership.dto";
import { AddMembershipForSystemAdminUseCase } from "../../application/use-cases/add-membership-for-admin.use-case";
import { ListMembershipsByUserUseCase } from "../../application/use-cases/list-memberships-by-user.use-case";
import { ChangeMembershipStatusUseCase } from "src/memberships/application/use-cases/change-membership-status.use-case";

@Controller('memberships')
export class MembershipsController {
    constructor(
        private addMembershipForAdminUseCase: AddMembershipForSystemAdminUseCase,
        private listMembershipsByUserUseCase: ListMembershipsByUserUseCase,
        private changeMembershipStatusUseCase: ChangeMembershipStatusUseCase
    ) {}

    @Roles('SYSTEM_ADMIN')
    @Post('add-adm')
    async addMembershipForSuperAdmin(@Body() dto: AddMembershipDto, @CurrentUser() currentUser: AuthenticatedUserPayload) {
        return await this.addMembershipForAdminUseCase.execute(dto.organizationId, currentUser.id);
    }

    @Roles('SYSTEM_ADMIN', 'PATIENT')
    @Get('list')
    async getUserMemberships(@CurrentUser() currentUser: AuthenticatedUserPayload) {
        return await this.listMembershipsByUserUseCase.execute(currentUser.id);
    }

    @Roles('SYSTEM_ADMIN')
    @Patch('update/stats')
    async updateMembershipStatus(@CurrentUser() currentUser: AuthenticatedUserPayload, @Body('orgId') orgId: string) {
        return await this.changeMembershipStatusUseCase.execute(currentUser, orgId);
    }
}
