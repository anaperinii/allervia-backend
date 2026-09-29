import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { buildValidationPipe } from './infra/http/validation-pipe';

function configuredOrigins(): string[] {
  return (process.env.AUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust forwarded client addresses only from explicitly configured proxies.
  const trustedProxies = (process.env.TRUST_PROXY ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  app.set('trust proxy', trustedProxies.length ? trustedProxies : false);

  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const origins = configuredOrigins();
  if (origins.length > 0) {
    app.enableCors({
      origin: origins,
      credentials: true,
      allowedHeaders: [
        'X-Session-Context',
        'Content-Type',
        'X-CSRF-Token',
        'X-Request-Id',
      ],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    });
  }

  app.useGlobalPipes(buildValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('Allervia Server')
    .setDescription('The Allervia API Specification')
    .setVersion('1.0')
    .addCookieAuth('__Host-allervia_refresh', {
      type: 'apiKey',
      in: 'cookie',
      description: 'Refresh token opaco. Não autentica rotas clínicas.',
    })
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
