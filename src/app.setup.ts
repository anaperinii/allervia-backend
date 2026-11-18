import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { SessionConfig } from './security/session/session.config';
import { buildValidationPipe } from './infra/http/validation-pipe';

function configuredOrigins(): string[] {
  return (process.env.AUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function configureApp(app: NestExpressApplication): void {
  const trustedProxies = (process.env.TRUST_PROXY ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  app.set('trust proxy', trustedProxies.length ? trustedProxies : false);

  app.use(cookieParser());

  const cspMode =
    process.env.CSP_MODE ??
    (process.env.NODE_ENV === 'production' ? 'enforce' : 'report-only');
  const cspReportUri = process.env.CSP_REPORT_URI;
  app.use(
    helmet({
      contentSecurityPolicy:
        cspMode === 'off'
          ? false
          : {
              useDefaults: false,
              reportOnly: cspMode !== 'enforce',
              directives: {
                'default-src': ["'none'"],
                'base-uri': ["'none'"],
                'frame-ancestors': ["'none'"],
                'form-action': ["'none'"],
                'script-src': ["'self'"],
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", 'data:'],
                'font-src': ["'self'"],
                'connect-src': ["'self'"],
                ...(cspReportUri ? { 'report-uri': [cspReportUri] } : {}),
              },
            },
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
}

export function setupSwagger(app: INestApplication): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SWAGGER_ENABLED !== 'true'
  ) {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle('Allervia Server')
    .setDescription('The Allervia API Specification')
    .setVersion('1.0')
    .addCookieAuth(app.get(SessionConfig).cookieName, {
      type: 'apiKey',
      in: 'cookie',
      description: 'Sessão opaca do navegador em cookie HttpOnly.',
    })
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
}
