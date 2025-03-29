import { Module, Global } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecurityService } from './security.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RequestIdMiddleware } from './middleware/request-id.middleware';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get('app.rateLimit.ttl'),
        limit: configService.get('app.rateLimit.limit'),
      }),
    }),
  ],
  providers: [
    SecurityService,
    RateLimitGuard,
    {
      provide: 'APP_GUARD',
      useClass: RateLimitGuard,
    },
  ],
  exports: [SecurityService],
})
export class SecurityModule {} 