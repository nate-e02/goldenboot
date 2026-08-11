// routes/players.js
// -----------------------------------------------------------------------
// Players belong to a club. Referees pick from this list when logging
// who scored / who got a card during a match.
// -----------------------------------------------------------------------

const express = require('express');
const db = require('../db/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// better-sqlite3 threw synchronously, so Express caught a failed query on
// its own and fell through to the default error handler. `pg` calls are
// async, so a rejected query inside an async handler would otherwise become
// an unhandled promise rejection and crash the whole process - ah() routes
// it to next(err) instead, restoring the old crash-free behavior.
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// List players, optionally filtered by ?club_id=
router.get('/', ah(async (req, res) => {
  const { club_id } = req.query;
  const rows = club_id
    ? await db.prepare('SELECT * FROM players WHERE club_id = ? ORDER BY name').all(club_id)
    : await db.prepare('SELECT * FROM players ORDER BY name').all();
  res.json({ players: rows });
}));

router.post('/', requireRole('superadmin', 'admin'), ah(async (req, res) => {
  const { club_id, name, jersey_number } = req.body;
  if (!club_id || !name) {
    return res.status(400).json({ error: 'club_id and name are required.' });
  }
  const info = await db
    .prepare('INSERT INTO players (club_id, name, jersey_number) VALUES (?, ?, ?)')
    .run(club_id, name, jersey_number || null);
  res.status(201).json({ id: info.lastInsertRowid });
}));

router.delete('/:id', requireRole('superadmin', 'admin'), ah(async (req, res) => {
  await db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
