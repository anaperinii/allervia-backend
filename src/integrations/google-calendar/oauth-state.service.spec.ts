import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { GoogleCalendarConfig } from './google-calendar.config';
import { GoogleTokenBoxService } from './google-token-box.service';
import { OAuthStateService } from './oauth-state.service';

function buildService(ttlMs = 600_000): OAuthStateService {
  const config = {
    tokenEncryptionKey: randomBytes(32),
    oauthStateTtlMs: ttlMs,
  } as GoogleCalendarConfig;
  return new OAuthStateService(config, new GoogleTokenBoxService(config));
}

const input = {
  userId: 'user-1',
  professionalId: 'prof-1',
  organizationId: 'org-1',
};

describe('OAuthStateService', () => {
  it('round-trips the state payload', () => {
    const service = buildService();
    const payload = service.open(service.seal(input));
    expect(payload).toMatchObject(input);
    expect(payload.nonce).toHaveLength(32);
    expect(payload.exp).toBeGreaterThan(Date.now());
  });

  it('rejects an expired state', () => {
    const service = buildService(-1);
    const state = service.seal(input);
    expect(() => service.open(state)).toThrow(BadRequestException);
  });

  it('rejects tampered or garbage states', () => {
    const service = buildService();
    const state = service.seal(input);
    expect(() => service.open(state.slice(0, -4))).toThrow(BadRequestException);
    expect(() => service.open('nonsense')).toThrow(BadRequestException);
  });

  it('rejects states sealed with another key', () => {
    const a = buildService();
    const b = buildService();
    expect(() => b.open(a.seal(input))).toThrow(BadRequestException);
  });
});
