-- QC Checklist backend schema (PostgreSQL).
--
-- Mirrors the mobile SQLite schema (src/database/db.ts) and adds the
-- server-only tables needed for multi-user sync and cross-device management
-- alerts: `alerts`, `device_tokens`, and the `sync_log` audit trail.
--
-- Idempotent: safe to run repeatedly. Applied by `npm run migrate`.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  location    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Templates -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  division    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_items (
  id               UUID PRIMARY KEY,
  template_id      UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  description_text TEXT NOT NULL,
  sort_order       INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist instances -------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_instances (
  id                  UUID PRIMARY KEY,
  project_id          UUID NOT NULL REFERENCES projects(id),
  template_id         UUID NOT NULL REFERENCES templates(id),
  inspector_name      TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'COMPLETED')),
  created_at          TIMESTAMPTZ NOT NULL,
  signed_off_at       TIMESTAMPTZ,
  inspector_signature TEXT,
  pm_signature        TEXT,
  synced_at           TIMESTAMPTZ
);

-- Checklist results ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_results (
  id               UUID PRIMARY KEY,
  instance_id      UUID NOT NULL REFERENCES checklist_instances(id) ON DELETE CASCADE,
  template_item_id UUID NOT NULL REFERENCES template_items(id),
  status           TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'NA')),
  -- Risk severity, set when an item is marked FAIL. NULL otherwise.
  severity         TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  comments         TEXT,
  photo_uri        TEXT,
  created_at       TIMESTAMPTZ NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL,
  synced_at        TIMESTAMPTZ
);

-- Idempotent column add for databases created before severity existed.
ALTER TABLE checklist_results ADD COLUMN IF NOT EXISTS severity TEXT
  CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH'));

-- Punch items ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS punch_items (
  id                    UUID PRIMARY KEY,
  checklist_instance_id UUID NOT NULL REFERENCES checklist_instances(id) ON DELETE CASCADE,
  template_item_id      UUID NOT NULL REFERENCES template_items(id),
  description           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'OPEN'
                          CHECK (status IN ('OPEN', 'CLOSED')),
  created_at            TIMESTAMPTZ NOT NULL,
  closed_at            TIMESTAMPTZ,
  synced_at            TIMESTAMPTZ
);

-- Management alerts ---------------------------------------------------------
-- A serious (HIGH-severity) event raised during an inspection. Pushed up from
-- the device that recorded it, fanned out to other managers' devices via Expo
-- push, and surfaced in every manager's alerts inbox.
CREATE TABLE IF NOT EXISTS alerts (
  id            UUID PRIMARY KEY,
  instance_id   UUID NOT NULL,
  result_id     UUID,
  project_id    UUID,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  severity      TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  acknowledged  BOOLEAN NOT NULL DEFAULT FALSE,
  -- User who recorded the event; excluded from the push fan-out.
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_project    ON alerts (project_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);

-- Device push tokens --------------------------------------------------------
-- One row per device a user has registered for push. Managers receive the
-- alert fan-out; tokens are upserted on the Expo push token so a device that
-- re-registers (e.g. after reinstall) updates in place.
CREATE TABLE IF NOT EXISTS device_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  expo_push_token TEXT NOT NULL UNIQUE,
  role            TEXT,
  -- Projects this device's user is scoped to; NULL/empty => unrestricted.
  project_ids     UUID[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_role ON device_tokens (role);

-- Workplace safety: incident reports ----------------------------------------
-- Mirrors the mobile `incident_reports` table. HIGH-severity incidents also
-- raise an `alerts` row so management is notified across devices.
CREATE TABLE IF NOT EXISTS incident_reports (
  id                 UUID PRIMARY KEY,
  project_id         UUID NOT NULL REFERENCES projects(id),
  category           TEXT NOT NULL,
  severity           TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  description        TEXT NOT NULL,
  location           TEXT,
  date_time          TIMESTAMPTZ NOT NULL,
  involved_parties   TEXT,
  status             TEXT NOT NULL DEFAULT 'OPEN'
                       CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED')),
  reporter_name      TEXT NOT NULL,
  corrective_actions TEXT,
  sync_status        TEXT,
  created_at         TIMESTAMPTZ NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_project ON incident_reports (project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status  ON incident_reports (status);

CREATE TABLE IF NOT EXISTS incident_attachments (
  id                 UUID PRIMARY KEY,
  incident_id        UUID NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
  photo_local_uri    TEXT NOT NULL,
  photo_remote_url   TEXT,
  photo_sync_status  TEXT DEFAULT 'PENDING',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workplace safety: safety tips ---------------------------------------------
CREATE TABLE IF NOT EXISTS safety_tips (
  id          UUID PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  category    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  last_shown  TIMESTAMPTZ
);

-- Equipment permits: hot work permits ----------------------------------------
CREATE TABLE IF NOT EXISTS hot_work_permits (
  id                    UUID PRIMARY KEY,
  project_id            UUID NOT NULL REFERENCES projects(id),
  permit_number         TEXT NOT NULL,
  work_location         TEXT NOT NULL,
  work_description      TEXT NOT NULL,
  start_date            TIMESTAMPTZ NOT NULL,
  end_date              TIMESTAMPTZ NOT NULL,
  authorized_by         TEXT NOT NULL,
  precautions_taken     TEXT NOT NULL,
  equipment_list        TEXT,
  responsible_person    TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'ACTIVE'
                          CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hot_work_project ON hot_work_permits (project_id);
CREATE INDEX IF NOT EXISTS idx_hot_work_status  ON hot_work_permits (status);

-- Equipment permits: rigging forms ------------------------------------------
CREATE TABLE IF NOT EXISTS rigging_forms (
  id                    UUID PRIMARY KEY,
  project_id            UUID NOT NULL REFERENCES projects(id),
  rigging_number        TEXT NOT NULL,
  load_description      TEXT NOT NULL,
  load_weight           NUMERIC NOT NULL,
  rigging_plan          TEXT NOT NULL,
  inspected_by          TEXT NOT NULL,
  certification_number  TEXT NOT NULL,
  weather_conditions    TEXT,
  area_secured          BOOLEAN NOT NULL DEFAULT FALSE,
  personnel_briefed     BOOLEAN NOT NULL DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING', 'APPROVED', 'IN_USE', 'COMPLETED', 'REJECTED')),
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rigging_project ON rigging_forms (project_id);
CREATE INDEX IF NOT EXISTS idx_rigging_status  ON rigging_forms (status);

-- Sync audit log ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_log (
  id               SERIAL PRIMARY KEY,
  user_id          UUID,
  action           TEXT NOT NULL,
  payload          JSONB,
  result_count     INTEGER,
  punch_item_count INTEGER,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
