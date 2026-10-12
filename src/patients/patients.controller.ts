import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PageDto } from 'src/infra/http/pagination';
import { UpdatePatientStatusDto } from './dtos/update-patient-status.dto';
import { UpdatePatientDto } from './dtos/update-patient.dto';
import { PatientResponseDto } from './dtos/patient-response.dto';
import {
  ListPatientsQueryDto,
  PatientDetailDto,
  PatientListItemDto,
  PatientListPageDto,
} from './dtos/patient-read.dto';
import { FindPatientUseCase } from './use-cases/find-patient.use-case';
import { ListPatientsUseCase } from './use-cases/list-patients.use-case';
import { UpdatePatientStatusUseCase } from './use-cases/update-patient-status.use-case';
import { UpdatePatientUseCase } from './use-cases/update-patient.use-case';

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly findPatientUseCase: FindPatientUseCase,
    private readonly listPatientsUseCase: ListPatientsUseCase,
    private readonly updatePatientUseCase: UpdatePatientUseCase,
    private readonly updatePatientStatusUseCase: UpdatePatientStatusUseCase,
  ) {}

  @Get()
  @CheckPolicies({ action: 'read', subject: 'Patient' })
  @ApiOkResponse({ type: PatientListPageDto })
  async findAll(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Query() query: ListPatientsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PageDto<PatientListItemDto>> {
    response.setHeader('Cache-Control', 'no-store');
    return this.listPatientsUseCase.execute(currentUser, query);
  }

  @Get(':id')
  @CheckPolicies({ action: 'read', subject: 'Patient' })
  @ApiOkResponse({ type: PatientDetailDto })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PatientDetailDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.findPatientUseCase.execute(id, currentUser);
  }

  @ApiBody({ type: UpdatePatientDto })
  @Patch('update/:id')
  @CheckPolicies({ action: 'update', subject: 'Patient' })
  @ApiOkResponse({ type: PatientResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updatePatientUseCase.execute(id, dto, currentUser);
  }

  @ApiBody({ type: UpdatePatientStatusDto })
  @Patch('update/status/:id')
  @CheckPolicies({ action: 'archive', subject: 'Patient' })
  @ApiOperation({
    summary: 'Ativa ou inativa o paciente',
    description:
      'Alterna apenas isActive. Paciente inativo não inicia nova imunoterapia (PATIENT_INACTIVE) nem recebe mutações de dose; ele continua aparecendo nas listagens e consultas.',
  })
  @ApiOkResponse({ type: PatientResponseDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePatientStatusDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updatePatientStatusUseCase.execute(id, dto, currentUser);
  }
}
