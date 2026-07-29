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
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { AuthenticatedOnly } from 'src/security/decorators/authenticated-only.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
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
  @AuthenticatedOnly()
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.changePasswordUseCase.execute(currentUser.id, dto);
    return { message: 'Senha alterada com sucesso.' };
  }

  @Get('me')
  @AuthenticatedOnly()
  async getPersonalUser(@CurrentUser() currentUser: AuthenticatedUserPayload) {
    return this.findUserByIdUseCase.execute(currentUser.id, currentUser);
  }

  @Patch('update/stats/:id')
  @CheckPolicies({ action: 'update', subject: 'User' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updateUserStatusUseCase.execute(id, dto, currentUser);
  }

  @Patch('update/me')
  @AuthenticatedOnly()
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
  @CheckPolicies({ action: 'update', subject: 'User' })
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
