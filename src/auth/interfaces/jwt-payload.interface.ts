
import { UserRole } from '../../shared/enums/user-role.enum';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  roles: UserRole[];
  iat?: number;
  exp?: number;
}

