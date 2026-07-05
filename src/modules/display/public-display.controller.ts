import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DisplayService } from './display.service';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Public Display')
@Controller('public/display')
export class PublicDisplayController {
  constructor(private readonly displayService: DisplayService) {}

  @Public()
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Get(':token')
  @ApiOperation({ summary: 'Get a sanitized live kitchen order snapshot for a venue TV display' })
  getSnapshot(@Param('token') token: string) {
    return this.displayService.getPublicSnapshot(token);
  }
}
