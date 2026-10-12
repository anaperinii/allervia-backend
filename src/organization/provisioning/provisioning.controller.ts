import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/security/decorators/public.decorator';
import { SkipCsrf } from 'src/security/session/skip-csrf.decorator';
import {
  ProvisionOrganizationDto,
  ProvisionedOrganizationDto,
  ResendAdministratorInviteResponseDto,
} from './dtos/provision-organization.dto';
import { ProvisionOrganizationUseCase } from './provision-organization.use-case';
import { ResendOrganizationInviteUseCase } from './resend-organization-invite.use-case';
import { PROVISIONING_HEADER, ProvisioningGuard } from './provisioning.guard';

@ApiTags('provisioning')
@Controller('admin/provisioning')
@Public()
@SkipCsrf()
@UseGuards(ProvisioningGuard)
export class ProvisioningController {
  constructor(
    private readonly provisionOrganization: ProvisionOrganizationUseCase,
    private readonly resendOrganizationInvite: ResendOrganizationInviteUseCase,
  ) {}

  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: PROVISIONING_HEADER,
    description: 'Chave administrativa de provisionamento.',
    required: true,
  })
  @ApiOperation({
    summary: 'Provisiona uma organização com convite de administrador',
    description:
      'Cria a organização e o convite de administrador em uma única transação. O envio do e-mail acontece depois do commit: se o provedor falhar, a resposta ainda é 201 com inviteEmailDelivered=false e o convite pode ser reenviado pela rota de reenvio.',
  })
  @ApiCreatedResponse({ type: ProvisionedOrganizationDto })
  async provision(
    @Body() dto: ProvisionOrganizationDto,
  ): Promise<ProvisionedOrganizationDto> {
    return this.provisionOrganization.execute(dto);
  }

  @Post('organizations/:organizationId/resend-invite')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: PROVISIONING_HEADER,
    description: 'Chave administrativa de provisionamento.',
    required: true,
  })
  @ApiOperation({
    summary: 'Reenvia o convite pendente do administrador da organização',
    description:
      'Localiza o convite de administrador ainda ativo e não utilizado e reenvia o e-mail sem criar um convite novo. Se o convite estiver expirado, ele é cancelado e um novo é emitido na mesma transação (reissued=true).',
  })
  @ApiOkResponse({ type: ResendAdministratorInviteResponseDto })
  @ApiNotFoundResponse({
    description:
      'Organização inexistente ou sem convite de administrador pendente (já utilizado ou cancelado).',
  })
  async resendInvite(
    @Param('organizationId') organizationId: string,
  ): Promise<ResendAdministratorInviteResponseDto> {
    return this.resendOrganizationInvite.execute(organizationId);
  }
}
