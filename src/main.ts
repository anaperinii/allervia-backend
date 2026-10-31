import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();

  configureApp(app);
  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error: unknown) => {
  console.error(
    `[bootstrap] falha ao iniciar: ${error instanceof Error ? error.name + ': ' + error.message : 'erro desconhecido'}`,
  );
  process.exit(1);
});
