import { LoginResponseDto } from 'src/security/dtos/login-response.dto';
import { UserForAuth } from 'src/security/types/user-auth.repository.types';

export interface ITokenGenerator {
  generate(user: UserForAuth): Promise<LoginResponseDto>;
}
