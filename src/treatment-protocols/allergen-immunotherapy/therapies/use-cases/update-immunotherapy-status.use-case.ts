import { Injectable } from '@nestjs/common';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ConfiguredDoseService } from '../../dosing/configured-dose.service';
import { UpdateImmunotherapyStatusDto } from '../dtos/update-immunotherapy-status.dto';
@Injectable()
export class UpdateImmunotherapyStatusUseCase {
  constructor(private readonly clinical: ConfiguredDoseService) {}
  execute(
    id: string,
    dto: UpdateImmunotherapyStatusDto,
    user: AuthenticatedUserPayload,
  ) {
    return this.clinical.therapyStatus(
      id,
      dto.status,
      dto.expectedRevision,
      user,
    );
  }
}
