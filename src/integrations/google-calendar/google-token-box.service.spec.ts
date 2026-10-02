import { ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { GoogleCalendarConfig } from './google-calendar.config';
import { GoogleTokenBoxService } from './google-token-box.service';

function configWithKey(key: Buffer | null): GoogleCalendarConfig {
  return { tokenEncryptionKey: key } as GoogleCalendarConfig;
}

describe('GoogleTokenBoxService', () => {
  it('round-trips a refresh token', () => {
    const box = new GoogleTokenBoxService(configWithKey(randomBytes(32)));
    const sealed = box.seal('1//refresh-token');
    expect(sealed.ciphertext).not.toContain('refresh-token');
    expect(box.open(sealed)).toBe('1//refresh-token');
  });

  it('rejects tampered ciphertext', () => {
    const box = new GoogleTokenBoxService(configWithKey(randomBytes(32)));
    const sealed = box.seal('segredo');
    const tampered = {
      ...sealed,
      ciphertext: Buffer.from('xx' + sealed.ciphertext, 'base64').toString(
        'base64',
      ),
    };
    expect(() => box.open(tampered)).toThrow();
  });

  it('fails closed without a key', () => {
    const box = new GoogleTokenBoxService(configWithKey(null));
    expect(box.available).toBe(false);
    expect(() => box.seal('x')).toThrow(ServiceUnavailableException);
  });
});
