const { pool, withTransaction } = require('./db');
const { calculateFee } = require('./feeCalculator');
const events = require('./events');
const {
  NoSpotAvailableError, AlreadyParkedError, TicketNotFoundError, ValidationError,
} = require('./errors');

const REQUIRED_RANK = { MOTORCYCLE: 1, CAR: 2, BUS: 3 };

async function getAvailability(db = pool) {
  const { rows } = await db.query(`
    SELECT size,
           COUNT(*) FILTER (WHERE status = 'AVAILABLE')       AS available,
           COUNT(*) FILTER (WHERE status <> 'OUT_OF_SERVICE') AS total
    FROM parking_spots
    GROUP BY size, size_rank
    ORDER BY size_rank`);
  return rows.map(r => ({ size: r.size, available: +r.available, total: +r.total }));
}

async function publishAvailability() {
  try { events.emit('availability', await getAvailability()); } catch {  }
}

async function checkIn(plate, type) {
  if (!plate || !REQUIRED_RANK[type]) throw new ValidationError('plate and valid type required');
  plate = plate.trim().toUpperCase();

  const ticket = await withTransaction(async (tx) => {
    const { rows: [vehicle] } = await tx.query(
      `INSERT INTO vehicles (plate, type) VALUES ($1, $2)
       ON CONFLICT (plate) DO UPDATE SET type = EXCLUDED.type
       RETURNING id`, [plate, type]);

    const { rows: [spot] } = await tx.query(
      `SELECT id, floor_id, spot_number, size
         FROM parking_spots
        WHERE status = 'AVAILABLE' AND size_rank >= $1
        ORDER BY size_rank, floor_id, id
        LIMIT 1
        FOR UPDATE SKIP LOCKED`, [REQUIRED_RANK[type]]);
    if (!spot) throw new NoSpotAvailableError();

    await tx.query(`UPDATE parking_spots SET status = 'OCCUPIED' WHERE id = $1`, [spot.id]);

    try {
      const { rows: [t] } = await tx.query(
        `INSERT INTO tickets (vehicle_id, spot_id) VALUES ($1, $2)
         RETURNING id, entry_time`, [vehicle.id, spot.id]);
      return { ticketId: t.id, plate, type, entryTime: t.entry_time,
               spot: { floor: spot.floor_id, number: spot.spot_number, size: spot.size } };
    } catch (err) {
      if (err.code === '23505') throw new AlreadyParkedError();
      throw err;
    }
  });

  publishAvailability();
  return ticket;
}

async function checkOut(ticketId) {
  const result = await withTransaction(async (tx) => {
    const { rows: [t] } = await tx.query(
      `SELECT t.*, v.type AS vehicle_type, now() AS now
         FROM tickets t JOIN vehicles v ON v.id = t.vehicle_id
        WHERE t.id = $1
        FOR UPDATE OF t`, [ticketId]).catch(e => {
          if (e.code === '22P02') throw new TicketNotFoundError();
          throw e;
        });
    if (!t) throw new TicketNotFoundError();

    if (t.status === 'COMPLETED') {
      return { ticketId: t.id, entryTime: t.entry_time, exitTime: t.exit_time,
               feeCents: t.fee_cents, alreadyCompleted: true, freed: false };
    }

    const { rows: [rate] } = await tx.query(
      `SELECT * FROM rates WHERE vehicle_type = $1`, [t.vehicle_type]);

    const fee = calculateFee({ entryTime: t.entry_time, exitTime: t.now, rate });

    await tx.query(
      `UPDATE tickets SET exit_time = $2, fee_cents = $3, status = 'COMPLETED' WHERE id = $1`,
      [t.id, t.now, fee]);
    await tx.query(`UPDATE parking_spots SET status = 'AVAILABLE' WHERE id = $1`, [t.spot_id]);

    return { ticketId: t.id, entryTime: t.entry_time, exitTime: t.now,
             feeCents: fee, alreadyCompleted: false, freed: true };
  });

  if (result.freed) publishAvailability();
  return result;
}

module.exports = { checkIn, checkOut, getAvailability };
