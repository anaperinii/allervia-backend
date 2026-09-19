import { ProtocolMigrationService } from './protocol-migration.service';
import { BindLegacyProtocolDto } from './protocol-catalog.dto';
import type { ResolvedPrescription } from '../clinical-rules/protocol-definition';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { ProtocolCatalogService } from './protocol-catalog.service';
import {
  CreateProtocolDto,
  CreateProtocolVersionDto,
  EditProtocolVersionDto,
  ProtocolRevisionDto,
  SimulateProtocolDto,
  AutomationSettingsDto,
} from './protocol-catalog.dto';

@ApiTags('treatment-protocols')
@Controller('treatment-protocols')
export class ProtocolCatalogController {
  constructor(
    private readonly catalog: ProtocolCatalogService,
    private readonly migration: ProtocolMigrationService,
  ) {}
  @Get()
  @CheckPolicies({ action: 'read', subject: 'TreatmentProtocol' })
  list(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.catalog.list(user);
  }
  @Post()
  @CheckPolicies({ action: 'create', subject: 'TreatmentProtocol' })
  create(
    @Body() dto: CreateProtocolDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.create(dto, user);
  }
  @Patch('automation')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  settings(
    @Body() dto: AutomationSettingsDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.settings(dto, user);
  }
  @Post(':id/versions')
  @CheckPolicies({ action: 'create', subject: 'TreatmentProtocol' })
  version(
    @Param('id') id: string,
    @Body() dto: CreateProtocolVersionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.createVersion(id, dto.definition, user);
  }
  @Get('versions/:id')
  @CheckPolicies({ action: 'read', subject: 'TreatmentProtocol' })
  read(@Param('id') id: string, @CurrentUser() user: AuthenticatedUserPayload) {
    return this.catalog.read(id, user);
  }
  @Patch('versions/:id')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  edit(
    @Param('id') id: string,
    @Body() dto: EditProtocolVersionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.mutate(
      id,
      dto.expectedRevision,
      user,
      'edit',
      dto.definition,
    );
  }
  @Post('versions/:id/publish')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  publish(
    @Param('id') id: string,
    @Body() dto: ProtocolRevisionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.mutate(id, dto.expectedRevision, user, 'publish');
  }
  @Post('versions/:id/retire')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  retire(
    @Param('id') id: string,
    @Body() dto: ProtocolRevisionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.mutate(id, dto.expectedRevision, user, 'retire');
  }
  @Post('versions/:id/default')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  defaults(
    @Param('id') id: string,
    @Body() dto: ProtocolRevisionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.mutate(id, dto.expectedRevision, user, 'default');
  }
  @Post('versions/:id/simulate')
  @CheckPolicies({ action: 'read', subject: 'TreatmentProtocol' })
  simulate(
    @Param('id') id: string,
    @Body() dto: SimulateProtocolDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.simulate(id, dto, user);
  }

  @Get('migration/inventory')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  inventory(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.migration.inventory(user);
  }
  @Post('migration/origin-draft')
  @CheckPolicies({ action: 'create', subject: 'TreatmentProtocol' })
  origin(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.migration.createOriginDraft(user);
  }
  @Post('migration/therapies/:id')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  bind(
    @Param('id') id: string,
    @Body() dto: BindLegacyProtocolDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.migration.bind(
      id,
      dto.versionId,
      dto.prescription as ResolvedPrescription,
      dto.expectedRevision,
      user,
      dto.dryRun !== false,
    );
  }

  @Get('automation')
  @CheckPolicies({ action: 'read', subject: 'TreatmentProtocol' })
  readSettings(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.catalog.readSettings(user);
  }
}
