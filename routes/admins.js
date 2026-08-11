// routes/admins.js
// -----------------------------------------------------------------------
// Managing the people who can log in: admins & referees.
// Only a "superadmin" is allowed to see/add/remove these accounts.
// -----------------------------------------------------------------------

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// better-sqlite3 threw synchronously, so Express caught a failed query on
// its own and fell through to the default error handler. `pg` calls are
// async, so a rejected query inside an async handler would otherwise become
// an unhandled promise rejection and crash the whole process - ah() routes
// it to next(err) instead, restoring the old crash-free behavior.
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// List every admin/referee account (no password hashes sent back!)
router.get('/', requireRole('superadmin'), ah(async (req, res) => {
  const rows = await db.prepare('SELECT id, username, role, created_at FROM admins ORDER BY role, username').all();
  res.json({ admins: rows });
}));

// Create a new admin or referee account
router.post('/', requireRole('superadmin'), ah(async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password and role are required.' });
  }
  if (!['superadmin', 'admin', 'referee'].includes(role)) {
    return res.status(400).json({ error: 'role must be superadmin, admin or referee.' });
  }

  const existing = await db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = await db
    .prepare('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, hash, role);

  res.status(201).json({ id: info.lastInsertRowid, username, role });
}));

// Remove an account
router.delete('/:id', requireRole('superadmin'), ah(async (req, res) => {
  // Don't let someone delete their own account by accident while logged in
  if (Number(req.params.id) === req.session.user.id) {
    return res.status(400).json({ error: "You can't delete the account you're logged in with." });
  }
  await db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
