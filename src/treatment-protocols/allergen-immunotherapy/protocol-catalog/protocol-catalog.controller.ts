import { ProtocolMigrationService } from './protocol-migration.service';
import { BindLegacyProtocolDto } from './protocol-catalog.dto';
import type { ResolvedPrescription } from '../clinical-rules/protocol-definition';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
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
  AutomationSettingsResultDto,
  AutomationSettingsViewDto,
  BindLegacyDryRunResultDto,
  BindLegacyResultDto,
  CreateProtocolResultDto,
  DiscardDraftResultDto,
  MigrationInventoryDto,
  ProtocolVersionDto,
  SimulationEndOfSequenceDto,
  SimulationRecommendedDto,
  SimulationUnresolvedDto,
  TreatmentProtocolDto,
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
  @ApiOkResponse({ type: TreatmentProtocolDto, isArray: true })
  list(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.catalog.list(user);
  }
  @Post()
  @CheckPolicies({ action: 'create', subject: 'TreatmentProtocol' })
  @ApiCreatedResponse({ type: CreateProtocolResultDto })
  create(
    @Body() dto: CreateProtocolDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.create(dto, user);
  }
  @Patch('automation')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  @ApiOkResponse({ type: AutomationSettingsResultDto })
  settings(
    @Body() dto: AutomationSettingsDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.settings(dto, user);
  }
  @Post(':id/versions')
  @CheckPolicies({ action: 'create', subject: 'TreatmentProtocol' })
  @ApiCreatedResponse({ type: ProtocolVersionDto })
  version(
    @Param('id') id: string,
    @Body() dto: CreateProtocolVersionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.createVersion(id, dto.definition, user);
  }
  @Get('versions/:id')
  @CheckPolicies({ action: 'read', subject: 'TreatmentProtocol' })
  @ApiOkResponse({ type: ProtocolVersionDto })
  read(@Param('id') id: string, @CurrentUser() user: AuthenticatedUserPayload) {
    return this.catalog.read(id, user);
  }
  @Patch('versions/:id')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  @ApiOkResponse({ type: ProtocolVersionDto })
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
  @Delete('versions/:id')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  @ApiOkResponse({ type: DiscardDraftResultDto })
  discard(
    @Param('id') id: string,
    @Body() dto: ProtocolRevisionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.discardDraft(id, dto.expectedRevision, user);
  }
  @Post('versions/:id/publish')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  @ApiCreatedResponse({ type: ProtocolVersionDto })
  publish(
    @Param('id') id: string,
    @Body() dto: ProtocolRevisionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.mutate(id, dto.expectedRevision, user, 'publish');
  }
  @Post('versions/:id/retire')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  @ApiCreatedResponse({ type: ProtocolVersionDto })
  retire(
    @Param('id') id: string,
    @Body() dto: ProtocolRevisionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.mutate(id, dto.expectedRevision, user, 'retire');
  }
  @Post('versions/:id/default')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  @ApiCreatedResponse({ type: ProtocolVersionDto })
  defaults(
    @Param('id') id: string,
    @Body() dto: ProtocolRevisionDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.mutate(id, dto.expectedRevision, user, 'default');
  }
  @Post('versions/:id/simulate')
  @CheckPolicies({ action: 'read', subject: 'TreatmentProtocol' })
  @ApiExtraModels(
    SimulationRecommendedDto,
    SimulationEndOfSequenceDto,
    SimulationUnresolvedDto,
  )
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SimulationRecommendedDto) },
        { $ref: getSchemaPath(SimulationEndOfSequenceDto) },
        { $ref: getSchemaPath(SimulationUnresolvedDto) },
      ],
    },
  })
  simulate(
    @Param('id') id: string,
    @Body() dto: SimulateProtocolDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.catalog.simulate(id, dto, user);
  }

  @Get('migration/inventory')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  @ApiOkResponse({ type: MigrationInventoryDto })
  inventory(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.migration.inventory(user);
  }
  @Post('migration/origin-draft')
  @CheckPolicies({ action: 'create', subject: 'TreatmentProtocol' })
  @ApiCreatedResponse({ type: TreatmentProtocolDto })
  origin(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.migration.createOriginDraft(user);
  }
  @Post('migration/therapies/:id')
  @CheckPolicies({ action: 'update', subject: 'TreatmentProtocol' })
  @ApiExtraModels(BindLegacyDryRunResultDto, BindLegacyResultDto)
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(BindLegacyDryRunResultDto) },
        { $ref: getSchemaPath(BindLegacyResultDto) },
      ],
    },
  })
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
  @ApiOkResponse({ type: AutomationSettingsViewDto })
  readSettings(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.catalog.readSettings(user);
  }
}
