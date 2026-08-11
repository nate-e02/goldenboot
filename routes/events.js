// routes/events.js
// -----------------------------------------------------------------------
// This is what referees use during a game: log a goal, an assist, a
// yellow card or a red card, tied to a club and (optionally) a player.
//
// Goals automatically update the match score (see recalcScore in
// routes/matches.js) so the referee never has to type the score by hand.
// -----------------------------------------------------------------------

const express = require('express');
const db = require('../db/database');
const { requireRole } = require('../middleware/auth');
const { recalcScore } = require('./matches');

const router = express.Router();

// better-sqlite3 threw synchronously, so Express caught a failed query on
// its own and fell through to the default error handler. `pg` calls are
// async, so a rejected query inside an async handler would otherwise become
// an unhandled promise rejection and crash the whole process - ah() routes
// it to next(err) instead, restoring the old crash-free behavior.
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// All events for one match (also available bundled into GET /api/matches/:id)
router.get('/matches/:matchId/events', ah(async (req, res) => {
  const events = await db.prepare(`
    SELECT e.*, p.name AS player_name, c.name AS club_name
    FROM match_events e
    LEFT JOIN players p ON e.player_id = p.id
    LEFT JOIN clubs c ON e.club_id = c.id
    WHERE e.match_id = ?
    ORDER BY e.minute ASC, e.id ASC
  `).all(req.params.matchId);
  res.json({ events });
}));

// Log a new event
router.post('/matches/:matchId/events', requireRole('superadmin', 'admin', 'referee'), ah(async (req, res) => {
  const { club_id, player_id, event_type, minute } = req.body;
  if (!club_id || !event_type) {
    return res.status(400).json({ error: 'club_id and event_type are required.' });
  }
  if (!['goal', 'assist', 'yellow', 'red'].includes(event_type)) {
    return res.status(400).json({ error: 'event_type must be goal, assist, yellow or red.' });
  }

  const info = await db.prepare(`
    INSERT INTO match_events (match_id, club_id, player_id, event_type, minute)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.matchId, club_id, player_id || null, event_type, minute || null);

  if (event_type === 'goal') await recalcScore(req.params.matchId);

  res.status(201).json({ id: info.lastInsertRowid });
}));

// Remove an event (e.g. referee logged the wrong thing)
router.delete('/events/:id', requireRole('superadmin', 'admin', 'referee'), ah(async (req, res) => {
  const event = await db.prepare('SELECT * FROM match_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  await db.prepare('DELETE FROM match_events WHERE id = ?').run(req.params.id);
  if (event.event_type === 'goal') await recalcScore(event.match_id);

  res.json({ ok: true });
}));

// Superadmin only: attach or change the player credited for an existing
// event. Used to fill in an "unknown scorer" goal after the match. This
// only touches the one event row by id, so it never affects any other
// match or event.
router.put('/events/:id', requireRole('superadmin'), ah(async (req, res) => {
  const { player_id } = req.body;
  const event = await db.prepare('SELECT * FROM match_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  if (player_id) {
    const player = await db.prepare('SELECT * FROM players WHERE id = ? AND club_id = ?')
      .get(player_id, event.club_id);
    if (!player) {
      return res.status(400).json({ error: 'That player is not on the club credited with this event.' });
    }
  }

  await db.prepare('UPDATE match_events SET player_id = ? WHERE id = ?').run(player_id || null, req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
