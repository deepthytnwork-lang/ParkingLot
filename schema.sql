CREATE TYPE vehicle_type  AS ENUM ('MOTORCYCLE', 'CAR', 'BUS');
CREATE TYPE spot_size     AS ENUM ('SMALL', 'MEDIUM', 'LARGE');
CREATE TYPE spot_status   AS ENUM ('AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE');
CREATE TYPE ticket_status AS ENUM ('ACTIVE', 'COMPLETED');

CREATE TABLE floors (
  id    SERIAL PRIMARY KEY,
  level INT NOT NULL UNIQUE
);

CREATE TABLE parking_spots (
  id          SERIAL PRIMARY KEY,
  floor_id    INT NOT NULL REFERENCES floors(id),
  spot_number VARCHAR(10) NOT NULL,
  size        spot_size NOT NULL,
  size_rank   SMALLINT NOT NULL,
  status      spot_status NOT NULL DEFAULT 'AVAILABLE',
  UNIQUE (floor_id, spot_number)
);

CREATE INDEX idx_spots_allocation
  ON parking_spots (size_rank, floor_id, id)
  WHERE status = 'AVAILABLE';

CREATE TABLE vehicles (
  id    SERIAL PRIMARY KEY,
  plate VARCHAR(20) NOT NULL UNIQUE,
  type  vehicle_type NOT NULL
);

CREATE TABLE rates (
  vehicle_type      vehicle_type PRIMARY KEY,
  hourly_rate_cents INT NOT NULL,
  daily_cap_cents   INT NOT NULL,
  grace_minutes     INT NOT NULL DEFAULT 10
);

INSERT INTO rates VALUES
  ('MOTORCYCLE', 200,  1000, 10),
  ('CAR',        500,  3000, 10),
  ('BUS',       1500,  9000, 10);

CREATE TABLE tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  INT NOT NULL REFERENCES vehicles(id),
  spot_id     INT NOT NULL REFERENCES parking_spots(id),
  entry_time  TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_time   TIMESTAMPTZ,
  fee_cents   INT,
  status      ticket_status NOT NULL DEFAULT 'ACTIVE'
);

CREATE UNIQUE INDEX one_active_ticket_per_vehicle ON tickets (vehicle_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX one_active_ticket_per_spot    ON tickets (spot_id)    WHERE status = 'ACTIVE';
