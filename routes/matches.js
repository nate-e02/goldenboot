// routes/matches.js
// -----------------------------------------------------------------------
// A "match" is one game in the bracket. Scores are NOT typed in by hand -
// they are automatically counted from the goal events a referee logs
// (see routes/events.js). This keeps the score and the scorer list from
// ever disagreeing with each other.
//
// Admins set the schedule (date/time, venue).
// Admins & referees can start a match ("live") and finish it, at which
// point the winner is worked out and pushed into the next round of the
// bracket automatically.
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

// Recalculate team1_score / team2_score for a match by counting its
// 'goal' events. Call this any time an event is added or removed.
async function recalcScore(matchId) {
  const match = await db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) return;

  const goalsFor = async (clubId) =>
    (await db.prepare(`
      SELECT COUNT(*) AS n FROM match_events
      WHERE match_id = ? AND club_id = ? AND event_type = 'goal'
    `).get(matchId, clubId)).n;

  const team1_score = match.team1_id ? await goalsFor(match.team1_id) : 0;
  const team2_score = match.team2_id ? await goalsFor(match.team2_id) : 0;

  await db.prepare('UPDATE matches SET team1_score = ?, team2_score = ? WHERE id = ?')
    .run(team1_score, team2_score, matchId);
}

// Once a match is finished, push its winner into the correct slot of
// the next round's match (team1 if this was an odd position, team2 if
// even). If there is no next round, this WAS the final - nothing to do.
async function advanceWinner(match) {
  const nextRound = match.round + 1;
  const nextPosition = Math.ceil(match.position / 2);
  const nextMatch = await db.prepare(`
    SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND position = ?
  `).get(match.tournament_id, nextRound, nextPosition);

  if (!nextMatch) return; // this was the final

  const slotIsTeam1 = match.position % 2 === 1;
  if (slotIsTeam1) {
    await db.prepare('UPDATE matches SET team1_id = ? WHERE id = ?').run(match.winner_id, nextMatch.id);
  } else {
    await db.prepare('UPDATE matches SET team2_id = ? WHERE id = ?').run(match.winner_id, nextMatch.id);
  }
}

// Get one match with team names, tournament info, and its full event list
router.get('/:id', ah(async (req, res) => {
  const match = await db.prepare(`
    SELECT m.*, c1.name AS team1_name, c2.name AS team2_name, cw.name AS winner_name,
           t.name AS tournament_name, t.gender AS tournament_gender
    FROM matches m
    LEFT JOIN clubs c1 ON m.team1_id = c1.id
    LEFT JOIN clubs c2 ON m.team2_id = c2.id
    LEFT JOIN clubs cw ON m.winner_id = cw.id
    LEFT JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = ?
  `).get(req.params.id);

  if (!match) return res.status(404).json({ error: 'Match not found.' });

  const events = await db.prepare(`
    SELECT e.*, p.name AS player_name, c.name AS club_name
    FROM match_events e
    LEFT JOIN players p ON e.player_id = p.id
    LEFT JOIN clubs c ON e.club_id = c.id
    WHERE e.match_id = ?
    ORDER BY e.minute ASC, e.id ASC
  `).all(req.params.id);

  res.json({ match, events });
}));

// Admin sets/edits the schedule
router.put('/:id/schedule', requireRole('superadmin', 'admin'), ah(async (req, res) => {
  const { match_date, venue } = req.body;
  await db.prepare('UPDATE matches SET match_date = ?, venue = ? WHERE id = ?')
    .run(match_date || null, venue || null, req.params.id);
  res.json({ ok: true });
}));

// Superadmin only: manually edit who plays who in an already-generated match.
// Lets the superadmin fix a bracket pairing (e.g. wrong seeding) after the
// fact. Since changing the matchup invalidates any result already recorded,
// this also clears that match's goal events and resets its score/winner/status.
router.put('/:id/teams', requireRole('superadmin'), ah(async (req, res) => {
  const { team1_id, team2_id } = req.body;
  const match = await db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found.' });

  const validateClub = async (clubId) => {
    if (clubId === null || clubId === undefined || clubId === '') return true;
    const club = await db.prepare('SELECT * FROM clubs WHERE id = ? AND tournament_id = ?')
      .get(clubId, match.tournament_id);
    return !!club;
  };

  if (!(await validateClub(team1_id)) || !(await validateClub(team2_id))) {
    return res.status(400).json({ error: 'Both clubs must belong to this tournament.' });
  }

  await db.prepare('DELETE FROM match_events WHERE match_id = ?').run(req.params.id);
  await db.prepare(`
    UPDATE matches
    SET team1_id = ?, team2_id = ?, team1_score = 0, team2_score = 0,
        winner_id = NULL, status = 'scheduled'
    WHERE id = ?
  `).run(team1_id || null, team2_id || null, req.params.id);

  res.json({ ok: true });
}));

// Admin or referee changes status: 'scheduled' -> 'live' -> 'finished'
// To finish a match that's still tied on goals (e.g. decided on penalties),
// include { winner_id } in the body to say who goes through.
router.put('/:id/status', requireRole('superadmin', 'admin', 'referee'), ah(async (req, res) => {
  const { status, winner_id } = req.body;
  if (!['scheduled', 'live', 'finished'].includes(status)) {
    return res.status(400).json({ error: 'status must be scheduled, live or finished.' });
  }

  const match = await db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found.' });

  if (status !== 'finished') {
    await db.prepare('UPDATE matches SET status = ? WHERE id = ?').run(status, req.params.id);
    return res.json({ ok: true });
  }

  // Finishing a match: work out the winner
  if (!match.team1_id || !match.team2_id) {
    return res.status(400).json({ error: 'Both teams must be set before finishing a match.' });
  }

  let finalWinnerId;
  if (match.team1_score !== match.team2_score) {
    finalWinnerId = match.team1_score > match.team2_score ? match.team1_id : match.team2_id;
  } else if (winner_id) {
    finalWinnerId = winner_id; // e.g. decided on penalties
  } else {
    return res.status(400).json({
      error: 'Scores are tied - include winner_id (e.g. after a penalty shoot-out) to finish this match.',
    });
  }

  await db.prepare('UPDATE matches SET status = ?, winner_id = ? WHERE id = ?')
    .run('finished', finalWinnerId, req.params.id);

  const updated = await db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  await advanceWinner(updated);

  res.json({ ok: true, winner_id: finalWinnerId });
}));

module.exports = router;
module.exports.recalcScore = recalcScore;
