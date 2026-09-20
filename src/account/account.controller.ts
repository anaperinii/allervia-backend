import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccountContextDto } from './dtos/account-context.dto';
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

@Controller('account')
export class AccountController {
  constructor(
    private getAccountContextUseCase: GetAccountContextUseCase,
    private updateUserStatusUseCase: UpdateUserStatusUseCase,
    private changePasswordUseCase: ChangePasswordUseCase,
    private sessionService: SessionService,
  ) {}

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @AuthenticatedOnly()
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.changePasswordUseCase.execute(currentUser, dto);
    return { message: 'Senha alterada com sucesso.' };
  }

  /**
   * Identidade pública, contexto organizacional e capacidades gerais. A
   * resposta não é cacheável: ela reflete papéis e política de segundo fator
   * vigentes agora.
   */
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
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updateUserStatusUseCase.execute(id, dto, currentUser);
  }

  /**
   * O cadastro profissional tem contrato próprio em `PATCH /professionals/me` e
   * `PATCH /professionals/:id`: nome, telefone e conselho não são campos de um
   * PATCH genérico de usuário.
   */
}
