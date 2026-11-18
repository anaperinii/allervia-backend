import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedOnly } from 'src/security/decorators/authenticated-only.decorator';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PageDto } from 'src/infra/http/pagination';
import { ProfessionalResponseDto } from './dtos/professional-response.dto';
import {
  ListTeamQueryDto,
  MemberAccessStatusDto,
  TeamMemberDto,
  TeamMemberPageDto,
  UpdateMemberAccessDto,
  UpdateOwnProfileDto,
  UpdateTeamMemberDto,
} from './dtos/team-member.dto';
import { PROFESSIONAL_MESSAGES } from './professional.messages';
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case';
import { UpdateMemberAccessUseCase } from './use-cases/update-member-access.use-case';
import { UpdateTeamMemberUseCase } from './use-cases/update-team-member.use-case';
import { FindProfessionalByIdUseCase } from './use-cases/find-professional-by-id.use-case';
import { PageQueryDto } from 'src/infra/http/pagination';
import {
  AdminRequestEmailChangeDto,
  EmailChangeRequestDto,
  EmailChangeRequestPageDto,
} from './dtos/request-email-change.dto';
import { ApproveEmailChangeDto } from './dtos/approve-email-change.dto';
import { RequestEmailChangeUseCase } from './use-cases/request-email-change.use-case';
import { ApproveEmailChangeUseCase } from './use-cases/approve-email-change.use-case';
import { RejectEmailChangeUseCase } from './use-cases/reject-email-change.use-case';
import { ListEmailChangeRequestsUseCase } from './use-cases/list-email-change-requests.use-case';

@ApiTags('professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly listTeamMembers: ListTeamMembersUseCase,
    private readonly updateTeamMember: UpdateTeamMemberUseCase,
    private readonly updateMemberAccess: UpdateMemberAccessUseCase,
    private readonly findProfessionalById: FindProfessionalByIdUseCase,
    private readonly requestEmailChange: RequestEmailChangeUseCase,
    private readonly approveEmailChange: ApproveEmailChangeUseCase,
    private readonly rejectEmailChange: RejectEmailChangeUseCase,
    private readonly listEmailChangeRequests: ListEmailChangeRequestsUseCase,
  ) {}

  @Get('email-change-requests')
  @CheckPolicies({ action: 'manage', subject: 'Professional' })
  @ApiOkResponse({ type: EmailChangeRequestPageDto })
  async listPendingEmailChanges(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Query() query: PageQueryDto,
  ): Promise<EmailChangeRequestPageDto> {
    return this.listEmailChangeRequests.execute(currentUser, query);
  }

  @Post('email-change-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies({ action: 'manage', subject: 'Professional' })
  @ApiOkResponse({ type: EmailChangeRequestDto })
  async approvePendingEmailChange(
    @Param('id') id: string,
    @Body() dto: ApproveEmailChangeDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<EmailChangeRequestDto> {
    return this.approveEmailChange.execute(id, dto.channel, currentUser);
  }

  @Post('email-change-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies({ action: 'manage', subject: 'Professional' })
  @ApiOkResponse({ type: EmailChangeRequestDto })
  async rejectPendingEmailChange(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<EmailChangeRequestDto> {
    return this.rejectEmailChange.execute(id, currentUser);
  }

  @Post(':id/email-change')
  @HttpCode(HttpStatus.ACCEPTED)
  @CheckPolicies({ action: 'manage', subject: 'Professional' })
  @ApiAcceptedResponse({ type: EmailChangeRequestDto })
  async startEmailChange(
    @Param('id') id: string,
    @Body() dto: AdminRequestEmailChangeDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<EmailChangeRequestDto> {
    return this.requestEmailChange.execute({
      professionalId: id,
      newEmail: dto.newEmail,
      channel: dto.channel,
      initiator: 'admin',
      currentUser,
    });
  }

  @Get()
  @CheckPolicies({ action: 'read', subject: 'Professional' })
  @ApiOkResponse({ type: TeamMemberPageDto })
  async list(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Query() query: ListTeamQueryDto,
  ): Promise<PageDto<TeamMemberDto>> {
    return this.listTeamMembers.execute(currentUser, query);
  }

  @Get('me')
  @AuthenticatedOnly()
  @ApiOkResponse({ type: ProfessionalResponseDto })
  async readOwnProfile(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ProfessionalResponseDto> {
    if (!currentUser.professionalId) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFoundForUser(currentUser.id),
      );
    }

    return this.findProfessionalById.execute(currentUser.professionalId);
  }

  @Patch('me')
  @AuthenticatedOnly()
  @ApiOkResponse({ type: ProfessionalResponseDto })
  async updateOwnProfile(
    @Body() dto: UpdateOwnProfileDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ProfessionalResponseDto> {
    if (!currentUser.professionalId) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFoundForUser(currentUser.id),
      );
    }

    return this.updateTeamMember.execute(
      currentUser.professionalId,
      dto,
      currentUser,
    );
  }

  @Patch(':id')
  @CheckPolicies({ action: 'manage', subject: 'Professional' })
  @ApiOkResponse({ type: ProfessionalResponseDto })
  async updateMember(
    @Param('id') id: string,
    @Body() dto: UpdateTeamMemberDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<ProfessionalResponseDto> {
    return this.updateTeamMember.execute(id, dto, currentUser);
  }

  @Patch(':id/access')
  @CheckPolicies({ action: 'manage', subject: 'Professional' })
  @ApiOkResponse({ type: MemberAccessStatusDto })
  async changeAccess(
    @Param('id') id: string,
    @Body() dto: UpdateMemberAccessDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updateMemberAccess.execute(id, dto.isActive, currentUser);
  }
}
