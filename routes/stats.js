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

function leaderboard(eventType, gender) {
  return db.prepare(`
    SELECT p.id AS player_id, p.name AS player_name, c.name AS club_name,
           COUNT(*) AS total
    FROM match_events e
    JOIN players p ON e.player_id = p.id
    JOIN clubs c ON e.club_id = c.id
    JOIN tournaments t ON c.tournament_id = t.id
    WHERE e.event_type = ? AND t.gender = ?
    GROUP BY p.id
    ORDER BY total DESC, p.name ASC
  `).all(eventType, gender);
}

router.get('/scorers', (req, res) => {
  const gender = req.query.gender === 'women' ? 'women' : 'men';
  res.json({ gender, leaderboard: leaderboard('goal', gender) });
});

router.get('/assists', (req, res) => {
  const gender = req.query.gender === 'women' ? 'women' : 'men';
  res.json({ gender, leaderboard: leaderboard('assist', gender) });
});

module.exports = router;
