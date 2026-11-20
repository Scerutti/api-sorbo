/**
 * Preparacion de la base para el stock por sector.
 *
 * Que hace:
 *   1. Crea los indices de las colecciones nuevas. En produccion autoIndex
 *      esta desactivado (app.module.ts), asi que no se crean solos.
 *   2. Informa el estado: sectores cargados, productos con stock todavia sin
 *      repartir, usuarios admin y usuarios sin sector asignado.
 *
 * Lo que NO hace, a proposito:
 *   - No crea sectores. Los sectores los das de alta vos por el CRUD
 *     (POST /api/v1/sectores) o desde la pantalla de sectores.
 *   - No siembra saldos. El stock entra a cada sector con un movimiento de
 *     entrada, eligiendo el sector destino.
 *   - No toca Product.stock, que sigue siendo la fuente de verdad de las
 *     lecturas hasta que se repartan los saldos.
 *
 * Es idempotente: se puede correr las veces que haga falta, y sirve como
 * chequeo previo antes de pasar las lecturas al stock por sector.
 *
 * Uso:
 *   npm run migrate:stock-sectores
 */
import 'dotenv/config';
import mongoose from 'mongoose';

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
  await stockCol.createIndex({ productId: 1, sectorId: 1 }, { unique: true });
  await stockCol.createIndex({ productId: 1 });
  await stockCol.createIndex({ sectorId: 1 });
  await movimientosCol.createIndex({ productId: 1 });
  await movimientosCol.createIndex({ sectorOrigenId: 1 });
  await movimientosCol.createIndex({ sectorDestinoId: 1 });
  await movimientosCol.createIndex({ saleId: 1 });
  await movimientosCol.createIndex({ fecha: -1 });
  await usersCol.createIndex({ sectorId: 1 });
  console.log('[1/2] Indices asegurados.');

  // ---- 2. Estado actual --------------------------------------------------
  const sectores = await sectoresCol
    .find({}, { projection: { nombre: 1, activo: 1 } })
    .toArray();

  console.log(`\n[2/2] Estado de la base\n`);
  console.log(`Sectores cargados: ${sectores.length}`);
  for (const sector of sectores) {
    const saldos = await stockCol.countDocuments({
      sectorId: sector._id,
      cantidad: { $gt: 0 },
    });
    const estado = sector.activo === false ? ' (inactivo)' : '';
    console.log(
      `  - ${String(sector.nombre)}${estado}: ${saldos} producto(s) con saldo`,
    );
  }
  if (sectores.length === 0) {
    console.log(
      '  (ninguno) Crealos con POST /api/v1/sectores antes de cargar stock.',
    );
  }

  // Productos cuyo stock historico todavia no se repartio en ningun sector.
  const productos = await productsCol
    .find({}, { projection: { nombre: 1, stock: 1 } })
    .toArray();

  let sinRepartir = 0;
  for (const producto of productos) {
    const stockHistorico =
      typeof producto.stock === 'number' ? producto.stock : 0;
    if (stockHistorico <= 0) {
      continue;
    }
    const tieneSaldo = await stockCol.countDocuments({
      productId: producto._id,
      cantidad: { $gt: 0 },
    });
    if (tieneSaldo === 0) {
      sinRepartir += 1;
    }
  }

  console.log(`\nProductos con stock sin repartir: ${sinRepartir}`);
  if (sinRepartir > 0) {
    console.log(
      'Esos productos tienen unidades en Product.stock pero ningun saldo por\n' +
        'sector. Cargalos con un movimiento de entrada por sector antes de\n' +
        'pasar las lecturas al stock por sector, o el catálogo los va a\n' +
        'mostrar en cero.',
    );
  }

  const admins = await usersCol.countDocuments({ roles: 'admin' });
  const sinSector = await usersCol.countDocuments({
    sectorId: { $exists: false },
  });

  console.log(`\nUsuarios con rol admin: ${admins}`);
  if (admins === 0) {
    console.warn(
      'ATENCION: no hay ningun usuario admin. La separacion por roles dejaria\n' +
        'el stock inaccesible. Asignale el rol a alguien antes de avanzar:\n' +
        '  db.users.updateOne({ email: "TU_EMAIL" }, { $addToSet: { roles: "admin" } })',
    );
  }

  console.log(`Usuarios sin sector asignado: ${sinSector}`);
  if (sinSector > 0) {
    console.log(
      'Asignales un sector con PATCH /api/v1/users/:id { "sectorId": "..." }\n' +
        'o desde la pantalla de usuarios.',
    );
  }

  console.log('\nListo.');
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('\nFallo la preparacion:', error);
    await mongoose.disconnect();
    process.exit(1);
  });
