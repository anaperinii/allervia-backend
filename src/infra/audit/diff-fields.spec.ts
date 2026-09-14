import { diffFields, isSensitiveField } from './diff-fields';

describe('diffFields', () => {
  it('captura só o campo que mudou', () => {
    const diff = diffFields(
      { email: 'a@x.com', isActive: true },
      { email: 'b@x.com', isActive: true },
      ['email', 'isActive'],
    );

    expect(diff.changedFields).toEqual(['email']);
    expect(diff.oldValues).toEqual({ email: 'a@x.com' });
    expect(diff.newValues).toEqual({ email: 'b@x.com' });
  });

  it('retorna diff vazio quando nada mudou', () => {
    const diff = diffFields({ email: 'a@x.com' }, { email: 'a@x.com' }, [
      'email',
    ]);

    expect(diff.changedFields).toEqual([]);
    expect(diff.oldValues).toEqual({});
    expect(diff.newValues).toEqual({});
  });

  it('ignora campo fora da allowlist mesmo que tenha mudado', () => {
    const diff = diffFields(
      { email: 'a@x.com', internalNote: 'antes' },
      { email: 'a@x.com', internalNote: 'depois' },
      ['email'],
    );

    expect(diff.changedFields).toEqual([]);
  });

  it('redige campo sensível mesmo se o caller o declarar na allowlist', () => {
    const diff = diffFields(
      { password: 'hash-antigo', refreshToken: 't1', email: 'a@x.com' },
      { password: 'hash-novo', refreshToken: 't2', email: 'b@x.com' },
      ['password', 'refreshToken', 'email'],
    );

    expect(diff.changedFields).toEqual(['email']);
    expect(diff.oldValues).not.toHaveProperty('password');
    expect(diff.newValues).not.toHaveProperty('password');
    expect(diff.oldValues).not.toHaveProperty('refreshToken');
    expect(diff.newValues).not.toHaveProperty('refreshToken');
  });

  it('não vaza segredo em nenhuma variação de nome conhecida', () => {
    const sensitive = [
      'password',
      'passwordHash',
      'senha',
      'tokenVersion',
      'refreshToken',
      'clientSecret',
      'passwordSalt',
      'apiKey',
      'authorization',
    ];

    sensitive.forEach((field) => expect(isSensitiveField(field)).toBe(true));
    expect(isSensitiveField('email')).toBe(false);
    expect(isSensitiveField('isActive')).toBe(false);
  });

  it('compara Date por valor, não por referência', () => {
    const diff = diffFields(
      { expiresAt: new Date('2026-01-01T00:00:00Z') },
      { expiresAt: new Date('2026-01-01T00:00:00Z') },
      ['expiresAt'],
    );

    expect(diff.changedFields).toEqual([]);
  });

  it('não trata ordem de chave em objeto aninhado como mudança', () => {
    const diff = diffFields(
      { address: { city: 'SP', zip: '01000' } },
      { address: { zip: '01000', city: 'SP' } },
      ['address'],
    );

    expect(diff.changedFields).toEqual([]);
  });

  it('detecta mudança dentro de objeto aninhado', () => {
    const diff = diffFields(
      { address: { city: 'SP' } },
      { address: { city: 'RJ' } },
      ['address'],
    );

    expect(diff.changedFields).toEqual(['address']);
  });

  it('detecta mudança em array respeitando a ordem', () => {
    const unchanged = diffFields(
      { roles: ['ADMINISTRATOR'] },
      { roles: ['ADMINISTRATOR'] },
      ['roles'],
    );
    const changed = diffFields(
      { roles: ['ADMINISTRATOR'] },
      { roles: ['ADMINISTRATOR', 'PROFESSIONAL'] },
      ['roles'],
    );

    expect(unchanged.changedFields).toEqual([]);
    expect(changed.changedFields).toEqual(['roles']);
  });

  it('distingue null de undefined', () => {
    const diff = diffFields({ archivedAt: null }, {}, ['archivedAt']);

    expect(diff.changedFields).toEqual(['archivedAt']);
    expect(diff.oldValues).toEqual({ archivedAt: null });
    expect(diff.newValues).toEqual({ archivedAt: undefined });
  });

  it('aceita old/new nulos (criação e remoção)', () => {
    const created = diffFields(null, { email: 'a@x.com' }, ['email']);
    const removed = diffFields({ email: 'a@x.com' }, null, ['email']);

    expect(created.changedFields).toEqual(['email']);
    expect(created.newValues).toEqual({ email: 'a@x.com' });
    expect(removed.changedFields).toEqual(['email']);
    expect(removed.oldValues).toEqual({ email: 'a@x.com' });
  });
});
