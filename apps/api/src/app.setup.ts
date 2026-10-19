import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { AppConfig } from './config/app-config';

export const API_PREFIX = 'api';

/** HTTP pipeline shared by the server and the HTTP-level tests. */
export function configureApp(
  app: NestExpressApplication,
  config: Pick<AppConfig, 'CORS_ORIGINS' | 'NODE_ENV'>,
): void {
  // Behind Traefik or Nginx: trust the first proxy so that rate limiting sees the client IP.
  app.set('trust proxy', 1);
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.CORS_ORIGINS, credentials: true });
  app.enableShutdownHooks();

  if (config.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('RiadOS API')
        .setDescription('Multi-tenant property management API for riads and guest houses')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
  }
}
