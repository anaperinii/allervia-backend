import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/security/decorators/public.decorator';
import { RoleType } from '@prisma/client';
import { ActiveOrganization } from 'src/security/decorators/active-organization.decorator';
import { CreateRoleDto } from '../dtos/roles/create-role.dto';
import { RoleResponseDto } from '../dtos/roles/role-response.dto';
import { UpdateRoleDto } from '../dtos/roles/update-role.dto';
import { CreateRoleUseCase } from '../use-cases/roles/create-role.use-case';
import { DeleteRoleUseCase } from '../use-cases/roles/delete-role.use-case';
import { FindRoleByIdUseCase } from '../use-cases/roles/find-role-by-id.use-case';
import { ListRolesUseCase } from '../use-cases/roles/list-roles.use-case';
import { UpdateRoleUseCase } from '../use-cases/roles/update-role.use-case';

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

