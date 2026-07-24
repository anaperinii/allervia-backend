import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ProfileInternalUserDto } from 'src/account/dtos/profile-internal-user.dto';
import { Public } from 'src/security/decorators/public.decorator';
import { RegisterStrategyContext } from './strategies/register/register-strategy.context';

@Controller('onboarding/registration')
export class RegistrationController {
  constructor(
    private registerStrategyContext: RegisterStrategyContext
  ) {}

  @Post(':inviteToken')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async completeRegistration(@Param('inviteToken') token: string, @Body() dto: ProfileInternalUserDto) {
    return this.registerStrategyContext.registerInternalUserFromInvite(token, dto);
  }
}
