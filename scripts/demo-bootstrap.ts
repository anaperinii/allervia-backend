// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadDemoEnvironment } = require('./demo-environment.cjs') as {
  loadDemoEnvironment: () => { databaseLabel: string };
};

export const demoEnvironment = loadDemoEnvironment();
