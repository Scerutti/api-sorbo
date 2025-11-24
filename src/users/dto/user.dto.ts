
import { Expose, Type } from 'class-transformer';
import { UserRole } from '../../shared/enums/user-role.enum';
import { BaseResponseDto } from '../../shared/types/common.types';

export class UserDto implements BaseResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  name?: string;

  @Expose()
  roles?: UserRole[];

  @Expose()
  @Type(() => Date)
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  updatedAt?: Date;
}
