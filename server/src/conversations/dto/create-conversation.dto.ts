import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateMessageDto } from './create-message.dto';

export class CreateConversationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ type: [CreateMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMessageDto)
  @IsOptional()
  messages?: CreateMessageDto[];
}
