import { IsOptional, IsInt, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class BooksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: false, description: 'Include table_of_contents and parts JSONB fields' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_toc: boolean = false;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  category_id?: number;

  @ApiPropertyOptional({ description: 'Filter by author ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  author_id?: number;
}
