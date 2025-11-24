
export type MongoId = string;

export interface BaseResponseDto {
  id: MongoId;
  createdAt?: Date;
  updatedAt?: Date;
}
