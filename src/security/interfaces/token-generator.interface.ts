import { LoginResponseDto } from '../dtos/login-response.dto';
import { UserForAuth } from './user-auth.repository.interface';

export interface ITokenGenerator {
  generate(user: UserForAuth, activeOrgId?: string): Promise<LoginResponseDto>;
}


