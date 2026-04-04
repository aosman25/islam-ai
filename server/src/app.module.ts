import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from './categories/categories.module';
import { AuthorsModule } from './authors/authors.module';
import { BooksModule } from './books/books.module';
import { PagesModule } from './pages/pages.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AnonymousConversationsModule } from './anonymous-conversations/anonymous-conversations.module';
import { Conversation } from './conversations/entities/conversation.entity';
import { Message } from './conversations/entities/message.entity';
import { AnonymousMessage } from './anonymous-conversations/entities/anonymous-message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME') || config.get('POSTGRES_USER', 'admin'),
        password: config.get('DB_PASSWORD') || config.get('POSTGRES_PASSWORD', ''),
        database: config.get('DB_DATABASE', 'islamic-library-db'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'usersConnection',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get('USERS_DATABASE_URI'),
        entities: [Conversation, Message, AnonymousMessage],
        synchronize: true,
      }),
    }),
    CategoriesModule,
    AuthorsModule,
    BooksModule,
    PagesModule,
    ConversationsModule,
    AnonymousConversationsModule,
  ],
})
export class AppModule {}
