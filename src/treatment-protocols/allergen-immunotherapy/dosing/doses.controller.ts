import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { PageDto } from 'src/infra/http/pagination';
import { ConfiguredDoseService } from './configured-dose.service';
import { ClinicalScheduleService } from './clinical-schedule.service';
import { DoseCorrectionService } from './dose-correction.service';
import {
  AdministerDoseDto,
  DosePreviewDto,
  UpdateScheduledDoseDto,
} from './dtos/configured-dose.dto';
import { LateObservationDto, RetractDoseDto } from './dtos/dose-correction.dto';
import {
  SchedulePeriodDto,
  ScheduleQueryDto,
} from './dtos/clinical-schedule.dto';
import {
  AdministerDoseResponseDto,
  DoseDetailResponseDto,
  DoseMetricsResponseDto,
  DosePreviewResponseDto,
  LateObservationResponseDto,
  RetractDoseResponseDto,
  ScheduleDoseItemDto,
  UpdateScheduledDoseResponseDto,
} from './dtos/dose-response.dto';
@ApiTags('doses')
@ApiExtraModels(PageDto, ScheduleDoseItemDto)
@ApiResponse({
  status: 400,
  description:
    'Invalid configured value, conflicting step ID, ambiguous value or invalid calendar input',
})
@ApiResponse({
  status: 409,
  description:
    'Stale dose/therapy revision, inactive treatment, disabled automation, pending migration or conflicting idempotency key',
})
@ApiResponse({
  status: 410,
  description:
    'Legacy write route retired; use scheduled, preview or administer',
})
@Controller('doses')
export class DosesController {
  constructor(
    private readonly clinical: ConfiguredDoseService,
    private readonly schedule: ClinicalScheduleService,
    private readonly correction: DoseCorrectionService,
  ) {}
  @Get()
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PageDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(ScheduleDoseItemDto) },
            },
          },
          required: ['items'],
        },
      ],
    },
  })
  list(
    @Query() query: ScheduleQueryDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.schedule.list(query, user);
  }
  @Get('metrics')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  @ApiOkResponse({ type: DoseMetricsResponseDto })
  metrics(
    @Query() query: SchedulePeriodDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.schedule.metrics(query, user);
  }
  @Get(':id')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  @ApiOkResponse({ type: DoseDetailResponseDto })
  read(@Param('id') id: string, @CurrentUser() user: AuthenticatedUserPayload) {
    return this.clinical.read(id, user);
  }
  @Patch(':id/scheduled')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  @ApiOkResponse({ type: UpdateScheduledDoseResponseDto })
  edit(
    @Param('id') id: string,
    @Body() dto: UpdateScheduledDoseDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.clinical.edit(id, dto, user);
  }
  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  @ApiOkResponse({ type: DosePreviewResponseDto })
  preview(
    @Param('id') id: string,
    @Body() dto: DosePreviewDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.clinical.preview(id, dto, user);
  }
  @Post(':id/administer')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  @ApiCreatedResponse({ type: AdministerDoseResponseDto })
  administer(
    @Param('id') id: string,
    @Body() dto: AdministerDoseDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.clinical.administer(id, dto, user);
  }
  @Post(':id/retract')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  @ApiCreatedResponse({ type: RetractDoseResponseDto })
  retract(
    @Param('id') id: string,
    @Body() dto: RetractDoseDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.correction.retract(id, dto, user);
  }
  @Post(':id/observations')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  @ApiCreatedResponse({ type: LateObservationResponseDto })
  addObservation(
    @Param('id') id: string,
    @Body() dto: LateObservationDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.correction.addLateObservation(id, dto, user);
  }
  @Patch(':id')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ deprecated: true })
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  legacy(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.clinical.rejectLegacyWrite(id, user);
  }
  @Patch('update/status/:id')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ deprecated: true })
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  legacyStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.clinical.rejectLegacyWrite(id, user);
  }
}
