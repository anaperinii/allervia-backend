import { Injectable } from '@nestjs/common';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ConfiguredDoseService } from '../configured-dose.service';
import { AdministerDoseDto } from '../dtos/configured-dose.dto';
@Injectable()
export class RegisterAdministeredDoseUseCase {
  constructor(private readonly clinical: ConfiguredDoseService) {}
  execute(id: string, dto: AdministerDoseDto, user: AuthenticatedUserPayload) {
    return this.clinical.administer(id, dto, user);
  }
}
