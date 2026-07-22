import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dtos/login.dto';
import { SwitchOrganizationDto } from './dtos/switch-organization.dto';
import type { AuthenticatedUserPayload } from './types/auth.types';
import { LoginUseCase } from './use-cases/login.use-case';
import { SwitchOrganizationUseCase } from './use-cases/switch-organization.use-case';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly switchOrganizationUseCase: SwitchOrganizationUseCase,
  ) {}

  @Post('login')
  @Public()
  async login(@Body() loginDto: LoginDto) {
    return this.loginUseCase.execute(loginDto);
  }

  @Post('switch-organization')
  @Roles('SYSTEM_ADMIN', 'PATIENT')
  async switchOrganization(
    @Body() dto: SwitchOrganizationDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.switchOrganizationUseCase.execute(dto, currentUser);
  }
}

