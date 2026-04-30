import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
// import { ValidationFilter } from './common/validationFilter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as pinoHttp from 'pino-http';

process.env.TZ = process.env.TZ || 'Asia/Kathmandu';

const docsDescription = `
Welcome to the API docs!

## Features
- JWT Authentication
- Inventory Management
- Sales & Billing
- User Management
- Multi-Shop Support
- Reporting & Analytics
- Purchase Management
- Supplier Management
- Customer Management
- Role-Based Access Control
- Units, Brands, Categories Management
- Product Management
- Inventory Tracking
- Purchase & Sales Returns
- Data Validation & Error Handling
- more...

**Enjoy building!**
`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://unpkg.com', 'http://localhost:*'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // Request logging
  app.use(
    pinoHttp.default({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,req,res,responseTime',
          messageFormat: '{req.method} {req.url} = {res.statusCode} ({responseTime}ms)',
          levelFirst: false,
        },
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Graceful shutdown
  app.enableShutdownHooks();

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('POS Backend')
    .setDescription(docsDescription)
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  app.getHttpAdapter().get('/api/v1/docs-json', (req, res) => {
    res.json(document);
  });

  // Run the application
  await app.listen(port);
  console.log(`\nPOS Backend running at: http://localhost:${port}/${apiPrefix}`);
}
bootstrap();
