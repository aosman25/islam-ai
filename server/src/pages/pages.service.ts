import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from './entities/page.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
  ) {}

  async findByBook(bookId: number, query: PaginationQueryDto) {
    const { page, limit } = query;
    const [data, total] = await this.pageRepository.findAndCount({
      where: { book_id: bookId },
      order: { page_id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }
}
