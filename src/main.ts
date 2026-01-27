import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  const configService = app.get(ConfigService);
  
  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });
  
  // Validate required environment variables
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingVars: string[] = [];
  
  for (const varName of requiredVars) {
    if (!configService.get<string>(varName)) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Please check your .env file. See .env.example for reference.');
    process.exit(1);
  }
  
  // Validate JWT_SECRET length
  const jwtSecret = configService.get<string>('JWT_SECRET');
  if (jwtSecret && jwtSecret.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters long for security.');
  }
  
  // Check optional but recommended variables
  const databaseUrl = configService.get<string>('DATABASE_URL');
  if (databaseUrl) {
    console.log('✅ Database URL configured');
  }
  
  const port = configService.get<number>('PORT', 3001);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // CORS
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Increase body size limit for file uploads (100MB)
  app.use(require('express').json({ limit: '100mb' }));
  app.use(require('express').urlencoded({ limit: '100mb', extended: true }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(port);
  console.log(`\n✅ Backend Core is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`📚 API Documentation: http://localhost:${port}/${apiPrefix}`);
  console.log(`\n📋 Configuration Status:`);
  console.log(`   - Database: ${databaseUrl ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   - JWT Secret: ${jwtSecret ? '✅ Configured' : '❌ Missing'}`);
  console.log('');
}

bootstrap();

