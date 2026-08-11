// routes/tournaments.js
// -----------------------------------------------------------------------
// Tournaments are the top-level container: "Men's Tournament 2026",
// "Women's Tournament 2026", etc. Each tournament has a gender, a size
// (2/4/8/16 teams) and, once clubs are assigned, an auto-generated
// knockout bracket.
// -----------------------------------------------------------------------

const express = require('express');
const db = require('../db/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// ---- helpers -----------------------------------------------------------

// How many knockout rounds does a tournament of this size need?
// 16 teams -> 4 rounds (Round of 16, QF, SF, Final)
function totalRounds(size) {
  return Math.log2(size);
}

// Human-readable name for a round, based on how many rounds are left.
function roundName(round, rounds) {
  const roundsFromFinal = rounds - round; // 0 = final
  if (roundsFromFinal === 0) return 'Final';
  if (roundsFromFinal === 1) return 'Semi-final';
  if (roundsFromFinal === 2) return 'Quarter-final';
  return `Round of ${Math.pow(2, roundsFromFinal + 1)}`;
}

// Builds every match row for a brand-new bracket: round 1 gets the real
// clubs (in the order given), later rounds start empty and get filled in
// automatically as winners are recorded (see PUT /matches/:id/result).
async function generateBracket(tournamentId, clubIds) {
  const size = clubIds.length;
  const rounds = totalRounds(size);

  const insertMatch = db.prepare(`
    INSERT INTO matches (tournament_id, round, position, team1_id, team2_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Round 1: pair up the clubs as given (1v2, 3v4, 5v6, ...)
  const firstRoundMatches = size / 2;
  for (let i = 0; i < firstRoundMatches; i++) {
    await insertMatch.run(tournamentId, 1, i + 1, clubIds[i * 2], clubIds[i * 2 + 1]);
  }

  // Later rounds: empty placeholders, winners get slotted in later
  for (let round = 2; round <= rounds; round++) {
    const matchesInRound = size / Math.pow(2, round);
    for (let position = 1; position <= matchesInRound; position++) {
      await insertMatch.run(tournamentId, round, position, null, null);
    }
  }
}

// ---- routes -------------------------------------------------------------

// better-sqlite3 threw synchronously, so Express caught a failed query on
// its own and fell through to the default error handler. `pg` calls are
// async, so a rejected query inside an async handler would otherwise become
// an unhandled promise rejection and crash the whole process - ah() routes
// it to next(err) instead, restoring the old crash-free behavior.
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// List tournaments, optionally filtered by ?gender=men / women
router.get('/', ah(async (req, res) => {
  const { gender } = req.query;
  const rows = gender
    ? await db.prepare('SELECT * FROM tournaments WHERE gender = ? ORDER BY id DESC').all(gender)
    : await db.prepare('SELECT * FROM tournaments ORDER BY id DESC').all();
  res.json({ tournaments: rows });
}));

// Get one tournament plus its full bracket (all matches, with club names)
router.get('/:id/bracket', ah(async (req, res) => {
  const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });

  const matches = await db.prepare(`
    SELECT m.*, c1.name AS team1_name, c2.name AS team2_name, cw.name AS winner_name
    FROM matches m
    LEFT JOIN clubs c1 ON m.team1_id = c1.id
    LEFT JOIN clubs c2 ON m.team2_id = c2.id
    LEFT JOIN clubs cw ON m.winner_id = cw.id
    WHERE m.tournament_id = ?
    ORDER BY m.round ASC, m.position ASC
  `).all(req.params.id);

  const rounds = totalRounds(tournament.size);
  const byRound = {};
  for (let r = 1; r <= rounds; r++) {
    byRound[r] = {
      round: r,
      name: roundName(r, rounds),
      matches: matches.filter((m) => m.round === r),
    };
  }

  res.json({ tournament, rounds: Object.values(byRound) });
}));

// Create a tournament (admin only)
router.post('/', requireRole('superadmin', 'admin'), ah(async (req, res) => {
  const { name, gender, year, size } = req.body;
  if (!name || !gender) {
    return res.status(400).json({ error: 'name and gender are required.' });
  }
  if (!['men', 'women'].includes(gender)) {
    return res.status(400).json({ error: 'gender must be "men" or "women".' });
  }
  const bracketSize = size || 16;
  if (![2, 4, 8, 16].includes(bracketSize)) {
    return res.status(400).json({ error: 'size must be 2, 4, 8 or 16.' });
  }

  const info = await db
    .prepare('INSERT INTO tournaments (name, gender, year, size) VALUES (?, ?, ?, ?)')
    .run(name, gender, year || new Date().getFullYear(), bracketSize);

  res.status(201).json({ id: info.lastInsertRowid });
}));

// Generate (or re-generate) the bracket once clubs are ready.
// Body: { clubIds: [ ... in the order you want them seeded, 1v2, 3v4, ... ] }
router.post('/:id/generate-bracket', requireRole('superadmin', 'admin'), ah(async (req, res) => {
  const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });

  const { clubIds } = req.body;
  if (!Array.isArray(clubIds) || clubIds.length !== tournament.size) {
    return res.status(400).json({
      error: `This tournament needs exactly ${tournament.size} clubs to generate a bracket.`,
    });
  }

  // wipe any existing bracket for this tournament and rebuild it
  await db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournament.id);
  await generateBracket(tournament.id, clubIds);

  res.json({ ok: true });
}));

module.exports = router;
