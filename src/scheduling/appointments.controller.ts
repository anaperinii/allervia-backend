import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto,
} from './dtos/appointment.dto';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @CheckPolicies({ action: 'read', subject: 'Appointment' })
  list(
    @Query() query: ListAppointmentsQueryDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.appointments.list(query, user);
  }

  @Post()
  @CheckPolicies({ action: 'create', subject: 'Appointment' })
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.appointments.create(dto, user);
  }

  @Patch(':id')
  @CheckPolicies({ action: 'update', subject: 'Appointment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.appointments.update(id, dto, user);
  }
}
