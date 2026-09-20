import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/security/decorators/public.decorator';
import { SkipCsrf } from 'src/security/session/skip-csrf.decorator';
import {
  ProvisionOrganizationDto,
  ProvisionedOrganizationDto,
} from './dtos/provision-organization.dto';
import { ProvisionOrganizationUseCase } from './provision-organization.use-case';
import { PROVISIONING_HEADER, ProvisioningGuard } from './provisioning.guard';

/**
 * Superfície administrativa da plataforma. Não é acessada pelo navegador nem
 * pelo onboarding do produto: a chave de provisionamento nunca chega ao bundle
 * do web.
 */
@ApiTags('provisioning')
@Controller('admin/provisioning')
@Public()
@SkipCsrf()
@UseGuards(ProvisioningGuard)
export class ProvisioningController {
  constructor(
    private readonly provisionOrganization: ProvisionOrganizationUseCase,
  ) {}

  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: PROVISIONING_HEADER,
    description: 'Chave administrativa de provisionamento.',
    required: true,
  })
  async provision(
    @Body() dto: ProvisionOrganizationDto,
  ): Promise<ProvisionedOrganizationDto> {
    return this.provisionOrganization.execute(dto);
  }
}
