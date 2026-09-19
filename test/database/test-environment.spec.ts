import environment from './test-environment.cjs';

const { assertTestDatabase } = environment as {
  assertTestDatabase(
    this: void,
    env: Record<string, string>,
    developmentUrl?: string,
  ): void;
};

describe('test database isolation', () => {
  it('accepts a dedicated local test database', () => {
    expect(() =>
      assertTestDatabase(
        {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://localhost/allervia_test',
        },
        'postgresql://localhost/allervia',
      ),
    ).not.toThrow();
  });

  it.each([
    {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/allervia_test',
    },
    { NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/allervia' },
    {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://remote.example/allervia_test',
    },
  ])('rejects an unsafe database target', (env) => {
    expect(() => assertTestDatabase(env)).toThrow();
  });

  it('rejects the development database even with a different loopback alias and schema', () => {
    expect(() =>
      assertTestDatabase(
        {
          NODE_ENV: 'test',
          DATABASE_URL:
            'postgresql://127.0.0.1:5432/allervia_test?schema=tests',
        },
        'postgresql://localhost/allervia_test?schema=public',
      ),
    ).toThrow();
  });
});
