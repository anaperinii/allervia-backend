import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class StartSessionDto {
  @ApiProperty({ example: 'profissional@clinica.com.br' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class VerifyMfaDto {
  @ApiProperty({
    description: 'Token do desafio devolvido por POST /auth/sessions.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  challengeToken: string;

  @ApiProperty({ description: 'Código TOTP ou código de recuperação.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;
}

export class ReauthenticateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;
}

export class EnrollMfaDto {
  @ApiPropertyOptional({ example: 'Celular da recepção' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  label?: string;
}

export class ConfirmMfaEnrollmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  credentialId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;
}

export class CsrfTokenResponseDto {
  @ApiProperty()
  csrfToken: string;
}

export class SessionStateDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  lastInteractiveAt: Date;

  @ApiProperty()
  mfaVerified: boolean;

  @ApiProperty({
    description:
      'Momento da última reautenticação; ações sensíveis comparam com a própria política.',
    nullable: true,
  })
  reauthenticatedAt: Date | null;
}

export class SessionEnvelopeDto {
  @ApiProperty()
  authenticated: boolean;

  @ApiProperty({
    description: 'Token sincronizador para o header X-CSRF-Token.',
  })
  csrfToken: string;

  @ApiProperty({ type: SessionStateDto })
  session: SessionStateDto;
}

export class MfaChallengeDto {
  @ApiProperty({ enum: ['MFA_REQUIRED', 'MFA_ENROLLMENT_REQUIRED'] })
  status: 'MFA_REQUIRED' | 'MFA_ENROLLMENT_REQUIRED';

  @ApiProperty()
  challengeToken: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiPropertyOptional({
    description: 'Presente apenas no cadastro inicial do segundo fator.',
  })
  enrollment?: {
    credentialId: string;
    secret: string;
    keyUri: string;
  };
}

export class DeviceSessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  lastInteractiveAt: Date;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty({
    nullable: true,
    description:
      'Descrição aproximada do dispositivo, sem localização inferida.',
  })
  userAgent: string | null;

  @ApiProperty()
  current: boolean;
}

export class MfaFactorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  confirmed: boolean;
}

export class MfaEnrollmentStartDto {
  @ApiProperty()
  credentialId: string;

  @ApiProperty({ description: 'Exibido uma única vez.' })
  secret: string;

  @ApiProperty()
  keyUri: string;
}

export class RecoveryCodesDto {
  @ApiProperty({
    type: [String],
    description: 'Exibidos uma única vez; o servidor guarda apenas o hash.',
  })
  recoveryCodes: string[];
}
