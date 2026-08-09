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
const rateLimit = require('express-rate-limit');
const path = require('path');

require('./db/database'); // makes sure the database + tables exist

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET env var is required in production. Set it and restart.');
  process.exit(1);
}

// Most hosts (Render, Railway, Heroku, Fly) terminate HTTPS in front of
// your app - this tells Express to trust that, so secure cookies work.
if (isProd) app.set('trust proxy', 1);

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'goldenboot-hawassa-dev-only-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 12, // 12 hour login
      httpOnly: true,
      secure: isProd,      // only send the cookie over HTTPS in production
      sameSite: 'lax',
    },
  })
);

// Slow down brute-force password guessing on login.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});
app.use('/api/auth/login', loginLimiter);

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