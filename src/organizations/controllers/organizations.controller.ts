import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Public } from 'src/security/decorators/public.decorator';
import { CreateOrganizationDto } from '../dtos/create-organization.dto';
import { CreateOrganizationUseCase } from '../use-cases/create-organization.use-case';
import { FindOrganizationUseCase } from '../use-cases/find-organization.use-case';


@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly createOrganizationUseCase: CreateOrganizationUseCase,
    private readonly findOrganizationUseCase: FindOrganizationUseCase,
  ) {}

  @Public()
  @Post('register')
  @ApiBody({ type: CreateOrganizationDto })
  async registerOrganization(@Body() dto: CreateOrganizationDto) {
    return this.createOrganizationUseCase.execute(dto);
  }

  @Get(':id')
  async findOneOrganization(@Param('id') id: string) {
    return this.findOrganizationUseCase.execute(id);
  }
}

