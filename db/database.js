// db/database.js
// -----------------------------------------------------------------------
// This file opens a connection pool to Postgres (e.g. a free Neon
// instance) and makes sure all the tables we need exist.
//
// The connection string comes from the DATABASE_URL env var so that
// compute (e.g. on Render) can be totally separate from where the data
// lives - the app's filesystem can be wiped on every restart/redeploy
// without losing any tournament data, since it's not stored there anymore.
//
// better-sqlite3 was synchronous, so every route file calls
// db.prepare(sql).get/.all/.run(...) directly. `pg` is asynchronous, so
// this module exposes a compatibility layer with the SAME call shape
// (db.prepare(sql).get/.all/.run(...)) but every method returns a Promise.
// That keeps the SQL and call sites in every route file unchanged - only
// `await` needed to be added where they're called.
// -----------------------------------------------------------------------

const { Pool, types } = require('pg');

// Postgres returns COUNT(*) as the `bigint`/int8 type (OID 20), which the
// `pg` driver hands back as a STRING by default (since bigint can exceed
// JS's safe integer range). better-sqlite3 always returned plain JS
// numbers for counts. Our counts (goals, assists, etc.) are always small,
// so parse int8 as a normal number to keep API response shapes (e.g.
// stats leaderboards) identical to before - a string `"3"` instead of the
// number `3` would be a breaking change for anything consuming the JSON.
types.setTypeParser(20, (val) => parseInt(val, 10));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Same schema as before, translated to Postgres syntax:
//   INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL PRIMARY KEY
// Foreign keys are always enforced by Postgres, so the SQLite
// `PRAGMA foreign_keys = ON` this file used to run has no equivalent
// (and isn't needed) here.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('superadmin','admin','referee')),
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournaments (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  gender     TEXT NOT NULL CHECK(gender IN ('men','women')),
  year       INTEGER,
  size       INTEGER NOT NULL DEFAULT 16, -- number of teams: 2, 4, 8 or 16
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clubs (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  logo_url      TEXT
);

CREATE TABLE IF NOT EXISTS players (
  id            SERIAL PRIMARY KEY,
  club_id       INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  jersey_number INTEGER
);

-- round: 1 = Round of 16, 2 = Quarter-final, 3 = Semi-final, 4 = Final
--        (if a tournament has fewer teams, round 1 just starts later,
--         e.g. an 8-team tournament starts at round 2)
-- position: position of this match within its round (1-based). Used to
--        figure out which match in the NEXT round the winner goes to.
CREATE TABLE IF NOT EXISTS matches (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round         INTEGER NOT NULL,
  position      INTEGER NOT NULL,
  team1_id      INTEGER REFERENCES clubs(id),
  team2_id      INTEGER REFERENCES clubs(id),
  team1_score   INTEGER NOT NULL DEFAULT 0,
  team2_score   INTEGER NOT NULL DEFAULT 0,
  match_date    TEXT,   -- free text / ISO datetime, set by admin
  venue         TEXT,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','live','finished')),
  winner_id     INTEGER REFERENCES clubs(id)
);

-- One row per goal / assist / yellow card / red card.
CREATE TABLE IF NOT EXISTS match_events (
  id         SERIAL PRIMARY KEY,
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  club_id    INTEGER NOT NULL REFERENCES clubs(id),
  player_id  INTEGER REFERENCES players(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('goal','assist','yellow','red')),
  minute     INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

// Converts SQLite-style '?' positional placeholders to Postgres's
// '$1, $2, ...' style, since every call site across the route files was
// written against better-sqlite3's placeholder syntax.
function toPgPlaceholders(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

// better-sqlite3's .run() exposes `lastInsertRowid` for INSERTs. Postgres
// has no equivalent built in, so we append "RETURNING id" to every INSERT
// (every table's primary key is `id`) and read it back from the result -
// that's the only way to recover the same `.lastInsertRowid` behavior.
function needsReturningId(sql) {
  return /^\s*insert\s+into/i.test(sql) && !/\breturning\b/i.test(sql);
}

// Mirrors better-sqlite3's db.prepare(sql).get/.all/.run(...) shape, but
// every method returns a Promise since `pg` is async.
function prepare(sql) {
  const isInsert = needsReturningId(sql);
  const text = toPgPlaceholders(sql) + (isInsert ? ' RETURNING id' : '');

  return {
    async get(...params) {
      const result = await pool.query(text, params);
      return result.rows[0];
    },
    async all(...params) {
      const result = await pool.query(text, params);
      return result.rows;
    },
    async run(...params) {
      const result = await pool.query(text, params);
      return {
        lastInsertRowid: isInsert ? result.rows[0].id : undefined,
        changes: result.rowCount,
      };
    },
  };
}

// Resolves once the tables are confirmed to exist. server.js awaits this
// before calling app.listen(), since schema setup is now async.
const ready = pool.query(SCHEMA_SQL).then(() => {});

module.exports = { prepare, ready };
