import { LoginResponseDto } from 'src/security/dtos/login-response.dto';
import { UserForAuth } from './user-auth.repository.interface';

export interface ITokenGenerator {
  generate(user: UserForAuth): Promise<LoginResponseDto>;
}
