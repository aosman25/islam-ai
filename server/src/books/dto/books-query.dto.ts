import { IsOptional, IsInt, IsBoolean, IsString, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

function toIntArray(value: unknown): number[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const arr = Array.isArray(value) ? value : String(value).split(',');
  const result = arr.map(Number).filter((n) => !isNaN(n) && n > 0);
  return result.length ? result : undefined;
}

export class BooksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: false, description: 'Include table_of_contents and parts JSONB fields' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_toc: boolean = false;

  @ApiPropertyOptional({
    description: 'Filter by one or more category IDs (comma-separated: 1,2,3)',
    example: '1,2',
  })
  @IsOptional()
  @Transform(({ value }) => toIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  category_ids?: number[];

  @ApiPropertyOptional({
    description: 'Filter by one or more author IDs (comma-separated: 1,2,3)',
    example: '54,72',
  })
  @IsOptional()
  @Transform(({ value }) => toIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  author_ids?: number[];

  @ApiPropertyOptional({ description: 'Search book name (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;
}
