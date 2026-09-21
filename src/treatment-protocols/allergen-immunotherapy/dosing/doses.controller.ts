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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
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
@ApiTags('doses')
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
  list(
    @Query() query: ScheduleQueryDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.schedule.list(query, user);
  }
  @Get('metrics')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  metrics(
    @Query() query: SchedulePeriodDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.schedule.metrics(query, user);
  }
  @Get(':id')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  read(@Param('id') id: string, @CurrentUser() user: AuthenticatedUserPayload) {
    return this.clinical.read(id, user);
  }
  @Patch(':id/scheduled')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
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
  preview(
    @Param('id') id: string,
    @Body() dto: DosePreviewDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.clinical.preview(id, dto, user);
  }
  @Post(':id/administer')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  administer(
    @Param('id') id: string,
    @Body() dto: AdministerDoseDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.clinical.administer(id, dto, user);
  }
  @Post(':id/retract')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  retract(
    @Param('id') id: string,
    @Body() dto: RetractDoseDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.correction.retract(id, dto, user);
  }
  @Post(':id/observations')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  addObservation(
    @Param('id') id: string,
    @Body() dto: LateObservationDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.correction.addLateObservation(id, dto, user);
  }
  @Patch(':id')
  @ApiOperation({ deprecated: true })
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  legacy(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.clinical.rejectLegacyWrite(id, user);
  }
  @Patch('update/status/:id')
  @ApiOperation({ deprecated: true })
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  legacyStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.clinical.rejectLegacyWrite(id, user);
  }
}
