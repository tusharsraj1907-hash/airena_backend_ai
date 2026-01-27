import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('platform-stats')
  async getPlatformStats() {
    return this.analyticsService.getPlatformStats();
  }
}

