import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { CreateDoseUseCase } from 'src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/create-dose.use-case';
import { ListDosesByTherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/list-doses-by-therapy.use-case';
import { CreateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { ImmunotherapyResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto';
import { ReadImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/read-immunotherapy.use-case';
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
    private readImmunotherapyUseCase: ReadImmunotherapyUseCase,
    private listImmunotherapiesForPatientUseCase: ListImmunotherapiesForPatientUseCase,
    private listImmunotherapiesByTypeUseCase: ListImmunotherapiesByTypeUseCase,
    private updateImmunotherapyUseCase: UpdateImmunotherapyUseCase,
    private updateImmunotherapyStatusUseCase: UpdateImmunotherapyStatusUseCase,
    private createDoseUseCase: CreateDoseUseCase,
    private listDosesByTherapyUseCase: ListDosesByTherapyUseCase,
    private listAllImmunotherapies: ListAllImmunotherapiesUseCase,
  ) {}

  @Post('register')
  @CheckPolicies({ action: 'create', subject: 'Immunotherapy' })
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
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  async findAll(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listAllImmunotherapies.execute(currentUser);
  }

  @Get('patients/:patientId')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  async findAllForPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listImmunotherapiesForPatientUseCase.execute(
      patientId,
      currentUser,
    );
  }

  @Get('type/:type')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  async findAllForType(
    @Param('type') type: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listImmunotherapiesByTypeUseCase.execute(type, currentUser);
  }

  @Get(':id')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  async findOneImmunotherapy(
    @Param('id') immunoId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    return this.readImmunotherapyUseCase.execute(immunoId, currentUser);
  }

  @ApiBody({ type: UpdateImmunotherapyDto })
  @Patch(':id')
  @CheckPolicies({ action: 'update', subject: 'Immunotherapy' })
  async updateImmunotherapy(
    @Param('id') immunoId: string,
    @Body() dto: UpdateImmunotherapyDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    return this.updateImmunotherapyUseCase.execute(immunoId, dto, currentUser);
  }

  @ApiBody({ type: UpdateImmunotherapyStatusDto })
  @Patch(':id/status')
  @CheckPolicies({ action: 'update', subject: 'Immunotherapy' })
  async updateImmunotherapyStatus(
    @Param('id') immunoId: string,
    @Body() dto: UpdateImmunotherapyStatusDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    return this.updateImmunotherapyStatusUseCase.execute(
      immunoId,
      dto,
      currentUser,
    );
  }

  @Get(':id/doses')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  async findAllDosesForImmunotherapy(
    @Param('id') immunoId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.listDosesByTherapyUseCase.execute(immunoId, currentUser);
  }
}
