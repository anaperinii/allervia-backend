import { PreAuthCsrf } from './session/preauth-csrf.decorator';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiOkResponse } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import {
  PasswordResetMessageResponseDto,
  PasswordResetVerifyResponseDto,
} from './dtos/password-reset-responses.dto';
import { PasswordResetRequestDTO } from './dtos/password-reset-request.dto';
import { PasswordResetRequestUseCase } from './use-cases/password-reset-request.use-case';
import { PasswordResetVerifyDTO } from './dtos/password-reset-verify.dto';
import { PasswordResetVerifyUseCase } from './use-cases/password-reset-verify.use-case';
import { PasswordResetConfirmDTO } from './dtos/password-reset-confirm.dto';
import { PasswordResetConfirmUseCase } from './use-cases/password-reset-confirm.use-case';
import {
  EmailChangeMessageResponseDto,
  EmailChangeVerifyResponseDto,
} from './dtos/email-change-responses.dto';
import { EmailChangeVerifyDTO } from './dtos/email-change-verify.dto';
import { EmailChangeVerifyUseCase } from './use-cases/email-change-verify.use-case';
import { EmailChangeConfirmDTO } from './dtos/email-change-confirm.dto';
import { EmailChangeConfirmUseCase } from './use-cases/email-change-confirm.use-case';

@PreAuthCsrf()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly passwordResetRequestUseCase: PasswordResetRequestUseCase,
    private readonly passwordResetVerifyUseCase: PasswordResetVerifyUseCase,
    private readonly passwordResetConfirmUseCase: PasswordResetConfirmUseCase,
    private readonly emailChangeVerifyUseCase: EmailChangeVerifyUseCase,
    private readonly emailChangeConfirmUseCase: EmailChangeConfirmUseCase,
  ) {}

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  @ApiAcceptedResponse({ type: PasswordResetMessageResponseDto })
  async passwordResetRequest(
    @Body() requestDto: PasswordResetRequestDTO,
  ): Promise<PasswordResetMessageResponseDto> {
    await this.passwordResetRequestUseCase.execute(requestDto);
    return {
      message:
        'Se o e-mail existir, enviamos o link de redefinição para sua caixa de entrada.',
    };
  }

  @Post('password-reset/verify')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOkResponse({ type: PasswordResetVerifyResponseDto })
  async passwordResetVerify(
    @Body() verifyDto: PasswordResetVerifyDTO,
  ): Promise<PasswordResetVerifyResponseDto> {
    return this.passwordResetVerifyUseCase.execute(verifyDto);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOkResponse({ type: PasswordResetMessageResponseDto })
  async passwordResetConfirm(
    @Body() confirmDto: PasswordResetConfirmDTO,
  ): Promise<PasswordResetMessageResponseDto> {
    await this.passwordResetConfirmUseCase.execute(confirmDto);
    return { message: 'Senha redefinida com sucesso.' };
  }

  @Post('email-change/verify')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOkResponse({ type: EmailChangeVerifyResponseDto })
  async emailChangeVerify(
    @Body() verifyDto: EmailChangeVerifyDTO,
  ): Promise<EmailChangeVerifyResponseDto> {
    return this.emailChangeVerifyUseCase.execute(verifyDto);
  }

  @Post('email-change/confirm')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOkResponse({ type: EmailChangeMessageResponseDto })
  async emailChangeConfirm(
    @Body() confirmDto: EmailChangeConfirmDTO,
  ): Promise<EmailChangeMessageResponseDto> {
    const result = await this.emailChangeConfirmUseCase.execute(confirmDto);
    return {
      message: `E-mail de acesso alterado para ${result.newEmail}. Entre novamente com o novo endereço.`,
    };
  }
}
