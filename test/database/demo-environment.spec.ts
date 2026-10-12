import demoEnvironment from '../../scripts/demo-environment.cjs';

const { assertDemoDatabase } = demoEnvironment as {
  assertDemoDatabase(
    this: void,
    env: Record<string, string>,
    developmentUrl?: string,
    testUrl?: string,
  ): URL;
};

describe('demo database isolation', () => {
  it('accepts a dedicated local demo database', () => {
    expect(() =>
      assertDemoDatabase(
        { DATABASE_URL: 'postgresql://localhost/allervia_demo' },
        'postgresql://localhost/allervia_db',
        'postgresql://localhost/imunecare_dbtest',
      ),
    ).not.toThrow();
  });

  const unsafeTargets: { name: string; env: Record<string, string> }[] = [
    {
      name: 'production label',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost/allervia_demo',
      },
    },
    {
      name: 'remote host',
      env: { DATABASE_URL: 'postgresql://db.example.com/allervia_demo' },
    },
    {
      name: 'name without demo suffix',
      env: { DATABASE_URL: 'postgresql://localhost/allervia_db' },
    },
    {
      name: 'missing url',
      env: {},
    },
    {
      name: 'non-postgres protocol',
      env: { DATABASE_URL: 'mysql://localhost/allervia_demo' },
    },
  ];

  it.each(unsafeTargets)('rejects an unsafe target: $name', ({ env }) => {
    expect(() => assertDemoDatabase(env)).toThrow();
  });

  it('rejects the development database even behind a loopback alias', () => {
    expect(() =>
      assertDemoDatabase(
        { DATABASE_URL: 'postgresql://127.0.0.1:5432/allervia_demo' },
        'postgresql://localhost/allervia_demo',
      ),
    ).toThrow();
  });

  it('rejects the test database target', () => {
    expect(() =>
      assertDemoDatabase(
        { DATABASE_URL: 'postgresql://localhost/allervia_demo' },
        undefined,
        'postgresql://localhost/allervia_demo',
      ),
    ).toThrow();
  });
});
