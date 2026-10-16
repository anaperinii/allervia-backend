import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { ProfileInternalUserDto } from 'src/account/dtos/profile-internal-user.dto';
import { Public } from 'src/security/decorators/public.decorator';
import { RegisteredUserDto } from './dtos/registration-response.dto';
import { RegisterStrategyContext } from './strategies/register/register-strategy.context';

@Controller('onboarding/registration')
export class RegistrationController {
  constructor(private registerStrategyContext: RegisterStrategyContext) {}

  @Post(':inviteToken')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: RegisteredUserDto })
  async completeRegistration(
    @Param('inviteToken') token: string,
    @Body() dto: ProfileInternalUserDto,
  ) {
    return this.registerStrategyContext.registerInternalUserFromInvite(
      token,
      dto,
    );
  }
}
