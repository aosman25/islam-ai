import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Book } from '../../books/entities/book.entity';

@Entity('pages')
export class Page {
  @PrimaryColumn({ type: 'integer' })
  book_id: number;

  @PrimaryColumn({ type: 'integer' })
  page_id: number;

  @Column({ type: 'text', nullable: true })
  part_title: string;

  @Column({ type: 'integer', nullable: true })
  page_num: number;

  @Column({ type: 'text', nullable: true })
  display_elem: string;

  @ManyToOne(() => Book)
  @JoinColumn({ name: 'book_id' })
  book: Book;
}
