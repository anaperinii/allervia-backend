import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { Roles } from 'src/security/decorators/roles.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { FindUserByIdUseCase } from '../application/use-cases/find-user-by-id.use-case';
import { UpdateUserStatusUseCase } from '../application/use-cases/update-user-status.use-case';
import { UpdateUserStatusDto } from '../application/dtos/update-user-status.dto';
import { CreateSystemAdminUseCase } from 'src/account/application/use-cases/create-system-admin.use-case';
import { ProfileSystemUserDto } from 'src/account/application/dtos/profile-system-user.dto';
import { Public } from 'src/security/decorators/public.decorator';

@Controller('account')
export class AccountController {
  constructor(
    private findUserByIdUseCase: FindUserByIdUseCase,
    private createSystemAdminUseCase: CreateSystemAdminUseCase,
    private updateUserStatusUseCase: UpdateUserStatusUseCase,
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
}

