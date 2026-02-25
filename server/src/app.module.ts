import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from './categories/categories.module';
import { AuthorsModule } from './authors/authors.module';
import { BooksModule } from './books/books.module';
import { PagesModule } from './pages/pages.module';

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
    CategoriesModule,
    AuthorsModule,
    BooksModule,
    PagesModule,
  ],
})
export class AppModule {}
