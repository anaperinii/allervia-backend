import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { AuthenticatedOnly } from 'src/security/decorators/authenticated-only.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { OrganizationResponseDto } from './dtos/organization-response.dto';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';
import { FindOrganizationUseCase } from './use-cases/find-organization.use-case';
import { UpdateOrganizationUseCase } from './use-cases/update-organization.use-case';

@ApiTags('organization')
@Controller('organization')
export class OrganizationController {
  constructor(
    private readonly findOrganizationUseCase: FindOrganizationUseCase,
    private readonly updateOrganizationUseCase: UpdateOrganizationUseCase,
  ) {}

  @Get('me')
  @AuthenticatedOnly()
  @ApiOkResponse({ type: OrganizationResponseDto })
  async findMyOrganization(
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<OrganizationResponseDto> {
    return this.findOrganizationUseCase.execute(currentUser.organizationId);
  }

  @Patch('me')
  @CheckPolicies({ action: 'manage', subject: 'Organization' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  async updateMyOrganization(
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ): Promise<OrganizationResponseDto> {
    return this.updateOrganizationUseCase.execute(dto, currentUser);
  }
}
