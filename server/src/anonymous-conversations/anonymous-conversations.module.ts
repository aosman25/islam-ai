import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnonymousMessage } from './entities/anonymous-message.entity';
import { AnonymousConversationsService } from './anonymous-conversations.service';
import { AnonymousConversationsController } from './anonymous-conversations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnonymousMessage], 'usersConnection'),
  ],
  controllers: [AnonymousConversationsController],
  providers: [AnonymousConversationsService],
})
export class AnonymousConversationsModule {}
