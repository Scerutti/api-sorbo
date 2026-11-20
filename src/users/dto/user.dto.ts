
import { Expose, Transform, Type } from 'class-transformer';
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

  // Llega como ObjectId desde Mongo; el front lo necesita como string.
  //
  // Se lee de `obj` (el objeto original) y no de `value`: class-transformer
  // clona el ObjectId antes de llamar al Transform, y ese clon se construye
  // con `new ObjectId()`, que genera un id nuevo al azar. Con `value` cada
  // GET devolvia un sectorId inventado que no coincidia con ningun sector.
  @Expose()
  @Transform(({ obj }) => {
    const raw = (obj as { sectorId?: { toString(): string } | null }).sectorId;
    return raw ? raw.toString() : undefined;
  })
  sectorId?: string;

  @Expose()
  @Type(() => Date)
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  updatedAt?: Date;
}
