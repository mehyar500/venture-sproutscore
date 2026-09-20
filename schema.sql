-- schema.sql — SproutScore D1 schema + billing catalog seed.
-- Apply to the mehyar_leads_prod D1 (the DB behind the LEADS_DB binding —
-- same DB as billing_products). Safe to re-run (IF NOT EXISTS / upserts).
-- NOTE: subscribers_global is the shared global subscriber table created by
-- the TrueSketch build; SproutScore writes brand='sproutscore' rows into it.

-- ── orders: one row per paid SproutScore purchase ──────────────────────────
-- Written by the fulfillment hook (fulfillSproutscore.js on mehyar-web) at
-- webhook time. Reports are data lookups, so status='ready' immediately.
CREATE TABLE IF NOT EXISTS sproutscore_orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id       INTEGER NOT NULL,   -- billing_payments.id (UNIQUE: idempotent fulfill)
  access_token     TEXT NOT NULL,      -- buyer capability token (== billing access_token)
  email            TEXT NOT NULL,
  product_id       TEXT NOT NULL,      -- sproutscore-report | sproutscore-3pack
  center_id        TEXT,               -- first center (3-pack redeems more later)
  center_name      TEXT,
  status           TEXT NOT NULL DEFAULT 'ready', -- ready|failed
  created_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  fulfilled_at     TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ss_orders_payment ON sproutscore_orders(payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ss_orders_token ON sproutscore_orders(access_token);

-- ── 3-pack redemptions: which centers a pack buyer has decoded ────────────
CREATE TABLE IF NOT EXISTS sproutscore_pack_uses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES sproutscore_orders(id),
  center_id     TEXT NOT NULL,
  center_name   TEXT,
  redeemed_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(order_id, center_id)
);

-- ── brand subscriber list (free-tier opt-in; mirrored to subscribers_global) ─
CREATE TABLE IF NOT EXISTS sproutscore_subscribers (
  email           TEXT PRIMARY KEY,
  status          TEXT NOT NULL DEFAULT 'subscribed', -- subscribed|unsubscribed
  source          TEXT,              -- teaser | free-tier | checkout
  center_id       TEXT,
  center_name     TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unsubscribed_at TEXT
);

-- ── billing catalog: the two SKUs, fulfillment='sproutscore' ──────────────
-- Price lives ONLY here — the frontend never sets it. (Sibling worker owns
-- this seed; kept here so the schema is self-documenting.)
INSERT INTO billing_products
  (id, name, brand, price_cents, currency, fulfillment, description,
   success_url_template, cancel_url, allowed_return_hosts, active, digital_file)
VALUES
  ('sproutscore-report', 'SproutScore Decoded Report', 'sproutscore', 1900, 'usd', 'sproutscore',
   'Every violation in a NYC daycare inspection record, decoded into plain English.',
   'https://sproutscore.mehyar.us/success.html?token={access_token}',
   'https://sproutscore.mehyar.us/', 'sproutscore.mehyar.us', 1, NULL),
  ('sproutscore-3pack', 'SproutScore 3-Report Pack', 'sproutscore', 3900, 'usd', 'sproutscore',
   'Three decoded daycare inspection reports — compare centers side by side.',
   'https://sproutscore.mehyar.us/success.html?token={access_token}',
   'https://sproutscore.mehyar.us/', 'sproutscore.mehyar.us', 1, NULL)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name, price_cents=excluded.price_cents, fulfillment=excluded.fulfillment,
  description=excluded.description, success_url_template=excluded.success_url_template,
  cancel_url=excluded.cancel_url, allowed_return_hosts=excluded.allowed_return_hosts,
  active=excluded.active;
