/**
 * Limpieza del deposito general.
 *
 * Una version anterior de migrate-stock-sectores creaba un sector "Depósito
 * General" (esGeneral: true) y sembraba ahi todo el Product.stock. Ese
 * concepto se saco del modelo: la compra de insumos entra directo al sector
 * que se elija, sin antesala.
 *
 * Este script deshace eso:
 *   1. Borra los saldos (StockSector) del deposito general.
 *   2. Borra los movimientos de siembra que genero aquella migracion.
 *   3. Borra el sector deposito general.
 *   4. Elimina el indice parcial unico de esGeneral, que ya no existe.
 *   5. Quita el campo esGeneral de todos los sectores que lo tengan.
 *
 * NO toca los demas sectores ni Product.stock. Las unidades no se pierden:
 * Product.stock quedo intacto y sigue siendo la fuente de verdad hasta que
 * cargues el stock por sector.
 *
 * Corre en seco por defecto y solo informa. Para ejecutar de verdad:
 *   npm run cleanup:deposito-general -- --apply
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const MOTIVO_SIEMBRA = 'Saldo inicial por migración a stock por sector';
const NOMBRE_HISTORICO = 'Depósito General';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
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
  console.log(
    apply
      ? '\nMODO APPLY: los cambios se escriben.\n'
      : '\nMODO SECO: no se escribe nada. Agregá --apply para ejecutar.\n',
  );

  const sectoresCol = db.collection('sectors');
  const stockCol = db.collection('stocksectors');
  const movimientosCol = db.collection('movimientostocks');

  // ---- Buscar el deposito general ---------------------------------------
  const general =
    (await sectoresCol.findOne({ esGeneral: true })) ??
    (await sectoresCol.findOne({ nombre: NOMBRE_HISTORICO }));

  if (!general) {
    console.log('No hay ningun deposito general. Nada que borrar.');
  } else {
    console.log(
      `Deposito general encontrado: "${String(general.nombre)}" (${String(general._id)})`,
    );

    const saldos = await stockCol.countDocuments({ sectorId: general._id });
    const conUnidades = await stockCol.countDocuments({
      sectorId: general._id,
      cantidad: { $gt: 0 },
    });
    const movimientos = await movimientosCol.countDocuments({
      sectorDestinoId: general._id,
      motivo: MOTIVO_SIEMBRA,
    });
    const otrosMovimientos = await movimientosCol.countDocuments({
      $or: [
        { sectorOrigenId: general._id },
        { sectorDestinoId: general._id },
      ],
      motivo: { $ne: MOTIVO_SIEMBRA },
    });

    console.log(`  Saldos a borrar: ${saldos} (${conUnidades} con unidades)`);
    console.log(`  Movimientos de siembra a borrar: ${movimientos}`);

    if (otrosMovimientos > 0) {
      console.warn(
        `\n  ATENCION: hay ${otrosMovimientos} movimiento(s) del deposito general\n` +
          '  que NO son de la siembra. Alguien ya opero sobre el. El script los\n' +
          '  deja intactos, pero van a quedar apuntando a un sector borrado.\n' +
          '  Revisalos antes de correr con --apply.',
      );
    }

    if (apply) {
      const s = await stockCol.deleteMany({ sectorId: general._id });
      const m = await movimientosCol.deleteMany({
        sectorDestinoId: general._id,
        motivo: MOTIVO_SIEMBRA,
      });
      await sectoresCol.deleteOne({ _id: general._id });
      console.log(
        `\n  Borrados: ${s.deletedCount} saldo(s), ${m.deletedCount} movimiento(s) y el sector.`,
      );
    }
  }

  // ---- Indice obsoleto ---------------------------------------------------
  const indices = await sectoresCol.indexes();
  const indiceEsGeneral = indices.find((indice) =>
    Object.keys(indice.key).includes('esGeneral'),
  );

  if (indiceEsGeneral?.name) {
    console.log(`\nIndice obsoleto a eliminar: ${indiceEsGeneral.name}`);
    if (apply) {
      await sectoresCol.dropIndex(indiceEsGeneral.name);
      console.log('  Eliminado.');
    }
  } else {
    console.log('\nNo hay indice de esGeneral.');
  }

  // ---- Campo obsoleto ----------------------------------------------------
  const conCampo = await sectoresCol.countDocuments({
    esGeneral: { $exists: true },
  });
  console.log(`\nSectores con el campo esGeneral: ${conCampo}`);

  if (apply && conCampo > 0) {
    const r = await sectoresCol.updateMany(
      { esGeneral: { $exists: true } },
      { $unset: { esGeneral: '' } },
    );
    console.log(`  Campo quitado de ${r.modifiedCount} sector(es).`);
  }

  // ---- Resumen final -----------------------------------------------------
  const restantes = await sectoresCol
    .find({}, { projection: { nombre: 1 } })
    .toArray();

  console.log(`\nSectores que quedan: ${restantes.length}`);
  for (const sector of restantes) {
    console.log(`  - ${String(sector.nombre)}`);
  }

  if (!apply) {
    console.log('\nNo se escribio nada. Volvé a correr con --apply.');
  } else {
    console.log(
      '\nListo. Product.stock quedo intacto: cargá el stock en cada sector\n' +
        'con un movimiento de entrada cuando tengas la pantalla.',
    );
  }
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('\nLa limpieza fallo:', error);
    await mongoose.disconnect();
    process.exit(1);
  });
