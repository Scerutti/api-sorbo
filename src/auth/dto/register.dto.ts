
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole, USER_ROLE_VALUES } from '../../shared/enums/user-role.enum';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @IsOptional()
  @IsString()
  displayName?: string;

  // Sector en el que opera el usuario. Sus ventas descuentan de ese stock.
  @IsOptional()
  @IsMongoId()
  sectorId?: string;
}

export const isValidUserRole = (role: string): role is UserRole =>
  (USER_ROLE_VALUES as readonly string[]).includes(role);
