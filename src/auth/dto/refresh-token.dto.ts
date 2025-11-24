
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(32)
  @IsOptional()
  refreshToken?: string;
}
