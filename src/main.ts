import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { buildValidationPipe } from './infra/http/validation-pipe';

/**
 * UI e API ficam na mesma origem pelo gateway. CORS só é habilitado quando
 * origens são declaradas explicitamente; uma implantação entre origens exige
 * revisão da arquitetura de sessão, não uma flexibilização automática aqui.
 */
function configuredOrigins(): string[] {
  return (process.env.AUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // O gateway termina o TLS; sem isto o Express não enxerga o protocolo real
  // e os atributos de cookie ficariam avaliados sobre a conexão interna.
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false, // A CSP da UI é servida pelo gateway.
      crossOriginEmbedderPolicy: false,
    }),
  );

  const origins = configuredOrigins();
  if (origins.length > 0) {
    app.enableCors({
      origin: origins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    });
  }

  app.useGlobalPipes(buildValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('Allervia Server')
    .setDescription('The Allervia API Specification')
    .setVersion('1.0')
    .addCookieAuth('__Host-allervia_session', {
      type: 'apiKey',
      in: 'cookie',
      description:
        'Sessão opaca do navegador. O valor é apenas um segredo aleatório.',
    })
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'legacy-bearer')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
