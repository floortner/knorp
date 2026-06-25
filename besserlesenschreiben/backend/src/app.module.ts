import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, type Env } from './config/env';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './services/email/email.module';
import { FsrsModule } from './services/fsrs/fsrs.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ParentModule } from './modules/parent/parent.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AttemptsModule } from './modules/attempts/attempts.module';
import { ProgressModule } from './modules/progress/progress.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            transport: isProd ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
      }),
    }),
    PrismaModule,
    EmailModule,
    FsrsModule,
    AuthModule,
    ProfilesModule,
    ParentModule,
    SessionsModule,
    AttemptsModule,
    ProgressModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
