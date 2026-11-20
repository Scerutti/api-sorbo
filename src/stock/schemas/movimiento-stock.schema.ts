
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';
import { Sale } from '../../sales/schemas/sale.schema';
import { Sector } from '../../sectores/schemas/sector.schema';
import { User } from '../../users/schemas/user.schema';
import {
  TipoMovimiento,
  TIPO_MOVIMIENTO_VALUES,
} from '../../shared/enums/tipo-movimiento.enum';

/**
 * Libro de movimientos de stock. Cada fila explica por qué cambió un saldo.
 *
 * Invariante de los sectores, igual para los cuatro tipos:
 *   - `sectorDestinoId` presente => entraron `cantidad` unidades a ese sector.
 *   - `sectorOrigenId`  presente => salieron `cantidad` unidades de ese sector.
 *   - los dos presentes           => transferencia.
 * `tipo` explica el motivo; los sectores explican la dirección. Un ajuste hacia
 * arriba se guarda con destino y uno hacia abajo con origen, de modo que los
 * reportes puedan sumar por sector sin mirar el tipo.
 *
 * `cantidad` es siempre la magnitud movida, positiva. En un ajuste es el delta
 * aplicado, no el saldo final que pidió el usuario.
 */
@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
})
export class MovimientoStock {
  @Prop({ required: true, type: String, enum: TIPO_MOVIMIENTO_VALUES })
  tipo!: TipoMovimiento;

  @Prop({
    type: Types.ObjectId,
    ref: Product.name,
    required: true,
    index: true,
  })
  productId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Sector.name, required: false, index: true })
  sectorOrigenId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Sector.name, required: false, index: true })
  sectorDestinoId?: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  cantidad!: number;

  @Prop({ trim: true })
  motivo?: string;

  // Presente cuando el movimiento lo genera una venta, para poder reconstruir
  // o revertir el descuento desde la venta.
  @Prop({ type: Types.ObjectId, ref: Sale.name, required: false, index: true })
  saleId?: Types.ObjectId;

  // Ausente en los movimientos que genera la migración u otro proceso del
  // sistema, que no tienen un usuario detrás.
  @Prop({ type: Types.ObjectId, ref: User.name, required: false })
  usuarioId?: Types.ObjectId;

  @Prop({ required: true, default: Date.now, index: true })
  fecha!: Date;
}

export type MovimientoStockDocument = HydratedDocument<MovimientoStock>;

export const MovimientoStockSchema =
  SchemaFactory.createForClass(MovimientoStock);

MovimientoStockSchema.virtual('id').get(function virtualId(
  this: MovimientoStockDocument,
) {
  return this._id.toString();
});
