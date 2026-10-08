import { Injectable } from '@nestjs/common';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ConfiguredDoseService } from '../configured-dose.service';
import { UpdateDoseStatusDto } from '../dtos/update-dose-status.dto';
@Injectable()
export class UpdateDoseStatusUseCase {
  constructor(private readonly clinical: ConfiguredDoseService) {}
  execute(
    id: string,
    _dto: UpdateDoseStatusDto,
    user: AuthenticatedUserPayload,
  ) {
    return this.clinical.rejectLegacyWrite(id, user);
  }
}
