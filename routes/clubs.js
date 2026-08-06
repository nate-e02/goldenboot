// routes/clubs.js
// -----------------------------------------------------------------------
// Clubs belong to a tournament. Admin adds them here first, then uses
// them (their ids) to generate the bracket.
// -----------------------------------------------------------------------

const express = require('express');
const db = require('../db/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// List clubs, optionally filtered by ?tournament_id=
router.get('/', (req, res) => {
  const { tournament_id } = req.query;
  const rows = tournament_id
    ? db.prepare('SELECT * FROM clubs WHERE tournament_id = ? ORDER BY name').all(tournament_id)
    : db.prepare('SELECT * FROM clubs ORDER BY name').all();
  res.json({ clubs: rows });
});

router.post('/', requireRole('superadmin', 'admin'), (req, res) => {
  const { tournament_id, name, logo_url } = req.body;
  if (!tournament_id || !name) {
    return res.status(400).json({ error: 'tournament_id and name are required.' });
  }
  const info = db
    .prepare('INSERT INTO clubs (tournament_id, name, logo_url) VALUES (?, ?, ?)')
    .run(tournament_id, name, logo_url || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/:id', requireRole('superadmin', 'admin'), (req, res) => {
  db.prepare('DELETE FROM clubs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
