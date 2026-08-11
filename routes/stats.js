// routes/stats.js
// -----------------------------------------------------------------------
// Powers the "Top Goal Scorer" and "Top Assist" pages. Filtered by
// ?gender=men or ?gender=women so the public pages can show separate
// men's / women's leaderboards.
//
// Kept deliberately simple, as requested: just name, club and a count -
// no shots-on-target / advanced stats, since this is a grassroots event.
// -----------------------------------------------------------------------

const express = require('express');
const db = require('../db/database');

const router = express.Router();

// better-sqlite3 threw synchronously, so Express caught a failed query on
// its own and fell through to the default error handler. `pg` calls are
// async, so a rejected query inside an async handler would otherwise become
// an unhandled promise rejection and crash the whole process - ah() routes
// it to next(err) instead, restoring the old crash-free behavior.
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function leaderboard(eventType, gender) {
  return db.prepare(`
    SELECT p.id AS player_id, p.name AS player_name, c.name AS club_name,
           COUNT(*) AS total
    FROM match_events e
    JOIN players p ON e.player_id = p.id
    JOIN clubs c ON e.club_id = c.id
    JOIN tournaments t ON c.tournament_id = t.id
    WHERE e.event_type = ? AND t.gender = ?
    GROUP BY p.id, p.name, c.name
    ORDER BY total DESC, p.name ASC
  `).all(eventType, gender);
}

router.get('/scorers', ah(async (req, res) => {
  const gender = req.query.gender === 'women' ? 'women' : 'men';
  res.json({ gender, leaderboard: await leaderboard('goal', gender) });
}));

router.get('/assists', ah(async (req, res) => {
  const gender = req.query.gender === 'women' ? 'women' : 'men';
  res.json({ gender, leaderboard: await leaderboard('assist', gender) });
}));

module.exports = router;
