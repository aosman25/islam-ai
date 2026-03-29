import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './entities/book.entity';
import { BooksQueryDto } from './dto/books-query.dto';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
  ) {}

  async findAll(query: BooksQueryDto) {
    const { page, limit, include_toc, category_id, author_id } = query;

    const qb = this.bookRepository
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.author', 'author')
      .leftJoinAndSelect('book.category', 'category');

    if (!include_toc) {
      qb.select([
        'book.book_id',
        'book.book_name',
        'book.author_id',
        'book.category_id',
        'book.editor',
        'book.edition',
        'book.publisher',
        'book.num_volumes',
        'book.num_pages',
        'book.shamela_pub_date',
        'book.author_full',
        'book.created_at',
        'book.updated_at',
        'author.id',
        'author.name',
        'category.id',
        'category.name',
      ]);
    }

    if (category_id) {
      qb.andWhere('book.category_id = :category_id', { category_id });
    }

    if (author_id) {
      qb.andWhere('book.author_id = :author_id', { author_id });
    }

    qb.orderBy('book.book_name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<Book> {
    const book = await this.bookRepository.findOne({
      where: { book_id: id },
      relations: ['author', 'category'],
    });

    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

    return book;
  }
}
