import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { Roles } from 'src/security/decorators/roles.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { FindUserByIdUseCase } from '../use-cases/users/find-user-by-id.use-case';
import { UpdateUserStatusUseCase } from '../use-cases/users/update-user-status.use-case';
import { UpdateUserStatusDto } from '../dtos/users/update-user-status.dto';
import { CreateSystemAdminUseCase } from 'src/account/use-cases/users/create-system-admin.use-case';
import { Public } from 'src/security/decorators/public.decorator';
import { UpdateUserAdminDto } from '../dtos/users/update-user-admin.dto';
import { UpdateUserBackofficeDto } from '../dtos/users/update-user-backoffice.dto';
import { UpdateUserPersonalDto } from '../dtos/users/update-user-personal.dto';
import { UpdateUserUseCase } from '../use-cases/users/update-user.use-case';
import { ProfileSystemUserDto } from '../dtos/users/profile-system-user.dto';

@Controller('account')
export class AccountController {
  constructor(
    private findUserByIdUseCase: FindUserByIdUseCase,
    private createSystemAdminUseCase: CreateSystemAdminUseCase,
    private updateUserStatusUseCase: UpdateUserStatusUseCase,
    private updateUserPersonalUseCase: UpdateUserUseCase
  ) {}

  @Get('me')
  @Roles('PHYSICIAN', 'NURSE', 'NURSING_TECHNICIAN', 'ADMIN', 'SYSTEM_ADMIN')
  async getPersonalUser(@CurrentUser() currentUser: AuthenticatedUserPayload) {
    return this.findUserByIdUseCase.execute(currentUser.id, currentUser);
  }

  @Post('register/operational')
  @Public()
  @Roles('SYSTEM_ADMIN')
  async registerSystemAdminAccount(@Body() dto: ProfileSystemUserDto) {
    return this.createSystemAdminUseCase.execute(dto);
  }

  @Patch('update/stats/:id')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updateUserStatusUseCase.execute(id, dto, currentUser);
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
    return this.updateUserPersonalUseCase.execute(userId, updateUserDto, currentUser);
  }

  @Patch('update/backoffice/me')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async updateUserPersonalAdmin(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Body() updateUserDto: UpdateUserAdminDto,
  ) {
    return this.updateUserPersonalUseCase.execute(currentUser.id, updateUserDto, currentUser);
  }
}

