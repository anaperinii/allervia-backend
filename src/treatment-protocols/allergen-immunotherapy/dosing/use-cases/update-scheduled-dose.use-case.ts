import { Injectable } from '@nestjs/common';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ConfiguredDoseService } from '../configured-dose.service';
import { UpdateScheduledDoseDto } from '../dtos/configured-dose.dto';
@Injectable()
export class UpdateScheduledDoseUseCase {
  constructor(private readonly clinical: ConfiguredDoseService) {}
  execute(
    id: string,
    dto: UpdateScheduledDoseDto,
    user: AuthenticatedUserPayload,
  ) {
    return this.clinical.edit(id, dto, user);
  }
}
