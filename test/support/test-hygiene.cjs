
const ENV_SNAPSHOT = { ...process.env };

afterAll(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  for (const key of Object.keys(process.env)) {
    if (!(key in ENV_SNAPSHOT)) delete process.env[key];
  }
  Object.assign(process.env, ENV_SNAPSHOT);
});

try {
  const { faker } = require('@faker-js/faker');
  const seed = process.env.TEST_SEED
    ? Number(process.env.TEST_SEED)
    : Math.floor(Math.random() * 2 ** 31);
  faker.seed(seed);
  if (process.env.TEST_SEED_LOG === 'true') {
    console.log(`[test-hygiene] faker seed=${seed}`);
  }
  module.exports = { seed };
} catch {
  module.exports = {};
}
