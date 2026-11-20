import { TipoMovimiento } from '../shared/enums/tipo-movimiento.enum';
import { planificarReparto } from './reparto';

describe('planificarReparto', () => {
  it('no genera nada si ningún saldo cambia', () => {
    expect(
      planificarReparto([
        { sectorId: 'a', actual: 5, nuevo: 5 },
        { sectorId: 'b', actual: 0, nuevo: 0 },
      ]),
    ).toEqual([]);
  });

  it('una suba sin bajas es una entrada', () => {
    expect(planificarReparto([{ sectorId: 'a', actual: 2, nuevo: 7 }])).toEqual(
      [
        {
          tipo: TipoMovimiento.ENTRADA,
          sectorDestinoId: 'a',
          cantidad: 5,
          motivo: 'Carga desde el producto',
        },
      ],
    );
  });

  it('una baja sin subas es un ajuste con origen', () => {
    expect(planificarReparto([{ sectorId: 'a', actual: 9, nuevo: 4 }])).toEqual(
      [
        {
          tipo: TipoMovimiento.AJUSTE,
          sectorOrigenId: 'a',
          cantidad: 5,
          motivo: 'Ajuste desde el producto',
        },
      ],
    );
  });

  it('empareja bajas con subas como transferencia y asienta el resto', () => {
    // a: 10 -> 12 (+2), b: 10 -> 9 (-1)  =>  1 transferencia b->a, 1 entrada en a
    expect(
      planificarReparto([
        { sectorId: 'a', actual: 10, nuevo: 12 },
        { sectorId: 'b', actual: 10, nuevo: 9 },
      ]),
    ).toEqual([
      {
        tipo: TipoMovimiento.TRANSFERENCIA,
        sectorOrigenId: 'b',
        sectorDestinoId: 'a',
        cantidad: 1,
        motivo: 'Reparto desde el producto',
      },
      {
        tipo: TipoMovimiento.ENTRADA,
        sectorDestinoId: 'a',
        cantidad: 1,
        motivo: 'Carga desde el producto',
      },
    ]);
  });

  it('el total del libro explica el cambio de cada sector', () => {
    const cambios = [
      { sectorId: 'a', actual: 3, nuevo: 0 },
      { sectorId: 'b', actual: 8, nuevo: 2 },
      { sectorId: 'c', actual: 0, nuevo: 4 },
      { sectorId: 'd', actual: 1, nuevo: 6 },
    ];
    const neto = new Map<string, number>();
    for (const paso of planificarReparto(cambios)) {
      if (paso.sectorOrigenId) {
        neto.set(
          paso.sectorOrigenId,
          (neto.get(paso.sectorOrigenId) ?? 0) - paso.cantidad,
        );
      }
      if (paso.sectorDestinoId) {
        neto.set(
          paso.sectorDestinoId,
          (neto.get(paso.sectorDestinoId) ?? 0) + paso.cantidad,
        );
      }
    }
    for (const c of cambios) {
      expect(neto.get(c.sectorId) ?? 0).toBe(c.nuevo - c.actual);
    }
  });
});
