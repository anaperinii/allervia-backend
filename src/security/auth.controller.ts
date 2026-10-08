import { PreAuthCsrf } from './session/preauth-csrf.decorator';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { PasswordResetRequestDTO } from './dtos/password-reset-request.dto';
import { PasswordResetRequestUseCase } from './use-cases/password-reset-request.use-case';
import { PasswordResetVerifyDTO } from './dtos/password-reset-verify.dto';
import { PasswordResetVerifyUseCase } from './use-cases/password-reset-verify.use-case';
import { PasswordResetConfirmDTO } from './dtos/password-reset-confirm.dto';
import { PasswordResetConfirmUseCase } from './use-cases/password-reset-confirm.use-case';

@PreAuthCsrf()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly passwordResetRequestUseCase: PasswordResetRequestUseCase,
    private readonly passwordResetVerifyUseCase: PasswordResetVerifyUseCase,
    private readonly passwordResetConfirmUseCase: PasswordResetConfirmUseCase,
  ) {}

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  async passwordResetRequest(@Body() requestDto: PasswordResetRequestDTO) {
    await this.passwordResetRequestUseCase.execute(requestDto);
    return {
      message: 'Se o e-mail existir, enviamos as instruções de redefinição.',
    };
  }

  @Post('password-reset/verify')
  @HttpCode(HttpStatus.OK)
  @Public()
  async passwordResetVerify(@Body() verifyDto: PasswordResetVerifyDTO) {
    return this.passwordResetVerifyUseCase.execute(verifyDto);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Public()
  async passwordResetConfirm(@Body() confirmDto: PasswordResetConfirmDTO) {
    await this.passwordResetConfirmUseCase.execute(confirmDto);
    return { message: 'Senha redefinida com sucesso.' };
  }
}
