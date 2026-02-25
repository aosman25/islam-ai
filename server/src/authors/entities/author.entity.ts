import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('authors')
export class Author {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'text' })
  name: string;
}
