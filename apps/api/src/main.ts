import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
  });
  
  // Enable CORS (permissif pour le développement)
  app.enableCors({
    origin: true, // Permet toutes les origines en dev
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
  // Enable global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = process.env.PORT ?? 5000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API running on http://0.0.0.0:${port}`);
  console.log(`🚀 API accessible via http://localhost:${port} and http://127.0.0.1:${port}`);
}
bootstrap();