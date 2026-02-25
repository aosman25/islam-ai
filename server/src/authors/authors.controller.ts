import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthorsService } from './authors.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('authors')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated authors' })
  async findAll(@Query() query: PaginationQueryDto) {
    return this.authorsService.findAll(query);
  }
}
