import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiOkResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccountContextDto } from './dtos/account-context.dto';
import { ChangePasswordResponseDto } from './dtos/change-password-response.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { GetAccountContextUseCase } from './use-cases/get-account-context.use-case';
import { SessionService } from 'src/security/session/session.service';
import type { RequestWithSession } from 'src/security/session/session-auth.guard';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { AuthenticatedOnly } from 'src/security/decorators/authenticated-only.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { UpdateUserStatusUseCase } from './use-cases/update-user-status.use-case';
import { UpdateUserStatusDto } from './dtos/update-user-status.dto';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { CurrentSession } from 'src/security/session/current-session.decorator';
import type { StoredSession } from 'src/security/session/session.types';
import { PROFESSIONAL_MESSAGES } from 'src/professionals/professional.messages';
import {
  EmailChangeRequestDto,
  SelfRequestEmailChangeDto,
} from 'src/professionals/dtos/request-email-change.dto';
import { RequestEmailChangeUseCase } from 'src/professionals/use-cases/request-email-change.use-case';

@Controller('account')
export class AccountController {
  constructor(
    private getAccountContextUseCase: GetAccountContextUseCase,
    private updateUserStatusUseCase: UpdateUserStatusUseCase,
    private changePasswordUseCase: ChangePasswordUseCase,
    private requestEmailChangeUseCase: RequestEmailChangeUseCase,
    private sessionService: SessionService,
  ) {}

  @Post('me/email-change')
  @HttpCode(HttpStatus.ACCEPTED)
  @AuthenticatedOnly()
  @ApiAcceptedResponse({ type: EmailChangeRequestDto })
  async requestOwnEmailChange(
    @Body() dto: SelfRequestEmailChangeDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @CurrentSession() session: StoredSession,
  ): Promise<EmailChangeRequestDto> {
    this.sessionService.assertRecentReauthentication(session);

    if (!currentUser.professionalId) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFoundForUser(currentUser.id),
      );
    }

    return this.requestEmailChangeUseCase.execute({
      professionalId: currentUser.professionalId,
      newEmail: dto.newEmail,
      initiator: 'self',
      currentUser,
    });
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @AuthenticatedOnly()
  @ApiOkResponse({ type: ChangePasswordResponseDto })
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    await this.changePasswordUseCase.execute(currentUser, dto);
    return { message: 'Senha alterada com sucesso.' };
  }

  @Get('me')
  @AuthenticatedOnly()
  @ApiOkResponse({ type: AccountContextDto })
  async getAccountContext(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Req() request: RequestWithSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccountContextDto> {
    response.setHeader('Cache-Control', 'no-store');

    return this.getAccountContextUseCase.execute({
      userId: currentUser.id,
      sessionBased: Boolean(request.authSession),
      mfaRequired: request.authContext
        ? this.sessionService.requiresSecondFactor(request.authContext)
        : false,
    });
  }

  @Patch('update/stats/:id')
  @CheckPolicies({ action: 'update', subject: 'User' })
  @ApiOkResponse({ type: UserResponseDto })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {
    return this.updateUserStatusUseCase.execute(id, dto, currentUser);
  }
}
