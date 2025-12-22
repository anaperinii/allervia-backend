import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { Roles } from 'src/security/decorators/roles.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ListProfessionalsUseCase } from '../../application/use-cases/list-professionals.use-case';
import { ListProfessionalsByOrganizationUseCase } from '../../application/use-cases/list-professionals-by-organization.use-case';
import { FindProfessionalByIdUseCase } from '../../application/use-cases/find-professional-by-id.use-case';
import { UpdateUserBackofficeDto } from 'src/account/application/dtos/update-user-backoffice.dto';
import { UpdateUserPersonalDto } from 'src/account/application/dtos/update-user-personal.dto';
import { UpdateUserBackofficeUseCase } from 'src/professionals/application/use-cases/update-user-backoffice.use-case';
import { UpdateUserPersonalUseCase } from 'src/professionals/application/use-cases/update-user-personal.use-case';
import { UpdateUserAdminDto } from 'src/account/application/dtos/update-user-admin.dto';
import { UpdateUserPersonalAdminUseCase } from 'src/professionals/application/use-cases/update-user-personal-admin.use-case';

@Controller('professionals')
export class ProfessionalController {
  constructor(
    private listProfessionalsUseCase: ListProfessionalsUseCase,
    private listProfessionalsByOrganizationUseCase: ListProfessionalsByOrganizationUseCase,
    private findProfessionalByIdUseCase: FindProfessionalByIdUseCase,
    private updateUserProfessionalBackoffice: UpdateUserBackofficeUseCase,
    private updateUserPersonalUseCase: UpdateUserPersonalUseCase,
    private updateUserPersonalAdminUseCase: UpdateUserPersonalAdminUseCase
  ) {}

  @Get('org')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async findAllProfessionalsByOrganization(@CurrentUser() currentUser: AuthenticatedUserPayload) {
    return this.listProfessionalsByOrganizationUseCase.execute(currentUser);
  }

  @Get()
  @Roles('SYSTEM_ADMIN')
  async findAllProfessionals() {
    return this.listProfessionalsUseCase.execute();
  }

  @Get(':id')
  @Roles('PHYSICIAN', 'NURSE', 'NURSING_TECHNICIAN', 'ADMIN', 'SYSTEM_ADMIN')
  async findProfessionalById(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.findProfessionalByIdUseCase.execute(id, currentUser);
  }

  @Patch('update/me')
  @Roles('PHYSICIAN', 'NURSE', 'NURSING_TECHNICIAN')
  async updateUserPersonal(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Body() updateUserDto: UpdateUserPersonalDto,
  ) {
    return this.updateUserPersonalUseCase.execute(currentUser.id, updateUserDto, currentUser);
  }
  
  @Patch('update/:id')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async updateUserAsAdmin(
    @Param('id') userId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Body() updateUserDto: UpdateUserBackofficeDto,
  ) {
    return this.updateUserProfessionalBackoffice.execute(userId, updateUserDto, currentUser);
  }

  @Patch('update/backoffice/me')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async updateUserPersonalAdmin(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Body() updateUserDto: UpdateUserAdminDto,
  ) {
    return this.updateUserPersonalAdminUseCase.execute(currentUser.id, updateUserDto, currentUser);
  }
}

