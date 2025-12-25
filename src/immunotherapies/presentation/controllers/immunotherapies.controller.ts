import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ActiveOrganization } from 'src/security/decorators/active-organization.decorator';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Roles } from 'src/security/decorators/roles.decorator';
import { CreateDoseUseCase } from 'src/doses/application/use-cases/create-dose.use-case';
import { ListDosesByTherapyUseCase } from 'src/doses/application/use-cases/list-doses-by-therapy.use-case';
import { CreateDoseDto } from 'src/doses/application/dtos/create-dose.dto';
import { CreateImmunotherapyUseCase } from 'src/immunotherapies/application/use-cases/create-immunotherapy.use-case';
import { ImmunotherapyResponseDto } from 'src/immunotherapies/application/dtos/immunotherapy-response.dto';
import { FindImmunotherapyUseCase } from 'src/immunotherapies/application/use-cases/find-immunotherapy.use-case';
import { ListImmunotherapiesByTypeUseCase } from 'src/immunotherapies/application/use-cases/list-immunotherapies-by-type.use-case';
import { ListImmunotherapiesForPatientUseCase } from 'src/immunotherapies/application/use-cases/list-immunotherapies-for-patient.use-case';
import { UpdateImmunotherapyStatusUseCase } from 'src/immunotherapies/application/use-cases/update-immunotherapy-status.use-case';
import { UpdateImmunotherapyUseCase } from 'src/immunotherapies/application/use-cases/update-immunotherapy.use-case';
import { CreateImmunotherapyDto } from 'src/immunotherapies/application/dtos/create-immunotherapy.dto';
import { UpdateImmunotherapyStatusDto } from 'src/immunotherapies/application/dtos/update-immunotherapy-status.dto';
import { UpdateImmunotherapyDto } from 'src/immunotherapies/application/dtos/update-immunotherapy.dto';
import { PatientResponseDto } from 'src/patients/application/dtos/patient-response.dto';
import { ListAllImmunotherapiesUseCase } from 'src/immunotherapies/application/use-cases/list-all-immunotherapies.use-case';


@ApiTags('immunotherapies')
@Controller('immunotherapies')
export class ImmunotherapiesController {
  constructor(
    private createImmunotherapyUseCase: CreateImmunotherapyUseCase,
    private findImmunotherapyUseCase: FindImmunotherapyUseCase,
    private listImmunotherapiesForPatientUseCase: ListImmunotherapiesForPatientUseCase,
    private listImmunotherapiesByTypeUseCase: ListImmunotherapiesByTypeUseCase,
    private updateImmunotherapyUseCase: UpdateImmunotherapyUseCase,
    private updateImmunotherapyStatusUseCase: UpdateImmunotherapyStatusUseCase,
    private createDoseUseCase: CreateDoseUseCase,
    private listDosesByTherapyUseCase: ListDosesByTherapyUseCase,
    private listAllImmunotherapies: ListAllImmunotherapiesUseCase
  ) {}

  @Post('register')
  @Roles('PHYSICIAN')
  async createImmunotherapy(
    @Body() dto: CreateImmunotherapyDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<{ patient: PatientResponseDto; immunotherapy: ImmunotherapyResponseDto }> {
    return this.createImmunotherapyUseCase.execute(dto, currentUser);
  }

  @Get('list')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findAll(
    @ActiveOrganization() orgId: string,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listAllImmunotherapies.execute(orgId);
  }

  @Get('patients/:patientId')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findAllForPatient(
    @Param('patientId') patientId: string,
    @ActiveOrganization() orgId: string,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listImmunotherapiesForPatientUseCase.execute(patientId, orgId);
  }

  @Get('type/:type')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findAllForType(
    @Param('type') type: string,
    @ActiveOrganization() orgId: string,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listImmunotherapiesByTypeUseCase.execute(type, orgId);
  }

  @Get(':id')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findOneImmunotherapy(
    @Param('id') immunoId: string,
    @ActiveOrganization() orgId: string,
  ): Promise<ImmunotherapyResponseDto> {
    return this.findImmunotherapyUseCase.execute(immunoId, orgId);
  }

  @ApiBody({ type: UpdateImmunotherapyDto })
  @Patch(':id')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async updateImmunotherapy(
    @Param('id') immunoId: string,
    @Body() dto: UpdateImmunotherapyDto,
    @ActiveOrganization() orgId: string
  ): Promise<ImmunotherapyResponseDto> {
    return this.updateImmunotherapyUseCase.execute(immunoId, dto, orgId);
  }

  @ApiBody({ type: UpdateImmunotherapyStatusDto })
  @Patch(':id/status')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async updateImmunotherapyStatus(
    @Param('id') immunoId: string,
    @Body() dto: UpdateImmunotherapyStatusDto,
    @ActiveOrganization() orgId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    return this.updateImmunotherapyStatusUseCase.execute(immunoId, dto, orgId, currentUser);
  }

  @ApiBody({ type: CreateDoseDto })
  @Post(':id/doses/register')
  @Roles('PHYSICIAN', 'NURSE', 'NURSING_TECHNICIAN')
  async createDoseForImmunotherapy(
    @Param('id') immunoId: string,
    @Body() dto: CreateDoseDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.createDoseUseCase.execute(immunoId, dto, currentUser);
  }

  @Get(':id/doses')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN', 'NURSING_TECHNICIAN')
  async findAllDosesForImmunotherapy(
    @Param('id') immunoId: string,
    @ActiveOrganization() orgId: string,
  ) {
    return this.listDosesByTherapyUseCase.execute(immunoId, orgId);
  }
}

