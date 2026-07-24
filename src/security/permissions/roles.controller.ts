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
import { Public } from 'src/security/decorators/public.decorator';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';
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
    if (!currentUser.professionalId) {
      throw new ForbiddenException('Apenas profissionais podem conceder roles');
    }

    return this.grantRoleUseCase.execute({
      professionalId: dto.professionalId,
      role: dto.name,
      grantedById: currentUser.professionalId,
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
