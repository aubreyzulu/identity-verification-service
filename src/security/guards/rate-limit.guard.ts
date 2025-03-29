import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  constructor(
    private readonly configService: ConfigService,
    options: Partial<ThrottlerOptions> = {},
    errorMessage?: string,
  ) {
    super(options, errorMessage);
  }

  // Made public for testing purposes
  public async getTracker(req: Record<string, any>): Promise<string> {
    return req.ips.length ? req.ips[0] : req.ip; // Get forwarded IP or fallback to remote IP
  }

  // Made public for testing purposes
  public getLimit(context: ExecutionContext): number {
    const isVerificationEndpoint = context.switchToHttp().getRequest().path.includes('/verification');
    return isVerificationEndpoint
      ? this.configService.get('app.rateLimit.verificationLimit') ?? 5
      : this.configService.get('app.rateLimit.limit') ?? 10;
  }
} 