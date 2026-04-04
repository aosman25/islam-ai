import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnonymousConversationsService } from './anonymous-conversations.service';
import { CreateConversationDto } from '../conversations/dto/create-conversation.dto';
import { CreateMessageDto } from '../conversations/dto/create-message.dto';

@ApiTags('anonymous-conversations')
@Controller('anonymous-conversations')
export class AnonymousConversationsController {
  constructor(
    private readonly service: AnonymousConversationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an anonymous conversation' })
  async create(@Body() dto: CreateConversationDto) {
    return this.service.create(dto);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Add messages to an anonymous conversation' })
  async addMessages(
    @Param('id') id: string,
    @Body() messages: CreateMessageDto[],
  ) {
    return this.service.addMessages(id, messages);
  }
}
