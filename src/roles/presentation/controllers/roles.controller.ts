import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/security/decorators/public.decorator';
import { CreateRoleUseCase } from '../../application/use-cases/create-role.use-case';
import { ListRolesUseCase } from '../../application/use-cases/list-roles.use-case';
import { FindRoleByIdUseCase } from '../../application/use-cases/find-role-by-id.use-case';
import { UpdateRoleUseCase } from '../../application/use-cases/update-role.use-case';
import { DeleteRoleUseCase } from '../../application/use-cases/delete-role.use-case';
import { CreateRoleDto } from '../../application/dtos/create-role.dto';
import { UpdateRoleDto } from '../../application/dtos/update-role.dto';
import { RoleResponseDto } from '../../application/dtos/role-response.dto';
import { RoleType } from '@prisma/client';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { ActiveOrganization } from 'src/security/decorators/active-organization.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly findRoleByIdUseCase: FindRoleByIdUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
  ) {}

  @Public()
  @Post('register')
  @ApiBody({ type: CreateRoleDto })
  async registerRoleOnboarding(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.createRoleUseCase.execute(dto);
  }

  @Get()
  async findAllRoles(@ActiveOrganization() activeOrgId: string): Promise<RoleResponseDto[]> {
    return this.listRolesUseCase.execute(activeOrgId);
  }

  @Get(':id')
  async findOneRole(@Param('id') id: string, @ActiveOrganization() activeOrgId: string): Promise<RoleResponseDto> {
    return this.findRoleByIdUseCase.execute(id, activeOrgId);
  }

  @ApiBody({ type: UpdateRoleDto })
  @Patch(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @ActiveOrganization() activeOrgId: string
  ): Promise<RoleResponseDto> {
    return this.updateRoleUseCase.execute(id, dto, activeOrgId);
  }

  @Delete(':name')
  async deleteRole(@Param('name') name: RoleType, @ActiveOrganization() activeOrgId: string): Promise<void> {
    return this.deleteRoleUseCase.execute(name, activeOrgId);
  }
}

