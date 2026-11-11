import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CONFIG_KEYS, type EnvironmentVariables } from './index';

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService<EnvironmentVariables>,
) {
  const isEnabled = configService.get(CONFIG_KEYS.SWAGGER_ENABLED, {
    infer: true,
  });

  if (!isEnabled) return;

  const swaggerPath = configService
    .getOrThrow(CONFIG_KEYS.SWAGGER_PATH, { infer: true })
    .replace(/^\/+|\/+$/g, '');

  const config = new DocumentBuilder()
    .setTitle('Xander Creditors API')
    .setDescription(
      'Enterprise backend API for the Xander Creditors platform. Authentication is JWT Bearer unless an endpoint is explicitly public.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(swaggerPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'API Portal',
  });
}
