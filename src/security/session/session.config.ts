import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LegacyBearerMode = 'enabled' | 'disabled';
export type MfaEnforcement = 'required' | 'optional';

const SECURE_COOKIE_NAME = '__Host-allervia_session';
const INSECURE_COOKIE_NAME = 'allervia_session';

/**
 * Política de sessão do navegador. Os valores padrão seguem a arquitetura de
 * segurança: inatividade de 15 minutos, teto absoluto de 8 horas e cookie
 * `__Host-` sobre HTTPS. Uma organização pode reduzir os limites; ampliá-los
 * depende de política autorizada e não é configurável só pelo cliente.
 */
@Injectable()
export class SessionConfig {
  constructor(private readonly configService: ConfigService) {}

  private get isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Cookies sem `Secure` existem apenas para desenvolvimento em HTTP puro.
   * Homologação e produção precisam do perfil HTTPS para exercitar os atributos
   * reais, então a flag é ignorada quando NODE_ENV é production.
   */
  get secureCookies(): boolean {
    if (this.isProduction) return true;
    return this.configService.get<string>('AUTH_INSECURE_COOKIES') !== 'true';
  }

  get cookieName(): string {
    return this.secureCookies ? SECURE_COOKIE_NAME : INSECURE_COOKIE_NAME;
  }

  get idleTimeoutMs(): number {
    return this.positiveNumber('SESSION_IDLE_TIMEOUT_MINUTES', 15) * 60_000;
  }

  get absoluteTimeoutMs(): number {
    return this.positiveNumber('SESSION_ABSOLUTE_TIMEOUT_HOURS', 8) * 3_600_000;
  }

  /** Janela curta entre senha verificada e sessão clínica criada. */
  get preAuthChallengeTtlMs(): number {
    return this.positiveNumber('AUTH_PREAUTH_TTL_MINUTES', 5) * 60_000;
  }

  get maxChallengeAttempts(): number {
    return this.positiveNumber('AUTH_CHALLENGE_MAX_ATTEMPTS', 5);
  }

  /** Tentativas de senha por conta dentro da janela, antes de bloquear. */
  get maxLoginAttempts(): number {
    return this.positiveNumber('AUTH_LOGIN_MAX_ATTEMPTS', 10);
  }

  get loginAttemptWindowMs(): number {
    return this.positiveNumber('AUTH_LOGIN_WINDOW_MINUTES', 15) * 60_000;
  }

  /** Idade máxima de autenticação aceita por uma ação sensível. */
  get reauthenticationMaxAgeMs(): number {
    return this.positiveNumber('AUTH_REAUTH_MAX_AGE_MINUTES', 5) * 60_000;
  }

  /**
   * O bearer legado continua disponível para consumidores mapeados fora do web.
   * Em produção ele só existe quando explicitamente habilitado, e mesmo assim
   * respeita revogação e segundo fator como a sessão.
   */
  get legacyBearer(): LegacyBearerMode {
    const configured = this.configService.get<string>('AUTH_LEGACY_BEARER');
    if (configured === 'enabled' || configured === 'disabled') {
      return configured;
    }
    return this.isProduction ? 'disabled' : 'enabled';
  }

  /**
   * `required` exige segundo fator para contas com acesso clínico ou
   * administrativo, inclusive cadastrando o fator no primeiro acesso.
   */
  get mfaEnforcement(): MfaEnforcement {
    const configured = this.configService.get<string>('AUTH_MFA_ENFORCEMENT');
    if (configured === 'required' || configured === 'optional') {
      return configured;
    }
    return this.isProduction ? 'required' : 'optional';
  }

  /** Origens aceitas em comandos; vazio significa mesma origem apenas. */
  get allowedOrigins(): string[] {
    const configured = this.configService.get<string>('AUTH_ALLOWED_ORIGINS');
    if (!configured) return [];
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  /** Chave externa ao banco usada na criptografia autenticada do segredo TOTP. */
  get mfaEncryptionKey(): Buffer | null {
    const configured = this.configService.get<string>('MFA_ENCRYPTION_KEY');
    if (!configured) return null;
    const key = Buffer.from(configured, 'base64');
    return key.length === 32 ? key : null;
  }

  private positiveNumber(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (raw === undefined || raw === null || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
