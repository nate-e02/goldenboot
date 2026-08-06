// db/database.js
// -----------------------------------------------------------------------
// This file opens (and if needed, creates) the SQLite database file at
// db/goldenboot.db, and makes sure all the tables we need exist.
//
// SQLite stores the WHOLE database in a single file. That means backing
// up your tournament data is as easy as copying db/goldenboot.db somewhere
// safe.
// -----------------------------------------------------------------------

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'goldenboot.db');
const db = new Database(dbPath);

// Enforce foreign key constraints (e.g. deleting a tournament also
// deletes its clubs, matches, etc.)
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('superadmin','admin','referee')),
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournaments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  gender     TEXT NOT NULL CHECK(gender IN ('men','women')),
  year       INTEGER,
  size       INTEGER NOT NULL DEFAULT 16, -- number of teams: 2, 4, 8 or 16
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clubs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  logo_url      TEXT
);

CREATE TABLE IF NOT EXISTS players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  club_id    INTEGER NOT NULL REFERENCES clubs(id),
  player_id  INTEGER REFERENCES players(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('goal','assist','yellow','red')),
  minute     INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

module.exports = db;
