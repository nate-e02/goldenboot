// db/seed.js
// -----------------------------------------------------------------------
// Run this ONCE with:   npm run seed
// It creates the very first "superadmin" account so you can log in to
// the admin dashboard for the first time and start adding real admins
// and referees from there.
//
// CHANGE THE PASSWORD BELOW (or change it inside the app afterwards)
// before you deploy this for real people to use.
// -----------------------------------------------------------------------

const bcrypt = require('bcryptjs');
const db = require('./database');

const USERNAME = 'admin';
const PASSWORD = 'admin123'; // <-- change this!

const existing = db.prepare('SELECT * FROM admins WHERE username = ?').get(USERNAME);

if (existing) {
  console.log(`An account called "${USERNAME}" already exists. Nothing to do.`);
} else {
  const hash = bcrypt.hashSync(PASSWORD, 10);
  db.prepare(
    'INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(USERNAME, hash, 'superadmin');

  console.log('Superadmin account created!');
  console.log('  username:', USERNAME);
  console.log('  password:', PASSWORD);
  console.log('Log in at /admin-login.html and change this password by creating');
  console.log('a new admin and removing this one, or editing it directly in the DB.');
}
