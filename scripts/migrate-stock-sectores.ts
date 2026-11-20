/**
 * Puesta en marcha del stock por sector, en una sola ejecucion.
 *
 * Pasos, en orden:
 *   1. Indices de las colecciones nuevas. En produccion autoIndex esta
 *      desactivado (app.module.ts), asi que no se crean solos.
 *   2. Limpieza del "Depósito General" que dejaba una version vieja de esta
 *      migracion: sus saldos, sus movimientos de siembra, el sector, el
 *      indice y el campo esGeneral. Si no existe, no hace nada.
 *   3. Sector destino del stock historico. Por defecto "Concepción del
 *      Uruguay", que es donde esta fisicamente la mercaderia. Si no existe,
 *      lo crea.
 *   4. Carga del stock historico: por cada producto con Product.stock > 0 que
 *      todavia no tiene ningun saldo por sector, crea el saldo en el sector
 *      destino y deja una entrada en el libro de movimientos.
 *   5. Informe: reparto por sector, productos sin repartir, usuarios sin
 *      sector o con un sector que ya no existe, admins y ventas viejas.
 *
 * Es idempotente: un producto que ya tiene algun saldo no se toca, asi que se
 * puede correr las veces que haga falta. Product.stock no se modifica.
 *
 * Corre en seco por defecto: informa lo que haria sin escribir nada.
 *
 * Uso:
 *   npm run migrate:stock-sectores                      # seco
 *   npm run migrate:stock-sectores -- --apply           # escribe
 *   npm run migrate:stock-sectores -- --apply --sector "Villaguay"
 *
 * Ojo: usa MONGO_URI y MONGO_DB del .env. Revisá a qué base apunta antes de
 * correrlo con --apply.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

type Db = NonNullable<typeof mongoose.connection.db>;
type Coleccion = ReturnType<Db['collection']>;

const SECTOR_POR_DEFECTO = 'Concepción del Uruguay';
const MOTIVO_CARGA = 'Stock inicial (migración desde Product.stock)';
// Lo que dejaba la version vieja con deposito general.
const MOTIVO_SIEMBRA_VIEJA = 'Saldo inicial por migración a stock por sector';
const NOMBRE_DEPOSITO_VIEJO = 'Depósito General';

function leerSector(): string {
  const indice = process.argv.indexOf('--sector');
  const valor = indice >= 0 ? process.argv[indice + 1] : undefined;
  return valor && !valor.startsWith('--') ? valor : SECTOR_POR_DEFECTO;
}

async function crearIndices(db: Db): Promise<void> {
  await db.collection('sectors').createIndex({ nombre: 1 }, { unique: true });
  const stock = db.collection('stocksectors');
  await stock.createIndex({ productId: 1, sectorId: 1 }, { unique: true });
  await stock.createIndex({ productId: 1 });
  await stock.createIndex({ sectorId: 1 });
  const movs = db.collection('movimientostocks');
  await movs.createIndex({ productId: 1 });
  await movs.createIndex({ sectorOrigenId: 1 });
  await movs.createIndex({ sectorDestinoId: 1 });
  await movs.createIndex({ saleId: 1 });
  await movs.createIndex({ fecha: -1 });
  await db.collection('users').createIndex({ sectorId: 1 });
  await db.collection('sales').createIndex({ sectorId: 1 });
}

async function limpiarDepositoViejo(
  sectores: Coleccion,
  stock: Coleccion,
  movimientos: Coleccion,
  apply: boolean,
): Promise<void> {
  const general =
    (await sectores.findOne({ esGeneral: true })) ??
    (await sectores.findOne({ nombre: NOMBRE_DEPOSITO_VIEJO }));

  if (!general) {
    console.log('  No hay depósito general. Nada que limpiar.');
  } else {
    const otros = await movimientos.countDocuments({
      $or: [{ sectorOrigenId: general._id }, { sectorDestinoId: general._id }],
      motivo: { $ne: MOTIVO_SIEMBRA_VIEJA },
    });
    if (otros > 0) {
      // Alguien opero sobre el deposito: borrarlo perderia unidades reales.
      throw new Error(
        `El depósito general tiene ${otros} movimiento(s) que no son de la siembra vieja. ` +
          'Transferí ese stock a un sector antes de migrar.',
      );
    }

    const saldos = await stock.countDocuments({ sectorId: general._id });
    console.log(
      `  Depósito general encontrado: se ${apply ? 'borran' : 'borrarían'} ${saldos} saldo(s), su siembra y el sector.`,
    );
    if (apply) {
      await stock.deleteMany({ sectorId: general._id });
      await movimientos.deleteMany({
        sectorDestinoId: general._id,
        motivo: MOTIVO_SIEMBRA_VIEJA,
      });
      await sectores.deleteOne({ _id: general._id });
    }
  }

  const indice = (await sectores.indexes()).find((i) =>
    Object.keys(i.key).includes('esGeneral'),
  );
  if (indice?.name) {
    console.log(
      `  Índice obsoleto ${indice.name}: se ${apply ? 'elimina' : 'eliminaría'}.`,
    );
    if (apply) {
      await sectores.dropIndex(indice.name);
    }
  }

  const conCampo = await sectores.countDocuments({
    esGeneral: { $exists: true },
  });
  if (conCampo > 0) {
    console.log(
      `  Campo esGeneral en ${conCampo} sector(es): se ${apply ? 'quita' : 'quitaría'}.`,
    );
    if (apply) {
      await sectores.updateMany(
        { esGeneral: { $exists: true } },
        { $unset: { esGeneral: '' } },
      );
    }
  }
}

async function main(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Falta MONGO_URI en el entorno (.env).');
  }
  const dbName = process.env.MONGO_DB;
  const apply = process.argv.includes('--apply');
  const nombreSector = leerSector();

  await mongoose.connect(uri, dbName ? { dbName } : {});
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('No se pudo obtener la conexion a la base.');
  }

  console.log(`Conectado a la base "${db.databaseName}"`);
  console.log(
    apply
      ? 'MODO ESCRITURA: los cambios se guardan.\n'
      : 'MODO SECO: no se escribe nada. Agregá --apply para ejecutar.\n',
  );

  const sectoresCol = db.collection('sectors');
  const stockCol = db.collection('stocksectors');
  const movimientosCol = db.collection('movimientostocks');
  const productsCol = db.collection('products');
  const usersCol = db.collection('users');
  const salesCol = db.collection('sales');

  // ---- 1. Indices --------------------------------------------------------
  console.log('[1/5] Índices');
  if (apply) {
    await crearIndices(db);
    console.log('  Asegurados.');
  } else {
    console.log('  Se crearían los que falten.');
  }

  // ---- 2. Deposito general viejo ----------------------------------------
  console.log('\n[2/5] Depósito general de la migración vieja');
  await limpiarDepositoViejo(sectoresCol, stockCol, movimientosCol, apply);

  // ---- 3. Sector destino -------------------------------------------------
  console.log(`\n[3/5] Sector destino: "${nombreSector}"`);
  let sector = await sectoresCol.findOne({ nombre: nombreSector });
  if (!sector) {
    console.log(`  No existe: se ${apply ? 'crea' : 'crearía'}.`);
    if (apply) {
      const ahora = new Date();
      const { insertedId } = await sectoresCol.insertOne({
        nombre: nombreSector,
        activo: true,
        createdAt: ahora,
        updatedAt: ahora,
      });
      sector = await sectoresCol.findOne({ _id: insertedId });
    }
  } else if (sector.activo === false) {
    throw new Error(
      `El sector "${nombreSector}" está inactivo. Activalo antes de cargarle stock.`,
    );
  } else {
    console.log('  Existe y está activo.');
  }
  const sectorId = sector?._id;

  // ---- 4. Carga del stock historico -------------------------------------
  console.log('\n[4/5] Stock histórico (Product.stock)');
  const productos = await productsCol
    .find({ stock: { $gt: 0 } }, { projection: { nombre: 1, stock: 1 } })
    .toArray();

  let cargados = 0;
  let unidades = 0;
  let yaRepartidos = 0;

  for (const producto of productos) {
    const cantidad = Number(producto.stock);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      continue;
    }

    // Con cualquier saldo ya cargado, el reparto lo decidio alguien: no se pisa.
    if ((await stockCol.countDocuments({ productId: producto._id })) > 0) {
      yaRepartidos += 1;
      continue;
    }

    cargados += 1;
    unidades += cantidad;

    if (apply && sectorId) {
      const ahora = new Date();
      await stockCol.insertOne({
        productId: producto._id,
        sectorId,
        cantidad,
        createdAt: ahora,
        updatedAt: ahora,
      });
      await movimientosCol.insertOne({
        tipo: 'entrada',
        productId: producto._id,
        sectorDestinoId: sectorId,
        cantidad,
        motivo: MOTIVO_CARGA,
        fecha: ahora,
        createdAt: ahora,
        updatedAt: ahora,
      });
    }
  }

  console.log(
    `  Productos ${apply ? 'cargados' : 'a cargar'} en "${nombreSector}": ${cargados} (${unidades} unidades)`,
  );
  console.log(
    `  Productos que ya tenían saldo y no se tocaron: ${yaRepartidos}`,
  );

  // ---- 5. Informe ----------------------------------------------------------
  console.log('\n[5/5] Estado');

  const sectores = await sectoresCol.find().sort({ nombre: 1 }).toArray();
  const idsSectores = new Set(sectores.map((s) => String(s._id)));
  for (const s of sectores) {
    const [fila] = await stockCol
      .aggregate<{ productos: number; unidades: number }>([
        { $match: { sectorId: s._id, cantidad: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            productos: { $sum: 1 },
            unidades: { $sum: '$cantidad' },
          },
        },
      ])
      .toArray();
    const estado = s.activo === false ? ' (inactivo)' : '';
    console.log(
      `  ${String(s.nombre)}${estado}: ${fila?.productos ?? 0} producto(s), ${fila?.unidades ?? 0} unidades`,
    );
  }

  let sinRepartir = 0;
  for (const producto of productos) {
    const conSaldo = await stockCol.countDocuments({
      productId: producto._id,
      cantidad: { $gt: 0 },
    });
    if (conSaldo === 0) {
      sinRepartir += 1;
    }
  }
  console.log(
    `\n  Productos con Product.stock pero sin saldo por sector: ${sinRepartir}` +
      (apply ? '' : ' (antes de aplicar)'),
  );

  const usuarios = await usersCol
    .find({}, { projection: { email: 1, roles: 1, sectorId: 1 } })
    .toArray();
  const admins = usuarios.filter(
    (u) => Array.isArray(u.roles) && u.roles.includes('admin'),
  );
  const sinSector = usuarios.filter((u) => !u.sectorId);
  const sectorRoto = usuarios.filter(
    (u) => u.sectorId && !idsSectores.has(String(u.sectorId)),
  );

  console.log(`\n  Usuarios: ${usuarios.length}, admins: ${admins.length}`);
  if (admins.length === 0) {
    console.warn(
      '  ATENCION: no hay ningún admin. Nadie va a poder administrar usuarios,\n' +
        '  sectores ni stock. Asigná el rol en Mongo antes de deployar.',
    );
  }
  if (sinSector.length > 0) {
    console.log(
      `  Sin sector (no pueden vender): ${sinSector.map((u) => String(u.email)).join(', ')}`,
    );
  }
  if (sectorRoto.length > 0) {
    console.warn(
      `  Con un sector que ya no existe: ${sectorRoto.map((u) => String(u.email)).join(', ')}`,
    );
  }

  const ventasViejas = await salesCol.countDocuments({
    sectorId: { $exists: false },
  });
  console.log(
    `\n  Ventas anteriores al cambio (sin sector): ${ventasViejas}. ` +
      'Editarlas o anularlas no mueve stock.',
  );

  console.log(
    apply ? '\nListo.' : '\nNo se escribió nada. Volvé a correr con --apply.',
  );
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('\nFalló la migración:', error);
    await mongoose.disconnect();
    process.exit(1);
  });
