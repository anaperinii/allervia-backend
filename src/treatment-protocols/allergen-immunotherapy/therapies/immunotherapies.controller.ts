import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OrganizationId } from 'src/security/decorators/organization-id.decorator';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { Roles } from 'src/security/decorators/roles.decorator';
import { CreateDoseUseCase } from 'src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/create-dose.use-case';
import { ListDosesByTherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/list-doses-by-therapy.use-case';
import { CreateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { ImmunotherapyResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto';
import { FindImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/find-immunotherapy.use-case';
import { ListImmunotherapiesByTypeUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-immunotherapies-by-type.use-case';
import { ListImmunotherapiesForPatientUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-immunotherapies-for-patient.use-case';
import { UpdateImmunotherapyStatusUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/update-immunotherapy-status.use-case';
import { UpdateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/update-immunotherapy.use-case';
import { CreateImmunotherapyDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/create-immunotherapy.dto';
import { UpdateImmunotherapyStatusDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/update-immunotherapy-status.dto';
import { UpdateImmunotherapyDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/update-immunotherapy.dto';
import { PatientResponseDto } from 'src/patients/dtos/patient-response.dto';
import { ListAllImmunotherapiesUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-all-immunotherapies.use-case';

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
    private listAllImmunotherapies: ListAllImmunotherapiesUseCase,
  ) {}

  @Post('register')
  @Roles('PHYSICIAN')
  async createImmunotherapy(
    @Body() dto: CreateImmunotherapyDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<{
    patient: PatientResponseDto;
    immunotherapy: ImmunotherapyResponseDto;
  }> {
    return this.createImmunotherapyUseCase.execute(dto, currentUser);
  }

  @Get('list')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findAll(
    @OrganizationId() orgId: string,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listAllImmunotherapies.execute(orgId);
  }

  @Get('patients/:patientId')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findAllForPatient(
    @Param('patientId') patientId: string,
    @OrganizationId() orgId: string,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listImmunotherapiesForPatientUseCase.execute(patientId, orgId);
  }

  @Get('type/:type')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findAllForType(
    @Param('type') type: string,
    @OrganizationId() orgId: string,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listImmunotherapiesByTypeUseCase.execute(type, orgId);
  }

  @Get(':id')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findOneImmunotherapy(
    @Param('id') immunoId: string,
    @OrganizationId() orgId: string,
  ): Promise<ImmunotherapyResponseDto> {
    return this.findImmunotherapyUseCase.execute(immunoId, orgId);
  }

  @ApiBody({ type: UpdateImmunotherapyDto })
  @Patch(':id')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async updateImmunotherapy(
    @Param('id') immunoId: string,
    @Body() dto: UpdateImmunotherapyDto,
    @OrganizationId() orgId: string,
  ): Promise<ImmunotherapyResponseDto> {
    return this.updateImmunotherapyUseCase.execute(immunoId, dto, orgId);
  }

  @ApiBody({ type: UpdateImmunotherapyStatusDto })
  @Patch(':id/status')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async updateImmunotherapyStatus(
    @Param('id') immunoId: string,
    @Body() dto: UpdateImmunotherapyStatusDto,
    @OrganizationId() orgId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    return this.updateImmunotherapyStatusUseCase.execute(
      immunoId,
      dto,
      orgId,
      currentUser,
    );
  }

  @Get(':id/doses')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN', 'NURSING_TECHNICIAN')
  async findAllDosesForImmunotherapy(
    @Param('id') immunoId: string,
    @OrganizationId() orgId: string,
  ) {
    return this.listDosesByTherapyUseCase.execute(immunoId, orgId);
  }
}
