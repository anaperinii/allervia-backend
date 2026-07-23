import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/security/decorators/public.decorator';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { CreateProfessionalRoleDto } from './dtos/roles/create-role.dto';
import { GrantRoleUseCase } from './use-cases/roles/grant-role.use-case';
import { RevokeRoleUseCase } from './use-cases/roles/revoke-role.use-case';
import { FindRoleByIdUseCase } from './use-cases/roles/find-role-by-id.use-case';
import { ListProfessionalRolesUseCase } from './use-cases/roles/list-professional-roles.use-case';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(
    private readonly grantRoleUseCase: GrantRoleUseCase,
    private readonly revokeRoleUseCase: RevokeRoleUseCase,
    private readonly findRoleByIdUseCase: FindRoleByIdUseCase,
    private readonly listProfessionalRolesUseCase: ListProfessionalRolesUseCase,
  ) {}

  @Public()
  @Post('register')
  @ApiBody({ type: CreateProfessionalRoleDto })
  async grantOnboarding(@Body() dto: CreateProfessionalRoleDto) {
    return this.grantRoleUseCase.execute({
      professionalId: dto.professionalId,
      role: dto.name,
      grantedById: dto.professionalId,
      bootstrapKey: dto.key,
    });
  }

  @Post()
  @ApiBody({ type: CreateProfessionalRoleDto })
  async grant(
    @Body() dto: CreateProfessionalRoleDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.grantRoleUseCase.execute({
      professionalId: dto.professionalId,
      role: dto.name,
      grantedById: currentUser.id,
    });
  }

  @Get('professional/:professionalId')
  async listByProfessional(@Param('professionalId') professionalId: string) {
    return this.listProfessionalRolesUseCase.execute(professionalId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.findRoleByIdUseCase.execute(id);
  }

  @Delete(':id')
  async revoke(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.revokeRoleUseCase.execute(id, currentUser.id);
  }
}
