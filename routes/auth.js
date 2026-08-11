// routes/auth.js
// -----------------------------------------------------------------------
// /api/auth/login   - log an admin/referee in
// /api/auth/logout  - log out
// /api/auth/me      - "who am I currently logged in as?" (used by the
//                      front-end to decide whether to show admin controls)
// -----------------------------------------------------------------------

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const router = express.Router();

// better-sqlite3 threw synchronously, so Express caught a failed query on
// its own and fell through to the default error handler. `pg` calls are
// async, so a rejected query inside an async handler would otherwise become
// an unhandled promise rejection and crash the whole process - ah() routes
// it to next(err) instead, restoring the old crash-free behavior.
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.post('/login', ah(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const account = await db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!account || !bcrypt.compareSync(password, account.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  req.session.user = { id: account.id, username: account.username, role: account.role };
  res.json({ user: req.session.user });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

module.exports = router;
