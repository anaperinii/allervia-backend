import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Public } from 'src/security/decorators/public.decorator';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { CreateOrganizationUseCase } from './use-cases/create-organization.use-case';
import { FindOrganizationUseCase } from './use-cases/find-organization.use-case';
import { OrganizationResponseDto } from './dtos/organization-response.dto';

@Controller('organization')
export class OrganizationController {
  constructor(
    private readonly createOrganizationUseCase: CreateOrganizationUseCase,
    private readonly findOrganizationUseCase: FindOrganizationUseCase,
  ) {}

  @Public()
  @Post('register')
  @ApiBody({ type: CreateOrganizationDto })
  async registerOrganization(
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    return this.createOrganizationUseCase.execute(dto);
  }

  @Get(':id')
  async findOneOrganization(
    @Param('id') id: string,
  ): Promise<OrganizationResponseDto> {
    return this.findOrganizationUseCase.execute(id);
  }
}
