import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CreateProfessionalRoleDto } from './dtos/create-role.dto';
import { GrantRoleUseCase } from './use-cases/grant-role.use-case';
import { RevokeRoleUseCase } from './use-cases/revoke-role.use-case';
import { FindRoleByIdUseCase } from './use-cases/find-role-by-id.use-case';
import { ListProfessionalRolesUseCase } from './use-cases/list-professional-roles.use-case';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(
    private readonly grantRoleUseCase: GrantRoleUseCase,
    private readonly revokeRoleUseCase: RevokeRoleUseCase,
    private readonly findRoleByIdUseCase: FindRoleByIdUseCase,
    private readonly listProfessionalRolesUseCase: ListProfessionalRolesUseCase,
  ) {}

  @Post()
  @ApiBody({ type: CreateProfessionalRoleDto })
  @CheckPolicies({ action: 'create', subject: 'ProfessionalRole' })
  async grant(
    @Body() dto: CreateProfessionalRoleDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    if (!currentUser.professionalId) {
      throw new ForbiddenException('Apenas profissionais podem conceder roles');
    }

    return this.grantRoleUseCase.execute({
      professionalId: dto.professionalId,
      role: dto.name,
      grantedById: currentUser.professionalId,
      actorUserId: currentUser.id,
      organizationId: currentUser.organizationId,
    });
  }

  @Get('professional/:professionalId')
  @CheckPolicies({ action: 'read', subject: 'ProfessionalRole' })
  async listByProfessional(@Param('professionalId') professionalId: string) {
    return this.listProfessionalRolesUseCase.execute(professionalId);
  }

  @Get(':id')
  @CheckPolicies({ action: 'read', subject: 'ProfessionalRole' })
  async findOne(@Param('id') id: string) {
    return this.findRoleByIdUseCase.execute(id);
  }

  @Delete(':id')
  @CheckPolicies({ action: 'update', subject: 'ProfessionalRole' })
  async revoke(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    if (!currentUser.professionalId) {
      throw new ForbiddenException('Apenas profissionais podem revogar roles');
    }

    return this.revokeRoleUseCase.execute(id, {
      userId: currentUser.id,
      professionalId: currentUser.professionalId,
      organizationId: currentUser.organizationId,
    });
  }
}
