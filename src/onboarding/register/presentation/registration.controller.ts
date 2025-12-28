import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { Public } from 'src/security/decorators/public.decorator';
import { RegisterStrategyContext } from '../application/strategies/register-strategy.context';
import { ProfileInternalUserDto } from 'src/account/profiles/application/dtos/profile-internal-user.dto';

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
