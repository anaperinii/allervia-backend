import {
  Body,
  Controller,
  Get,
  GoneException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { ListDosesByTherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/list-doses-by-therapy.use-case';
import { CreateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { ImmunotherapyResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto';
import { ReadImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/read-immunotherapy.use-case';
import { ListImmunotherapiesByTypeUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-immunotherapies-by-type.use-case';
import { ListImmunotherapiesForPatientUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-immunotherapies-for-patient.use-case';
import { UpdateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/update-immunotherapy.use-case';
import { TherapyLifecycleService } from 'src/treatment-protocols/allergen-immunotherapy/therapies/therapy-lifecycle.service';
import { PrescriptionRevisionService } from 'src/treatment-protocols/allergen-immunotherapy/therapies/prescription-revision.service';
import { ClinicalExportService } from 'src/treatment-protocols/allergen-immunotherapy/therapies/clinical-export.service';
import { ClinicalHistoryService } from 'src/treatment-protocols/allergen-immunotherapy/therapies/clinical-history.service';
import { ClinicalExportQueryDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/clinical-export.dto';
import { PrescriptionRevisionDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/prescription-revision.dto';
import { CreateImmunotherapyDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/create-immunotherapy.dto';
import { TherapyLifecycleDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/therapy-lifecycle.dto';
import { UpdateImmunotherapyDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/update-immunotherapy.dto';
import { ListAllImmunotherapiesUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-all-immunotherapies.use-case';
import { PageDto } from 'src/infra/http/pagination';
import {
  ImmunotherapyDetailDto,
  ImmunotherapyListItemDto,
  ListImmunotherapiesQueryDto,
} from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-read.dto';

@ApiTags('immunotherapies')
@Controller('immunotherapies')
export class ImmunotherapiesController {
  constructor(
    private createImmunotherapyUseCase: CreateImmunotherapyUseCase,
    private readImmunotherapyUseCase: ReadImmunotherapyUseCase,
    private listImmunotherapiesForPatientUseCase: ListImmunotherapiesForPatientUseCase,
    private listImmunotherapiesByTypeUseCase: ListImmunotherapiesByTypeUseCase,
    private updateImmunotherapyUseCase: UpdateImmunotherapyUseCase,
    private lifecycle: TherapyLifecycleService,
    private revision: PrescriptionRevisionService,
    private exporter: ClinicalExportService,
    private history: ClinicalHistoryService,
    private listDosesByTherapyUseCase: ListDosesByTherapyUseCase,
    private listAllImmunotherapies: ListAllImmunotherapiesUseCase,
  ) {}

  @Post('register')
  @CheckPolicies({ action: 'create', subject: 'Immunotherapy' })
  async createImmunotherapy(
    @Body() dto: CreateImmunotherapyDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.createImmunotherapyUseCase.execute(dto, currentUser);
  }

  @Get('export')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  async exportClinical(
    @Query() query: ClinicalExportQueryDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.exporter.export(query, currentUser);
  }

  @Get('list')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  async findAll(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Query() query: ListImmunotherapiesQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PageDto<ImmunotherapyListItemDto>> {
    response.setHeader('Cache-Control', 'no-store');
    return this.listAllImmunotherapies.execute(currentUser, query);
  }

  @Get('patients/:patientId')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  async findAllForPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyListItemDto[]> {
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
    @Res({ passthrough: true }) response: Response,
  ): Promise<ImmunotherapyDetailDto> {
    response.setHeader('Cache-Control', 'no-store');
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

  @ApiBody({ type: TherapyLifecycleDto })
  @Post(':id/lifecycle')
  @CheckPolicies({ action: 'update', subject: 'Immunotherapy' })
  async lifecycleCommand(
    @Param('id') immunoId: string,
    @Body() dto: TherapyLifecycleDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.lifecycle.execute(immunoId, dto, currentUser);
  }

  @Get(':id/lifecycle')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  async lifecycleHistory(
    @Param('id') immunoId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.lifecycle.history(immunoId, currentUser);
  }

  @Get(':id/history')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  async clinicalHistory(
    @Param('id') immunoId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.history.history(immunoId, currentUser);
  }

  @ApiBody({ type: PrescriptionRevisionDto })
  @Post(':id/prescription/revision')
  @CheckPolicies({ action: 'update', subject: 'Immunotherapy' })
  async revisePrescription(
    @Param('id') immunoId: string,
    @Body() dto: PrescriptionRevisionDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.revision.revise(immunoId, dto, currentUser);
  }

  @Patch(':id/status')
  @CheckPolicies({ action: 'update', subject: 'Immunotherapy' })
  legacyStatus(): never {
    throw new GoneException(
      'Use the lifecycle command with reason and authorship.',
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
