import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { BooksQueryDto } from './dto/books-query.dto';
import { Book } from './entities/book.entity';

@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated books with optional filters' })
  async findAll(@Query() query: BooksQueryDto) {
    return this.booksService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single book by ID with full details' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Book> {
    return this.booksService.findOne(id);
  }

  @Get(':id/toc')
  @ApiOperation({ summary: 'Get table of contents and parts for a book' })
  async getToc(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.getToc(id);
  }
}
