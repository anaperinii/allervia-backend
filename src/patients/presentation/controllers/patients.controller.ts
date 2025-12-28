import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { ActiveOrganization } from 'src/security/decorators/active-organization.decorator';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { Roles } from 'src/security/decorators/roles.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { CreatePatientUseCase } from '../../application/use-cases/create-patient.use-case';
import { FindPatientUseCase } from '../../application/use-cases/find-patient.use-case';
import { ListPatientsUseCase } from '../../application/use-cases/list-patients.use-case';
import { UpdatePatientUseCase } from '../../application/use-cases/update-patient.use-case';
import { UpdatePatientStatusUseCase } from '../../application/use-cases/update-patient-status.use-case';
import { CreatePatientDto } from '../../application/dtos/create-patient.dto';
import { UpdatePatientDto } from '../../application/dtos/update-patient.dto';
import { UpdatePatientStatusDto } from '../../application/dtos/update-patient-status.dto';

@Controller('patients')
export class PatientsController {
  constructor(
    private readonly createPatientUseCase: CreatePatientUseCase,
    private readonly findPatientUseCase: FindPatientUseCase,
    private readonly listPatientsUseCase: ListPatientsUseCase,
    private readonly updatePatientUseCase: UpdatePatientUseCase,
    private readonly updatePatientStatusUseCase: UpdatePatientStatusUseCase,
  ) {}

  @Get()
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findAll(@ActiveOrganization() orgId: string) {
    return this.listPatientsUseCase.execute(orgId);
  }

  @Get(':id')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findOne(
    @Param('id') id: string,
    @ActiveOrganization() orgId: string,
  ) {
    return this.findPatientUseCase.execute(id, orgId);
  }

  @ApiBody({ type: UpdatePatientDto })
  @Patch('update/:id')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @ActiveOrganization() orgId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updatePatientUseCase.execute(id, dto, currentUser);
  }

  @ApiBody({ type: UpdatePatientStatusDto })
  @Patch('update/status/:id')
  @Roles('ADMIN')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePatientStatusDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updatePatientStatusUseCase.execute(id, dto, currentUser);
  }
}


