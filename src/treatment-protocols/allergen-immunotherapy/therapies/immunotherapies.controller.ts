import {
  Body,
  Controller,
  Get,
  GoneException,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiGoneResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { RateLimit } from 'src/security/rate-limit/rate-limit.decorator';
import { RATE_LIMIT_CLASSES } from 'src/security/rate-limit/rate-limit.config';
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
import { StatusHistoryService } from './status-history.service';
import { PatientClinicalRecordDto, StatusHistoryQueryDto, StatusHistoryResponseDto } from './dtos/status-history.dto';
import {
  ClinicalExportPageDto,
  ClinicalExportQueryDto,
} from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/clinical-export.dto';
import { ClinicalHistoryResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/clinical-history-response.dto';
import { DoseResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/dose-response.dto';
import { ImmunotherapyRegistrationResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-registration-response.dto';
import {
  PrescriptionRevisionAppliedDto,
  PrescriptionRevisionPreviewDto,
} from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/prescription-revision-response.dto';
import {
  TherapyLifecycleHistoryDto,
  TherapyLifecycleResultDto,
} from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/therapy-lifecycle-response.dto';
import { PrescriptionRevisionDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/prescription-revision.dto';
import { CreateImmunotherapyDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/create-immunotherapy.dto';
import { TherapyLifecycleDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/therapy-lifecycle.dto';
import { UpdateImmunotherapyDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/update-immunotherapy.dto';
import { ListAllImmunotherapiesUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-all-immunotherapies.use-case';
import { ListImmunotherapyTypesUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-immunotherapy-types.use-case';
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
    private statusHistory: StatusHistoryService,
    private listDosesByTherapyUseCase: ListDosesByTherapyUseCase,
    private listAllImmunotherapies: ListAllImmunotherapiesUseCase,
    private listImmunotherapyTypesUseCase: ListImmunotherapyTypesUseCase,
  ) {}

  @Post('register')
  @CheckPolicies({ action: 'create', subject: 'Immunotherapy' })
  @ApiCreatedResponse({ type: ImmunotherapyRegistrationResponseDto })
  async createImmunotherapy(
    @Body() dto: CreateImmunotherapyDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.createImmunotherapyUseCase.execute(dto, currentUser);
  }

  @Get('export')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  @RateLimit({
    class: RATE_LIMIT_CLASSES.export,
    keyBy: ['user', 'organization'],
  })
  @ApiOperation({
    summary: 'Exportação clínica paginada de doses',
    description:
      'CONSULTA PAGINADA com corte de pertença por asOf (createdAt <= asOf define quais linhas pertencem ao conjunto; os valores retornados são os atuais). Cada página é lida em uma transação Repeatable Read própria: consistência por página, não snapshot entre páginas. Cada página gera um registro de auditoria EXPORT_GENERATED.',
  })
  @ApiOkResponse({ type: ClinicalExportPageDto })
  @ApiTooManyRequestsResponse({
    description: 'Limite de exportações atingido (RATE_LIMITED).',
  })
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
  @ApiExtraModels(PageDto, ImmunotherapyListItemDto)
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PageDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(ImmunotherapyListItemDto) },
            },
          },
          required: ['items'],
        },
      ],
    },
  })
  async findAll(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Query() query: ListImmunotherapiesQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PageDto<ImmunotherapyListItemDto>> {
    response.setHeader('Cache-Control', 'no-store');
    return this.listAllImmunotherapies.execute(currentUser, query);
  }

  @Get('status-history')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  @ApiOkResponse({ type: StatusHistoryResponseDto })
  async readStatusHistory(@Query() query: StatusHistoryQueryDto, @CurrentUser() user: AuthenticatedUserPayload, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return this.statusHistory.read(query, user);
  }

  @Get('record/:patientId')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  @RateLimit({ class: RATE_LIMIT_CLASSES.export, keyBy: ['user', 'organization'] })
  @ApiOkResponse({ type: PatientClinicalRecordDto })
  async readPatientRecord(@Param('patientId') patientId: string, @CurrentUser() user: AuthenticatedUserPayload, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return this.history.record(patientId, user);
  }

  @Get('patients/:patientId')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  @ApiOkResponse({ type: ImmunotherapyListItemDto, isArray: true })
  async findAllForPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyListItemDto[]> {
    return this.listImmunotherapiesForPatientUseCase.execute(
      patientId,
      currentUser,
    );
  }

  @Get('types')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'string' } } })
  async listTypes(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<string[]> {
    return this.listImmunotherapyTypesUseCase.execute(currentUser);
  }

  @Get('type/:type')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  @ApiOperation({
    description:
      'Lista limitada aos 500 tratamentos não arquivados mais recentes do tipo. Para o conjunto completo use a listagem paginada principal com filtros.',
  })
  @ApiOkResponse({ type: ImmunotherapyResponseDto, isArray: true })
  async findAllForType(
    @Param('type') type: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto[]> {
    return this.listImmunotherapiesByTypeUseCase.execute(type, currentUser);
  }

  @Get(':id')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  @ApiOkResponse({ type: ImmunotherapyDetailDto })
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
  @ApiOkResponse({ type: ImmunotherapyResponseDto })
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
  @ApiCreatedResponse({ type: TherapyLifecycleResultDto })
  async lifecycleCommand(
    @Param('id') immunoId: string,
    @Body() dto: TherapyLifecycleDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.lifecycle.execute(immunoId, dto, currentUser);
  }

  @Get(':id/lifecycle')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  @ApiOkResponse({ type: TherapyLifecycleHistoryDto })
  async lifecycleHistory(
    @Param('id') immunoId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.lifecycle.history(immunoId, currentUser);
  }

  @Get(':id/history')
  @CheckPolicies({ action: 'read', subject: 'Immunotherapy' })
  @ApiOkResponse({ type: ClinicalHistoryResponseDto })
  async clinicalHistory(
    @Param('id') immunoId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.history.history(immunoId, currentUser);
  }

  @ApiBody({ type: PrescriptionRevisionDto })
  @Post(':id/prescription/revision')
  @CheckPolicies({ action: 'update', subject: 'Immunotherapy' })
  @ApiExtraModels(
    PrescriptionRevisionPreviewDto,
    PrescriptionRevisionAppliedDto,
  )
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(PrescriptionRevisionPreviewDto) },
        { $ref: getSchemaPath(PrescriptionRevisionAppliedDto) },
      ],
    },
  })
  async revisePrescription(
    @Param('id') immunoId: string,
    @Body() dto: PrescriptionRevisionDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.revision.revise(immunoId, dto, currentUser);
  }

  @Patch(':id/status')
  @CheckPolicies({ action: 'update', subject: 'Immunotherapy' })
  @HttpCode(HttpStatus.GONE)
  @ApiGoneResponse({
    description: 'Use the lifecycle command with reason and authorship.',
  })
  legacyStatus(): never {
    throw new GoneException('ENDPOINT_RETIRED');
  }

  @Get(':id/doses')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  @ApiOkResponse({ type: DoseResponseDto, isArray: true })
  async findAllDosesForImmunotherapy(
    @Param('id') immunoId: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.listDosesByTherapyUseCase.execute(immunoId, currentUser);
  }
}
