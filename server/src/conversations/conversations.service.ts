import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation, 'usersConnection')
    private conversationsRepo: Repository<Conversation>,
    @InjectRepository(Message, 'usersConnection')
    private messagesRepo: Repository<Message>,
  ) {}

  async findAllByUser(
    userId: string,
    limit: number = 20,
    cursor?: string,
  ) {
    const qb = this.conversationsRepo
      .createQueryBuilder('c')
      .select(['c.id', 'c.title', 'c.created_at', 'c.updated_at'])
      .where('c.user_id = :userId', { userId })
      .orderBy('c.updated_at', 'DESC')
      .take(limit + 1);

    if (cursor) {
      qb.andWhere('c.updated_at < :cursor', { cursor: new Date(cursor) });
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return {
      data,
      hasMore,
      nextCursor: hasMore
        ? data[data.length - 1].updated_at.toISOString()
        : null,
    };
  }

  async findOne(
    id: string,
    userId: string,
    messagesLimit: number = 10,
    before?: number,
  ) {
    const conversation = await this.conversationsRepo.findOne({
      where: { id },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.user_id !== userId)
      throw new ForbiddenException('Access denied');

    // Count total messages
    const totalMessages = await this.messagesRepo.count({
      where: { conversation_id: id },
    });

    // Fetch messages with cursor-based pagination (newest first, then reverse)
    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .where('m.conversation_id = :id', { id })
      .orderBy('m.timestamp', 'DESC')
      .take(messagesLimit);

    if (before) {
      qb.andWhere('m.timestamp < :before', { before: String(before) });
    }

    const messages = await qb.getMany();
    // Reverse so they're in chronological order
    messages.reverse();

    return {
      ...conversation,
      messages,
      totalMessages,
      hasMoreMessages: messages.length === messagesLimit && totalMessages > messagesLimit,
    };
  }

  async create(userId: string, dto: CreateConversationDto) {
    const conversation = this.conversationsRepo.create({
      user_id: userId,
      title: dto.title || 'New Conversation',
    });
    const saved = await this.conversationsRepo.save(conversation);

    if (dto.messages?.length) {
      const messages = dto.messages.map((m) =>
        this.messagesRepo.create({ ...m, conversation_id: saved.id }),
      );
      await this.messagesRepo.save(messages);
    }

    return saved;
  }

  async updateTitle(id: string, userId: string, title: string) {
    const conversation = await this.conversationsRepo.findOne({
      where: { id },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.user_id !== userId)
      throw new ForbiddenException('Access denied');

    conversation.title = title;
    return this.conversationsRepo.save(conversation);
  }

  async delete(id: string, userId: string) {
    const conversation = await this.conversationsRepo.findOne({
      where: { id },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.user_id !== userId)
      throw new ForbiddenException('Access denied');

    await this.conversationsRepo.remove(conversation);
  }

  async addMessages(id: string, userId: string, dtos: CreateMessageDto[]) {
    const conversation = await this.conversationsRepo.findOne({
      where: { id },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.user_id !== userId)
      throw new ForbiddenException('Access denied');

    const messages = dtos.map((m) =>
      this.messagesRepo.create({ ...m, conversation_id: id }),
    );
    const saved = await this.messagesRepo.save(messages);

    // Touch updated_at
    conversation.updated_at = new Date();
    await this.conversationsRepo.save(conversation);

    return saved;
  }
}
