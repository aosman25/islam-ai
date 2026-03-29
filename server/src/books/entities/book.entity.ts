import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Author } from '../../authors/entities/author.entity';
import { Category } from '../../categories/entities/category.entity';

@Entity('books')
export class Book {
  @PrimaryColumn({ type: 'integer' })
  book_id: number;

  @Column({ type: 'text', nullable: true })
  book_name: string;

  @Column({ type: 'integer', nullable: true })
  author_id: number;

  @Column({ type: 'integer', nullable: true })
  category_id: number;

  @Column({ type: 'text', nullable: true })
  editor: string;

  @Column({ type: 'text', nullable: true })
  edition: string;

  @Column({ type: 'text', nullable: true })
  publisher: string;

  @Column({ type: 'text', nullable: true })
  num_volumes: string;

  @Column({ type: 'text', nullable: true })
  num_pages: string;

  @Column({ type: 'text', nullable: true })
  shamela_pub_date: string;

  @Column({ type: 'text', nullable: true })
  author_full: string;

  @Column({ type: 'jsonb', nullable: true })
  parts: any;

  @Column({ type: 'jsonb', nullable: true })
  table_of_contents: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ManyToOne(() => Author)
  @JoinColumn({ name: 'author_id' })
  author: Author;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;
}
