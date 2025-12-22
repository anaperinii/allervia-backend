import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { ActiveOrganization } from 'src/security/decorators/active-organization.decorator';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { Roles } from 'src/security/decorators/roles.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { FindDoseUseCase } from '../../application/use-cases/find-dose.use-case';
import { ListDosesByTherapyUseCase } from '../../application/use-cases/list-doses-by-therapy.use-case';
import { UpdateDoseUseCase } from '../../application/use-cases/update-dose.use-case';
import { UpdateDoseStatusUseCase } from '../../application/use-cases/update-dose-status.use-case';
import { UpdateDoseDto } from '../../application/dtos/update-dose.dto';
import { UpdateDoseStatusDto } from '../../application/dtos/update-dose-status.dto';

@Controller('doses')
export class DosesController {
  constructor(
    private readonly findDoseUseCase: FindDoseUseCase,
    private readonly listDosesByTherapyUseCase: ListDosesByTherapyUseCase,
    private readonly updateDoseUseCase: UpdateDoseUseCase,
    private readonly updateDoseStatusUseCase: UpdateDoseStatusUseCase,
  ) {}

  @Get(':id')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async findOne(
    @Param('id') id: string,
    @ActiveOrganization() orgId: string,
  ) {
    return this.findDoseUseCase.execute(id, orgId);
  }

  @ApiBody({ type: UpdateDoseDto })
  @Patch('update/:id')
  @Roles('PHYSICIAN', 'NURSE')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDoseDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updateDoseUseCase.execute(id, dto, currentUser);
  }

  @ApiBody({ type: UpdateDoseStatusDto })
  @Patch('update/status/:id')
  @Roles('PHYSICIAN', 'NURSE', 'ADMIN')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDoseStatusDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updateDoseStatusUseCase.execute(id, dto, currentUser);
  }
}

