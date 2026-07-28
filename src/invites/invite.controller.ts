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
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CreateInviteDto } from './dtos/create-invite.dto';
import { ListInvitesQueryDto } from './dtos/list-invites-query.dto';
import { CancelInviteUseCase } from './use-cases/cancel-invite.use-case';
import { CreateInviteUseCase } from './use-cases/create-invite.use-case';
import { ListInvitesUseCase } from './use-cases/list-invites.use-case';

@Controller('onboarding/invites')
export class InviteController {
  constructor(
    private createInviteUseCase: CreateInviteUseCase,
    private cancelInviteUseCase: CancelInviteUseCase,
    private listInvitesUseCase: ListInvitesUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies({ action: 'create', subject: 'InternalUserInvite' })
  async createInvite(
    @Body() dto: CreateInviteDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.createInviteUseCase.execute(dto, currentUser);
  }

  @Get('list')
  @CheckPolicies({ action: 'read', subject: 'InternalUserInvite' })
  async listInvites(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
    @Query() query: ListInvitesQueryDto,
  ) {
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
