// server.js
// -----------------------------------------------------------------------
// The entry point. Run with:  npm start
// This starts a web server on http://localhost:3000 (or PORT env var).
//
// It does three things:
//   1. Serves the static front-end files in /public
//   2. Exposes a JSON API under /api/... that the front-end calls
//   3. Keeps track of who's logged in using cookie-based sessions
// -----------------------------------------------------------------------

const express = require('express');
const session = require('express-session');
const path = require('path');

require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  session({
    secret: 'goldenboot-hawassa-change-this-secret', // change this for real deployments
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 12 }, // 12 hour login
  })
);

// ---- API routes ----------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admins', require('./routes/admins'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/players', require('./routes/players'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api', require('./routes/events')); // adds /api/matches/:id/events and /api/events/:id

// ---- front-end -------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`GOLDENBOOT TOURNAMENT HAWASSA running at http://localhost:${PORT}`);
});
