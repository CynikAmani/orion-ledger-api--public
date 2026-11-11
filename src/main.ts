import { ConfigService } from '@nestjs/config';
import { RequestMethod, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import {
  CONFIG_KEYS,
  EnvironmentVariables,
  getAllowedOriginsFromConfig,
  setupSwagger,
} from './core/config';
import { PUBLIC_STATIC_MOUNTS } from './core/storage/constants/public-static-mounts.constant';
import { UPLOAD_DIRS } from './core/storage/constants/upload-dirs.constant';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService<EnvironmentVariables>);

  const allowedOrigins = getAllowedOriginsFromConfig(configService);

  // CORS must run before helmet, static assets, and routing so OPTIONS
  // preflight is answered before any Nest middleware or guards run.
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      // Non-browser clients (curl, server-to-server) omit Origin.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    // Browser JS cannot read Content-Disposition on cross-origin downloads
    // unless it is explicitly exposed (loan dataset filename, etc.).
    exposedHeaders: ['Content-Disposition'],
  });

  app.use(
    helmet({
      // Marketing images are loaded cross-origin by the portal.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Swagger UI needs inline scripts in non-production.
      contentSecurityPolicy:
        configService.get(CONFIG_KEYS.NODE_ENV, { infer: true }) ===
        'production'
          ? undefined
          : false,
    }),
  );

  for (const mount of PUBLIC_STATIC_MOUNTS) {
    app.useStaticAssets(join(process.cwd(), 'public', mount.relativeDir), {
      prefix: mount.prefix,
    });
  }

  app.setGlobalPrefix('api', {
    exclude: [
      {
        path: `${UPLOAD_DIRS.SUPPORT_TICKETS}/:filename`,
        method: RequestMethod.GET,
      },
    ],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const port = configService.getOrThrow(CONFIG_KEYS.PORT, { infer: true });
  setupSwagger(app, configService);
  await app.listen(port);
}
bootstrap();
