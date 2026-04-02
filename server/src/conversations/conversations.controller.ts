import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  private getUserId(authHeader: string | undefined): string {
    if (!authHeader?.startsWith('Bearer '))
      throw new UnauthorizedException('Missing or invalid authorization');
    return authHeader.slice(7);
  }

  @Get()
  @ApiOperation({ summary: 'List conversations with cursor pagination' })
  async findAll(
    @Headers('authorization') authHeader: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const userId = this.getUserId(authHeader);
    return this.conversationsService.findAllByUser(
      userId,
      limit ? parseInt(limit, 10) : 20,
      cursor,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation with paginated messages' })
  async findOne(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Query('messages_limit') messagesLimit?: string,
    @Query('before') before?: string,
  ) {
    const userId = this.getUserId(authHeader);
    return this.conversationsService.findOne(
      id,
      userId,
      messagesLimit ? parseInt(messagesLimit, 10) : 10,
      before ? parseInt(before, 10) : undefined,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  async create(
    @Body() dto: CreateConversationDto,
    @Headers('authorization') authHeader: string,
  ) {
    const userId = this.getUserId(authHeader);
    return this.conversationsService.create(userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update conversation title' })
  async updateTitle(
    @Param('id') id: string,
    @Body('title') title: string,
    @Headers('authorization') authHeader: string,
  ) {
    const userId = this.getUserId(authHeader);
    return this.conversationsService.updateTitle(id, userId, title);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  async delete(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    const userId = this.getUserId(authHeader);
    return this.conversationsService.delete(id, userId);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Add messages to a conversation' })
  async addMessages(
    @Param('id') id: string,
    @Body() messages: CreateMessageDto[],
    @Headers('authorization') authHeader: string,
  ) {
    const userId = this.getUserId(authHeader);
    return this.conversationsService.addMessages(id, userId, messages);
  }
}
