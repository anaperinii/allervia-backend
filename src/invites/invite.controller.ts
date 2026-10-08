import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { Public } from 'src/security/decorators/public.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PageDto } from 'src/infra/http/pagination';
import { CreateInviteDto } from './dtos/create-invite.dto';
import { ListInvitesQueryDto } from './dtos/list-invites-query.dto';
import {
  InviteContextDto,
  InviteResponseDto,
} from './dtos/invite-response.dto';
import { CancelInviteUseCase } from './use-cases/cancel-invite.use-case';
import { CreateInviteUseCase } from './use-cases/create-invite.use-case';
import { ListInvitesUseCase } from './use-cases/list-invites.use-case';
import { FindInviteContextUseCase } from './use-cases/find-invite-context.use-case';

@ApiTags('onboarding')
@Controller('onboarding/invites')
export class InviteController {
  constructor(
    private createInviteUseCase: CreateInviteUseCase,
    private cancelInviteUseCase: CancelInviteUseCase,
    private listInvitesUseCase: ListInvitesUseCase,
    private findInviteContextUseCase: FindInviteContextUseCase,
  ) {}

  @Get('context/:token')
  @Public()
  @ApiOkResponse({ type: InviteContextDto })
  async readContext(@Param('token') token: string): Promise<InviteContextDto> {
    return this.findInviteContextUseCase.execute(token);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies({ action: 'create', subject: 'InternalUserInvite' })
  @ApiOkResponse({ type: InviteResponseDto })
  async createInvite(
    @Body() dto: CreateInviteDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<InviteResponseDto> {
    return this.createInviteUseCase.execute(dto, currentUser);
  }

  @Get('list')
  @CheckPolicies({ action: 'read', subject: 'InternalUserInvite' })
  async listInvites(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Query() query: ListInvitesQueryDto,
  ): Promise<PageDto<InviteResponseDto>> {
    return this.listInvitesUseCase.execute(currentUser, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies({ action: 'update', subject: 'InternalUserInvite' })
  async cancelInvite(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    await this.cancelInviteUseCase.execute(id, currentUser);
  }
}
