import {
  IsString,
  IsNumber,
  IsIn,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty()
  @IsString()
  @IsIn(['user', 'assistant'])
  role: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty()
  @IsNumber()
  timestamp: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_triage?: boolean;
}
