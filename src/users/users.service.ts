
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { User, UserDocument } from './schemas/user.schema';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(registerDto: RegisterDto): Promise<UserDto> {
    try {
      const passwordHash = await bcrypt.hash(
        registerDto.password,
        PASSWORD_SALT_ROUNDS,
      );
      const createdUser = await this.userModel.create({
        email: registerDto.email,
        passwordHash,
        name: registerDto.displayName,
        roles: registerDto.roles ?? [],
      });

      return this.mapToDto(createdUser);
    } catch (error) {
      throw new HttpException(
        this.extractMessage(error, 'No se pudo crear el usuario'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<UserDto[]> {
    const users = await this.userModel.find().exec();
    return users.map((user) => this.mapToDto(user));
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.mapToDto(user);
  }

  async findOneDocument(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDto> {
    try {
      const updatePayload: Partial<User> = {};

      if (typeof updateUserDto.email === 'string') {
        updatePayload.email = updateUserDto.email;
      }

      // Mapear displayName del DTO a name del schema
      if (typeof updateUserDto.displayName === 'string') {
        updatePayload.name = updateUserDto.displayName;
      }

      if (Array.isArray(updateUserDto.roles)) {
        updatePayload.roles = updateUserDto.roles;
      }

      if (
        typeof updateUserDto.password === 'string' &&
        updateUserDto.password.length > 0
      ) {
        updatePayload.passwordHash = await bcrypt.hash(
          updateUserDto.password,
          PASSWORD_SALT_ROUNDS,
        );
      }

      const updatedUser = await this.userModel
        .findByIdAndUpdate(id, updatePayload, {
          new: true,
          runValidators: true,
        })
        .exec();

      if (!updatedUser) {
        throw new NotFoundException('Usuario no encontrado');
      }

      return this.mapToDto(updatedUser);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        this.extractMessage(error, 'No se pudo actualizar el usuario'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
    if (!deletedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  private mapToDto(user: UserDocument): UserDto {
    const plainUser = user.toObject();

    return plainToInstance(UserDto, plainUser, {
      excludeExtraneousValues: true,
    });
  }

  private extractMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
