import { Body, Controller, Post } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dtos/login.dto';
import { LoginUseCase } from './use-cases/login.use-case';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @Public()
  async login(@Body() loginDto: LoginDto) {
    return this.loginUseCase.execute(loginDto);
  }
}
