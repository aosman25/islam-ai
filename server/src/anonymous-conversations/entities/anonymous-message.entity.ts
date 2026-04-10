import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('anonymous_messages')
export class AnonymousMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversation_id: string;

  @Column({ type: 'varchar' })
  role: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'bigint' })
  timestamp: number;

  @Column({ type: 'boolean', default: false })
  is_triage: boolean;

  @CreateDateColumn()
  created_at: Date;
}
