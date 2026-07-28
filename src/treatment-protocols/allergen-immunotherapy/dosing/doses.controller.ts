import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ReadDoseUseCase } from './use-cases/read-dose.use-case';
import { ListDosesByTherapyUseCase } from './use-cases/list-doses-by-therapy.use-case';
import { RegisterAdministeredDoseUseCase } from './use-cases/register-administered-dose.use-case';
import { UpdateDoseStatusUseCase } from './use-cases/update-dose-status.use-case';
import { UpdateDoseDto } from './dtos/update-dose.dto';
import { UpdateDoseStatusDto } from './dtos/update-dose-status.dto';

@Controller('doses')
export class DosesController {
  constructor(
    private readonly readDoseUseCase: ReadDoseUseCase,
    private readonly listDosesByTherapyUseCase: ListDosesByTherapyUseCase,
    private readonly updateDoseUseCase: RegisterAdministeredDoseUseCase,
    private readonly updateDoseStatusUseCase: UpdateDoseStatusUseCase,
  ) {}

  @Get(':id')
  @CheckPolicies({ action: 'read', subject: 'Dose' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.readDoseUseCase.execute(id, currentUser);
  }

  @ApiBody({ type: UpdateDoseDto })
  @Patch(':id')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDoseDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updateDoseUseCase.execute(id, dto, currentUser);
  }

  @ApiBody({ type: UpdateDoseStatusDto })
  @Patch('update/status/:id')
  @CheckPolicies({ action: 'update', subject: 'Dose' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDoseStatusDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.updateDoseStatusUseCase.execute(id, dto, currentUser);
  }
}
