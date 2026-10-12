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
  userId: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  lastInteractiveAt: Date;

  @ApiProperty()
  mfaVerified: boolean;

  @ApiProperty({
    description:
      'Momento da última reautenticação; ações sensíveis comparam com a própria política.',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  reauthenticatedAt: Date | null;
}

export class SessionEnvelopeDto {
  @ApiProperty({ oneOf: [{ type: 'boolean', enum: [true] }] })
  authenticated: true;

  @ApiProperty({
    description: 'Token sincronizador para o header X-CSRF-Token.',
  })
  csrfToken: string;

  @ApiProperty({ type: SessionStateDto })
  session: SessionStateDto;
}

export class MfaEnrollmentStartDto {
  @ApiProperty()
  credentialId: string;

  @ApiProperty({ description: 'Exibido uma única vez.' })
  secret: string;

  @ApiProperty()
  keyUri: string;
}

export class MfaChallengeDto {
  @ApiProperty({ enum: ['MFA_REQUIRED'] })
  status: 'MFA_REQUIRED';

  @ApiProperty()
  challengeToken: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;
}

export class MfaEnrollmentChallengeDto {
  @ApiProperty({ enum: ['MFA_ENROLLMENT_REQUIRED'] })
  status: 'MFA_ENROLLMENT_REQUIRED';

  @ApiProperty()
  challengeToken: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({
    type: MfaEnrollmentStartDto,
    description: 'Presente apenas no cadastro inicial do segundo fator.',
  })
  enrollment: MfaEnrollmentStartDto;
}

export class DeviceSessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  lastInteractiveAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({
    type: String,
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

export class RecoveryCodesDto {
  @ApiProperty({
    type: [String],
    description: 'Exibidos uma única vez; o servidor guarda apenas o hash.',
  })
  recoveryCodes: string[];
}

export class MfaVerifiedSessionDto extends SessionEnvelopeDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Presentes apenas quando a verificação conclui o cadastro do segundo fator.',
  })
  recoveryCodes?: string[];
}

export class ReauthenticationResponseDto {
  @ApiProperty({ type: String, format: 'date-time' })
  reauthenticatedAt: Date;

  @ApiProperty({
    description:
      'Janela, em segundos, em que a reautenticação permanece válida.',
  })
  maxAgeSeconds: number;
}

export class MfaFactorsResponseDto {
  @ApiProperty({ type: [MfaFactorDto] })
  factors: MfaFactorDto[];

  @ApiProperty()
  recoveryCodesRemaining: number;
}
