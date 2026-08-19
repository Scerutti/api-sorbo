/**
 * Migracion: tipos de costo hardcodeados -> coleccion TipoCosto.
 *
 * Que hace, en orden:
 *   1. Upsert por nombre de los 5 tipos historicos.
 *   2. CostItem.tipo (string) -> CostItem.tipoId (ObjectId).
 *   3. Product.tipo   (string) -> Product.tipoId   (ObjectId).
 *   4. Verifica que no quede ningun documento sin tipoId; si queda, aborta.
 *
 * Tambien crea los indices (unico en TipoCosto.nombre, y tipoId en costos y
 * productos), porque en produccion autoIndex esta desactivado.
 *
 * Es idempotente: los upserts van por nombre y los updates filtran por
 * `tipoId: { $exists: false }`. Correrlo dos veces no cambia nada.
 *
 * El campo `tipo` original NO se borra, para permitir rollback. Una vez
 * validado en produccion, correr con --cleanup para hacer el $unset.
 *
 * Uso:
 *   npm run migrate:tipos-costo
 *   npm run migrate:tipos-costo -- --cleanup
 */
import 'dotenv/config';
import mongoose from 'mongoose';

// slug historico (valor del enum viejo) -> definicion del tipo
const TIPOS_HISTORICOS: Array<{
  slug: string;
  nombre: string;
  aplicaATodos: boolean;
  descripcion: string;
}> = [
  {
    slug: 'general',
    nombre: 'General',
    aplicaATodos: true,
    descripcion: 'Costos operativos que se aplican a todos los productos.',
  },
  {
    slug: 'amortizable',
    nombre: 'Amortizable',
    aplicaATodos: true,
    descripcion: 'Costos amortizables que se aplican a todos los productos.',
  },
  { slug: 'blend', nombre: 'Blend', aplicaATodos: false, descripcion: '' },
  { slug: 'caja', nombre: 'Caja', aplicaATodos: false, descripcion: '' },
  { slug: 'gin', nombre: 'Gin', aplicaATodos: false, descripcion: '' },
];

async function main(): Promise<void> {
  const cleanup = process.argv.includes('--cleanup');
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

  const tiposCol = db.collection('tipocostos');
  const costsCol = db.collection('costitems');
  const productsCol = db.collection('products');

  // ---- 0. Indices --------------------------------------------------------
  // En produccion autoIndex esta desactivado (app.module.ts), asi que los
  // indices no se crean solos: hay que crearlos aca.
  await tiposCol.createIndex({ nombre: 1 }, { unique: true });
  await costsCol.createIndex({ tipoId: 1 });
  await productsCol.createIndex({ tipoId: 1 });
  console.log('[0/5] Indices asegurados (tipocostos.nombre unico, tipoId).');

  // ---- 1. Upsert de los tipos historicos -------------------------------
  const idPorSlug = new Map<string, mongoose.Types.ObjectId>();
  let tiposCreados = 0;

  for (const tipo of TIPOS_HISTORICOS) {
    const existente = await tiposCol.findOne({ nombre: tipo.nombre });
    if (existente) {
      idPorSlug.set(tipo.slug, existente._id as mongoose.Types.ObjectId);
      continue;
    }
    const now = new Date();
    const res = await tiposCol.insertOne({
      nombre: tipo.nombre,
      ...(tipo.descripcion ? { descripcion: tipo.descripcion } : {}),
      aplicaATodos: tipo.aplicaATodos,
      createdAt: now,
      updatedAt: now,
    });
    idPorSlug.set(tipo.slug, res.insertedId as mongoose.Types.ObjectId);
    tiposCreados += 1;
  }
  console.log(
    `[1/5] Tipos: ${tiposCreados} creados, ${TIPOS_HISTORICOS.length - tiposCreados} ya existian.`,
  );

  // ---- 2 y 3. Backfill de tipoId ---------------------------------------
  const backfill = async (
    col: ReturnType<typeof db.collection>,
    label: string,
  ): Promise<number> => {
    let total = 0;
    for (const [slug, tipoId] of idPorSlug) {
      const res = await col.updateMany(
        { tipo: slug, tipoId: { $exists: false } },
        { $set: { tipoId } },
      );
      total += res.modifiedCount;
    }
    console.log(`[${label}] ${total} documento(s) migrado(s).`);
    return total;
  };

  await backfill(costsCol, '2/5 costitems');
  await backfill(productsCol, '3/5 products');

  // ---- 4. Verificacion --------------------------------------------------
  const huerfanos = async (
    col: ReturnType<typeof db.collection>,
    nombre: string,
  ): Promise<number> => {
    const docs = await col
      .find({ tipoId: { $exists: false } }, { projection: { _id: 1, tipo: 1 } })
      .toArray();
    if (docs.length > 0) {
      console.error(
        `\nERROR: ${docs.length} documento(s) de "${nombre}" quedaron sin tipoId:`,
      );
      for (const doc of docs) {
        console.error(`  _id=${String(doc._id)} tipo=${String(doc.tipo)}`);
      }
    }
    return docs.length;
  };

  const pendientes =
    (await huerfanos(costsCol, 'costitems')) +
    (await huerfanos(productsCol, 'products'));

  if (pendientes > 0) {
    throw new Error(
      `Migracion incompleta: ${pendientes} documento(s) sin tipoId. ` +
        'Revisá los valores de "tipo" listados arriba y volvé a correr el script.',
    );
  }
  console.log('[4/5] Verificacion OK: todos los documentos tienen tipoId.');

  // ---- Opcional: limpieza del campo viejo ------------------------------
  if (cleanup) {
    const a = await costsCol.updateMany(
      { tipo: { $exists: true } },
      { $unset: { tipo: '' } },
    );
    const b = await productsCol.updateMany(
      { tipo: { $exists: true } },
      { $unset: { tipo: '' } },
    );
    console.log(
      `[5/5 cleanup] Campo "tipo" eliminado de ${a.modifiedCount} costos y ${b.modifiedCount} productos.`,
    );
  } else {
    console.log(
      '\nEl campo "tipo" original se conservo para permitir rollback.\n' +
        'Una vez validado, corré: npm run migrate:tipos-costo -- --cleanup',
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
