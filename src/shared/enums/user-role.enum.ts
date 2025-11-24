
export enum UserRole {
  ADMIN = 'admin',
  SELLER = 'seller',
}

export const USER_ROLE_VALUES: readonly UserRole[] = Object.freeze([
  UserRole.ADMIN,
  UserRole.SELLER,
]);
