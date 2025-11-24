
import { Expose } from 'class-transformer';
import { UserDto } from '../../users/dto/user.dto';

export class LoginResponseDto {
  @Expose()
  accessToken!: string;

  @Expose()
  user!: UserDto;
}

