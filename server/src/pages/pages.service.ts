import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Page } from './entities/page.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
  ) {}

  async findByBook(bookId: number, query: PaginationQueryDto) {
    const { page, limit, offset } = query;
    const skip = offset != null ? offset : (page - 1) * limit;
    const [data, total] = await this.pageRepository.findAndCount({
      where: { book_id: bookId },
      order: { page_id: 'ASC' },
      skip,
      take: limit,
    });

    return { data, total, page, limit, offset: skip };
  }

  async findByBookFromPageId(bookId: number, startPageId: number, limit: number) {
    const [data, total] = await this.pageRepository.findAndCount({
      where: { book_id: bookId, page_id: MoreThanOrEqual(startPageId) },
      order: { page_id: 'ASC' },
      take: limit,
    });

    // Count pages before startPageId so client knows the offset for prev loading
    const offsetBefore = await this.pageRepository
      .createQueryBuilder('p')
      .where('p.book_id = :bookId', { bookId })
      .andWhere('p.page_id < :startPageId', { startPageId })
      .getCount();

    const totalInBook = offsetBefore + total;

    return { data, total: totalInBook, limit, offset: offsetBefore };
  }
}
