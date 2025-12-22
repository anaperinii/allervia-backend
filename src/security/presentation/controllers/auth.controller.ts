import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../decorators/public.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Roles } from '../../decorators/roles.decorator';
import type { AuthenticatedUserPayload } from '../../types/auth.types';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { SwitchOrganizationUseCase } from '../../application/use-cases/switch-organization.use-case';
import { LoginDto } from '../../application/dtos/login.dto';
import { SwitchOrganizationDto } from '../../application/dtos/switch-organization.dto';

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

