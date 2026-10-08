import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedOnly } from 'src/security/decorators/authenticated-only.decorator';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PageDto } from 'src/infra/http/pagination';
import { ProfessionalResponseDto } from './dtos/professional-response.dto';
import {
  ListTeamQueryDto,
  TeamMemberDto,
  UpdateMemberAccessDto,
  UpdateOwnProfileDto,
  UpdateTeamMemberDto,
} from './dtos/team-member.dto';
import { PROFESSIONAL_MESSAGES } from './professional.messages';
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case';
import { UpdateMemberAccessUseCase } from './use-cases/update-member-access.use-case';
import { UpdateTeamMemberUseCase } from './use-cases/update-team-member.use-case';
import { FindProfessionalByIdUseCase } from './use-cases/find-professional-by-id.use-case';

@ApiTags('professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly listTeamMembers: ListTeamMembersUseCase,
    private readonly updateTeamMember: UpdateTeamMemberUseCase,
    private readonly updateMemberAccess: UpdateMemberAccessUseCase,
    private readonly findProfessionalById: FindProfessionalByIdUseCase,
  ) {}

  @Get()
  @CheckPolicies({ action: 'read', subject: 'Professional' })
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
  async changeAccess(
    @Param('id') id: string,
    @Body() dto: UpdateMemberAccessDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updateMemberAccess.execute(id, dto.isActive, currentUser);
  }
}
