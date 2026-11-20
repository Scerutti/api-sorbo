/**
 * Migracion: stock global -> stock por sector.
 *
 * Que hace, en orden:
 *   1. Crea los indices (en produccion autoIndex esta desactivado).
 *   2. Upsert por nombre de los sectores iniciales, incluido el deposito
 *      general donde entra la compra de insumos.
 *   3. Siembra un StockSector por producto en el deposito general, con la
 *      cantidad que hoy tiene Product.stock.
 *   4. Deja un movimiento de ajuste por cada siembra, para que el libro
 *      explique de donde salio ese saldo inicial.
 *   5. Informa cuantos usuarios admin hay, porque la separacion por roles de
 *      la fase siguiente los necesita.
 *
 * Es idempotente: los sectores se upsertean por nombre y la siembra usa
 * $setOnInsert, asi que correrlo dos veces no duplica ni pisa saldos.
 *
 * NO toca Product.stock. Hasta que la fase 3 pase las lecturas y las ventas
 * al stock por sector, Product.stock sigue siendo la fuente de verdad y este
 * script solo agrega datos en paralelo. Por eso no tiene --cleanup todavia.
 *
 * Uso:
 *   npm run migrate:stock-sectores
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const SECTORES_INICIALES: Array<{
  nombre: string;
  esGeneral: boolean;
  descripcion: string;
}> = [
  {
    nombre: 'Depósito General',
    esGeneral: true,
    descripcion:
      'Depósito central. La compra de insumos entra acá antes de repartirse.',
  },
  {
    nombre: 'Concepción del Uruguay',
    esGeneral: false,
    descripcion: '',
  },
  {
    nombre: 'Villaguay',
    esGeneral: false,
    descripcion: '',
  },
];

async function main(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Falta MONGO_URI en el entorno (.env).');
  }
  const dbName = process.env.MONGO_DB;

  await mongoose.connect(uri, dbName ? { dbName } : {});
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('No se pudo obtener la conexion a la base.');
  }
  console.log(`Conectado a ${db.databaseName}`);

  const sectoresCol = db.collection('sectors');
  const stockCol = db.collection('stocksectors');
  const movimientosCol = db.collection('movimientostocks');
  const productsCol = db.collection('products');
  const usersCol = db.collection('users');

  // ---- 1. Indices --------------------------------------------------------
  await sectoresCol.createIndex({ nombre: 1 }, { unique: true });
  await sectoresCol.createIndex(
    { esGeneral: 1 },
    { unique: true, partialFilterExpression: { esGeneral: true } },
  );
  await stockCol.createIndex({ productId: 1, sectorId: 1 }, { unique: true });
  await stockCol.createIndex({ productId: 1 });
  await stockCol.createIndex({ sectorId: 1 });
  await movimientosCol.createIndex({ productId: 1 });
  await movimientosCol.createIndex({ sectorOrigenId: 1 });
  await movimientosCol.createIndex({ sectorDestinoId: 1 });
  await movimientosCol.createIndex({ saleId: 1 });
  await movimientosCol.createIndex({ fecha: -1 });
  await usersCol.createIndex({ sectorId: 1 });
  console.log('[1/5] Indices asegurados.');

  // ---- 2. Sectores iniciales --------------------------------------------
  const idPorNombre = new Map<string, mongoose.Types.ObjectId>();
  let sectoresCreados = 0;

  for (const sector of SECTORES_INICIALES) {
    const existente = await sectoresCol.findOne({ nombre: sector.nombre });
    if (existente) {
      idPorNombre.set(sector.nombre, existente._id as mongoose.Types.ObjectId);
      continue;
    }

    const now = new Date();
    const res = await sectoresCol.insertOne({
      nombre: sector.nombre,
      ...(sector.descripcion ? { descripcion: sector.descripcion } : {}),
      esGeneral: sector.esGeneral,
      activo: true,
      createdAt: now,
      updatedAt: now,
    });
    idPorNombre.set(sector.nombre, res.insertedId as mongoose.Types.ObjectId);
    sectoresCreados += 1;
  }

  console.log(
    `[2/5] Sectores: ${sectoresCreados} creados, ${
      SECTORES_INICIALES.length - sectoresCreados
    } ya existian.`,
  );

  const idGeneral = idPorNombre.get('Depósito General');
  if (!idGeneral) {
    throw new Error('No se pudo resolver el id del deposito general.');
  }

  // ---- 3 y 4. Siembra de saldos + movimiento de ajuste -------------------
  const productos = await productsCol
    .find({}, { projection: { _id: 1, nombre: 1, stock: 1 } })
    .toArray();

  let sembrados = 0;
  let yaExistian = 0;

  for (const producto of productos) {
    const cantidad = typeof producto.stock === 'number' ? producto.stock : 0;
    const now = new Date();

    const res = await stockCol.updateOne(
      { productId: producto._id, sectorId: idGeneral },
      {
        $setOnInsert: {
          productId: producto._id,
          sectorId: idGeneral,
          cantidad,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    if (res.upsertedCount === 0) {
      yaExistian += 1;
      continue;
    }

    sembrados += 1;

    // Un saldo que aparece sin movimiento que lo explique rompe el libro.
    // Solo se registra si hubo unidades: el libro exige cantidad >= 1.
    if (cantidad > 0) {
      await movimientosCol.insertOne({
        tipo: 'ajuste',
        productId: producto._id,
        sectorDestinoId: idGeneral,
        cantidad,
        motivo: 'Saldo inicial por migración a stock por sector',
        fecha: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  console.log(
    `[3/5] Saldos sembrados en el deposito general: ${sembrados} producto(s).`,
  );
  console.log(
    `[4/5] Ya tenian saldo y no se tocaron: ${yaExistian} producto(s).`,
  );

  // ---- 5. Verificacion y estado de los roles -----------------------------
  const totalProductos = productos.length;
  const totalSaldos = await stockCol.countDocuments({ sectorId: idGeneral });

  if (totalSaldos < totalProductos) {
    throw new Error(
      `Migracion incompleta: ${totalProductos} producto(s) pero solo ` +
        `${totalSaldos} saldo(s) en el deposito general.`,
    );
  }

  const admins = await usersCol.countDocuments({ roles: 'admin' });
  const sinSector = await usersCol.countDocuments({
    sectorId: { $exists: false },
  });

  console.log('[5/5] Verificacion OK: todos los productos tienen saldo.');
  console.log(`\nUsuarios con rol admin: ${admins}`);
  if (admins === 0) {
    console.warn(
      'ATENCION: no hay ningun usuario admin. La separacion por roles de la\n' +
        'fase siguiente dejaria el stock inaccesible. Asignale el rol admin a\n' +
        'alguien antes de avanzar:\n' +
        '  db.users.updateOne({ email: "TU_EMAIL" }, { $addToSet: { roles: "admin" } })',
    );
  }
  console.log(`Usuarios sin sector asignado: ${sinSector}`);
  if (sinSector > 0) {
    console.log(
      'Asignales un sector desde la API (PATCH /users/:id con sectorId) o\n' +
        'esperá a la pantalla de usuarios de la fase 6.',
    );
  }

  console.log('\nMigracion completada.');
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('\nLa migracion fallo:', error);
    await mongoose.disconnect();
    process.exit(1);
  });
