import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/dto/register.dto';
import { Sector, SectorDocument } from '../sectores/schemas/sector.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { User, UserDocument } from './schemas/user.schema';

const PASSWORD_SALT_ROUNDS = 12;

/**
 * Cuánto vive en memoria el usuario que JwtStrategy adjunta a cada request.
 * Sin esto, cada request autenticado hacía una consulta extra a Atlas antes
 * de llegar al controller. Los cambios que pasan por update() y remove() se
 * ven al instante porque invalidan la entrada; el TTL sólo cubre cambios
 * hechos por fuera de este servicio (otra instancia, la base a mano).
 */
const AUTH_CACHE_TTL_MS = 30_000;

@Injectable()
export class UsersService {
  // Se guarda la promesa, no el documento: los requests que llegan juntos
  // (una pantalla dispara varios) comparten una sola consulta.
  private readonly authCache = new Map<
    string,
    { expiresAt: number; user: Promise<UserDocument | null> }
  >();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Sector.name)
    private readonly sectorModel: Model<SectorDocument>,
  ) {}

  async create(registerDto: RegisterDto): Promise<UserDto> {
    try {
      await this.assertSectorExiste(registerDto.sectorId);

      const passwordHash = await bcrypt.hash(
        registerDto.password,
        PASSWORD_SALT_ROUNDS,
      );
      const createdUser = await this.userModel.create({
        email: registerDto.email,
        passwordHash,
        name: registerDto.displayName,
        roles: registerDto.roles ?? [],
        ...(registerDto.sectorId
          ? { sectorId: new Types.ObjectId(registerDto.sectorId) }
          : {}),
      });

      return this.mapToDto(createdUser);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

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

  /**
   * Usuario para request.user, con caché corto. Trae el documento sin
   * passwordHash ni refreshTokens: nadie los lee desde request.user, y quien
   * necesita guardarlos (login, refresh, logout) busca el documento fresco
   * con findOneDocument.
   */
  findForAuth(id: string): Promise<UserDocument | null> {
    const now = Date.now();
    const cached = this.authCache.get(id);
    if (cached && cached.expiresAt > now) {
      return cached.user;
    }

    const user = this.userModel
      .findById(id)
      .select('-passwordHash -refreshTokens')
      .exec();
    this.authCache.set(id, { expiresAt: now + AUTH_CACHE_TTL_MS, user });

    // Un error o un usuario inexistente no se cachean.
    user.then(
      (found) => {
        if (!found) this.invalidateAuthCache(id);
      },
      () => this.invalidateAuthCache(id),
    );

    return user;
  }

  invalidateAuthCache(id: string): void {
    this.authCache.delete(id);
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

      if (typeof updateUserDto.sectorId === 'string') {
        await this.assertSectorExiste(updateUserDto.sectorId);
        updatePayload.sectorId = new Types.ObjectId(updateUserDto.sectorId);
      }

      // sectorId: null deja al usuario sin sector.
      const quitarSector = updateUserDto.sectorId === null;

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
        .findByIdAndUpdate(
          id,
          quitarSector
            ? { ...updatePayload, $unset: { sectorId: 1 } }
            : updatePayload,
          {
            new: true,
            runValidators: true,
          },
        )
        .exec();

      if (!updatedUser) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Roles y sector tienen que valer desde el próximo request.
      this.invalidateAuthCache(id);

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
    this.invalidateAuthCache(id);
    if (!deletedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  /**
   * Un sectorId que no existe dejaria al usuario sin stock accesible y el
   * error recien aparecería al vender, asi que se valida al asignarlo.
   */
  private async assertSectorExiste(sectorId?: string): Promise<void> {
    if (!sectorId) {
      return;
    }

    const existe = await this.sectorModel.exists({
      _id: new Types.ObjectId(sectorId),
    });

    if (!existe) {
      throw new BadRequestException('El sector indicado no existe.');
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
