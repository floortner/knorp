import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiZodResponse } from '../../common/zod-openapi';
import { healthSchema } from '../../contract/models';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiZodResponse(healthSchema)
  health() {
    return {
      status: 'ok' as const,
      version: process.env.npm_package_version ?? '0.1.0',
      commit: process.env.GIT_COMMIT ?? 'dev',
    };
  }
}
