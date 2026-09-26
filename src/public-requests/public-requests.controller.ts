import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { DemoRequestDto, DemoRequestReceiptDto } from './demo-request.dto';
import { DemoRequestsService } from './demo-requests.service';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Public } from 'src/security/decorators/public.decorator';
import { AuthenticatedOnly } from 'src/security/decorators/authenticated-only.decorator';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PublicRequestsService } from './public-requests.service';

class ContactRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @ApiProperty() @IsEmail() @MaxLength(320) email: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organization?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(4000) message: string;
}

class SupportRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) subject: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(4000) message: string;
}

@ApiTags('requests')
@Controller()
export class PublicRequestsController {
  constructor(
    private readonly requests: PublicRequestsService,
    private readonly demos: DemoRequestsService,
  ) {}

  @Public()
  @Post('demo-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: DemoRequestReceiptDto })
  demo(@Body() dto: DemoRequestDto, @Req() request: Request) {
    return this.demos.create(
      dto,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Public()
  @Post('contact-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  contact(@Body() dto: ContactRequestDto) {
    return this.requests.createContactRequest(dto);
  }

  @AuthenticatedOnly()
  @Post('support-requests')
  support(
    @Body() dto: SupportRequestDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.requests.createSupportRequest(dto, user);
  }

  @AuthenticatedOnly()
  @Get('support-requests')
  listSupport(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.requests.listSupportRequests(user);
  }
}
