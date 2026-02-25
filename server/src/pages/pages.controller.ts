import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('pages')
@Controller('books/:bookId/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated pages for a book' })
  async findByBook(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.pagesService.findByBook(bookId, query);
  }
}
