import type { Response } from 'supertest';

/** Envelope público de erro, para asserções tipadas nos testes HTTP. */
export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}

export interface SessionBody {
  authenticated: boolean;
  csrfToken: string;
  session: {
    id: string;
    createdAt: string;
    expiresAt: string;
    lastInteractiveAt: string;
    mfaVerified: boolean;
    reauthenticatedAt: string | null;
  };
  recoveryCodes?: string[];
}

export interface MfaChallengeBody {
  status: 'MFA_REQUIRED' | 'MFA_ENROLLMENT_REQUIRED';
  challengeToken: string;
  expiresAt: string;
  enrollment?: { credentialId: string; secret: string; keyUri: string };
}

export interface AccountBody {
  user: {
    id: string;
    email: string;
    type: string;
    isActive: boolean;
    createdAt: string;
  };
  professional: { id: string; fullName: string } | null;
  organization: { id: string; name: string } | null;
  roles: string[];
  capabilities: string[];
  security: {
    mfaEnabled: boolean;
    mfaRequired: boolean;
    sessionBased: boolean;
  };
}

export interface DeviceBody {
  id: string;
  createdAt: string;
  lastInteractiveAt: string;
  expiresAt: string;
  userAgent: string | null;
  current: boolean;
}

export interface EnrollmentBody {
  credentialId: string;
  secret: string;
  keyUri: string;
}

export interface CsrfBody {
  csrfToken: string;
}

/** O corpo do supertest é `any`; ler por aqui mantém as asserções tipadas. */
export function readBody<T>(response: Response): T {
  return response.body as T;
}

/** `set-cookie` chega como lista; o tipo do supertest declara string. */
export function setCookies(response: Response): string[] {
  const raw: unknown = response.headers['set-cookie'];
  if (Array.isArray(raw)) return raw as string[];
  return typeof raw === 'string' ? [raw] : [];
}

export function joinCookies(response: Response): string {
  return setCookies(response)
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

export function findCookie(response: Response, name: string): string {
  const found = setCookies(response).find((cookie) =>
    cookie.startsWith(`${name}=`),
  );
  if (!found) throw new Error(`Cookie ${name} was not issued.`);
  return found.split(';')[0];
}
