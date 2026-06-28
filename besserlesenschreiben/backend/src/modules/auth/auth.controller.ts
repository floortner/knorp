import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { okSchema, verifyResponseSchema } from '../../contract/models';
import { AuthService } from './auth.service';
import { RequestCodeDto, VerifyDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('request-code')
  @HttpCode(200)
  @ApiZodBody(RequestCodeDto.schema)
  @ApiZodResponse(okSchema)
  requestCode(@Body() dto: RequestCodeDto) {
    return this.auth.requestCode(dto.email);
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  @ApiZodBody(VerifyDto.schema)
  @ApiZodResponse(verifyResponseSchema)
  verify(@Body() dto: VerifyDto) {
    return this.auth.verify(dto.email, dto.code);
  }
}
