import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { Roles } from 'src/security/decorators/roles.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { FindUserByIdUseCase } from './use-cases/find-user-by-id.use-case';
import { UpdateUserStatusUseCase } from './use-cases/update-user-status.use-case';
import { UpdateUserStatusDto } from './dtos/update-user-status.dto';
import { UpdateUserBackofficeDto } from './dtos/update-user-backoffice.dto';
import { UpdateUserPersonalDto } from './dtos/update-user-personal.dto';
import { UpdateUserUseCase } from './use-cases/update-user.use-case';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { ChangePasswordDto } from './dtos/change-password.dto';

@Controller('account')
export class AccountController {
  constructor(
    private findUserByIdUseCase: FindUserByIdUseCase,
    private updateUserStatusUseCase: UpdateUserStatusUseCase,
    private updateUserPersonalUseCase: UpdateUserUseCase,
    private changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMINISTRATOR', 'PHYSICIAN', 'NURSE', 'RECEPTIONIST')
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.changePasswordUseCase.execute(currentUser.id, dto);
    return { message: 'Senha alterada com sucesso.' };
  }

  @Get('me')
  @Roles('PHYSICIAN', 'NURSE', 'NURSING_TECHNICIAN', 'ADMIN', 'SYSTEM_ADMIN')
  async getPersonalUser(@CurrentUser() currentUser: AuthenticatedUserPayload) {
    return this.findUserByIdUseCase.execute(currentUser.id, currentUser);
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
    return this.updateUserPersonalUseCase.execute(
      currentUser.id,
      updateUserDto,
      currentUser,
    );
  }

  @Patch('update/:id')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async updateUserAsAdmin(
    @Param('id') userId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Body() updateUserDto: UpdateUserBackofficeDto,
  ) {
    return this.updateUserPersonalUseCase.execute(
      userId,
      updateUserDto,
      currentUser,
    );
  }
}
