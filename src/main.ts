import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
// import { ValidationFilter } from './common/validationFilter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
