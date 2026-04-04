import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnonymousMessage } from './entities/anonymous-message.entity';
import { CreateMessageDto } from '../conversations/dto/create-message.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AnonymousConversationsService {
  constructor(
    @InjectRepository(AnonymousMessage, 'usersConnection')
    private messagesRepo: Repository<AnonymousMessage>,
  ) {}

  async create(dto: { messages?: CreateMessageDto[] }) {
    const conversationId = uuidv4();

    if (dto.messages?.length) {
      const messages = dto.messages.map((m) =>
        this.messagesRepo.create({ ...m, conversation_id: conversationId }),
      );
      await this.messagesRepo.save(messages);
    }

    return { id: conversationId };
  }

  async addMessages(conversationId: string, dtos: CreateMessageDto[]) {
    const messages = dtos.map((m) =>
      this.messagesRepo.create({ ...m, conversation_id: conversationId }),
    );
    return this.messagesRepo.save(messages);
  }
}
