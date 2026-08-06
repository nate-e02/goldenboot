# GOLDENBOOT TOURNAMENT HAWASSA

A simple website for running a grassroots knockout football tournament:
brackets, live scoring, goal/assist leaderboards, and an admin system with
roles (superadmin / admin / referee).

Built with plain **Node.js + Express + SQLite** on the backend and plain
**HTML/CSS/JavaScript** on the frontend — no build step, no frameworks to
learn. Every file is small and commented so you can find the bit you want
to change.

---

## 1. Running it

You need [Node.js](https://nodejs.org) installed (v18 or newer).

```bash
cd goldenboot-tournament
npm install        # installs Express, SQLite, sessions, password hashing
npm run seed        # creates your first login (see below)
npm start            # starts the site at http://localhost:3000
```

Open **http://localhost:3000** in a browser.

### Your first login
`npm run seed` creates one **superadmin** account:
- username: `admin`
- password: `admin123`

Log in at `/admin-login.html`, then immediately go to the **Admins &
Referees** tab and create yourself a proper account, then delete/replace
the default one. (Passwords are stored securely hashed — never in plain
text — but `admin123` is public in this README, so don't leave it active!)

---

## 2. How the site is organized

```
goldenboot-tournament/
├── server.js              <- starts the web server, wires up all routes
├── db/
│   ├── database.js        <- creates the SQLite database & tables
│   ├── seed.js             <- creates your first superadmin account
│   └── goldenboot.db        <- the actual database file (created on first run)
├── middleware/
│   └── auth.js              <- "is this person logged in / allowed to do this?"
├── routes/                  <- the backend API, one file per topic
│   ├── auth.js               <- login / logout / who am I
│   ├── admins.js             <- managing admin & referee accounts
│   ├── tournaments.js        <- creating tournaments + generating brackets
│   ├── clubs.js               <- adding/removing clubs
│   ├── players.js             <- adding/removing players
│   ├── matches.js             <- scheduling, starting/finishing matches
│   ├── events.js              <- logging goals/assists/cards
│   └── stats.js                <- top scorer / top assist leaderboards
└── public/                   <- everything the browser loads
    ├── index.html              <- home page (the 4 options)
    ├── tournament.html + js/bracket.js     <- the triangle bracket view
    ├── match.html + js/match.js             <- one match: score, events, live entry
    ├── scorers.html / assists.html + js/leaderboard.js  <- leaderboards
    ├── admin-login.html                      <- login form
    ├── admin.html + js/admin.js               <- admin dashboard
    ├── referee.html + js/referee.js            <- referee's match list
    ├── js/api.js                                <- shared helper for talking to the backend
    └── css/style.css                             <- all styling, in labeled sections
```

**The database is one file:** `db/goldenboot.db`. Back up your tournament
by copying that file. Delete it (and run `npm run seed` again) to start
completely fresh.

---

## 3. How a tournament actually gets run (the workflow)

1. **Log in** as admin at `/admin-login.html`.
2. **Tournaments tab** → create "Men's Tournament" or "Women's Tournament"
   (pick 16, 8, 4 or 2 teams).
3. **Clubs tab** → add every club playing in that tournament.
4. **Players tab** → add each club's squad (name + jersey number).
5. **Bracket & Schedule tab** → tick the clubs in the order you want them
   seeded (1v2, 3v4, 5v6...) and click **Generate Bracket**. This creates
   every match, all the way up to the Final, automatically.
6. Still on that tab, click **Open** on any match to set its **date &
   venue** — this is what shows on the public bracket page.
7. On matchday, an **admin or referee** opens the match page and clicks
   **Start Match** to go live.
8. During the game, log **goals, assists, yellow cards, red cards** as
   they happen, picking the player from a dropdown. The scoreboard updates
   itself from the goals you log — you never type the score by hand.
9. At the end, click **Finish Match**. The winner is worked out
   automatically from the score and **advances into the next round** of
   the bracket for you. (If it's tied — e.g. decided on penalties — you'll
   be asked to pick the winner manually.)
10. Repeat until the Final is finished. The **Top Goal Scorer** and **Top
    Assist** pages update live from everything logged, for both Men's and
    Women's.

**Referees** use the same match page, but reach it via `/referee.html`
which just lists every match so they can find theirs quickly. Referees can
log events and change match status, but can't create tournaments, clubs,
or accounts — only admins and the superadmin can do that.

---

## 4. Roles, explained

| Role | Can do |
|---|---|
| **superadmin** | Everything, including adding/removing admin & referee accounts |
| **admin** | Create tournaments, clubs, players; generate brackets; set schedules; enter live scores |
| **referee** | Only start/finish matches and log goals/assists/cards |
| *(not logged in)* | View everything publicly — brackets, results, leaderboards — but can't edit anything |

---

## 5. Things you'll probably want to customize

- **Colors / branding** — all in `public/css/style.css`, section 1 at the
  top (`:root { --gold: ...; --green: ...; }`).
- **The 4 home page options** — `public/index.html`, the `.option-grid` block.
- **Bracket size options** — currently 2/4/8/16 in `admin.html`'s
  Tournaments tab (`<select id="t-size">`) and validated in
  `routes/tournaments.js`.
- **Match event types** — currently goal/assist/yellow/red. To add more
  (e.g. "own goal", "substitution"), update the `CHECK(event_type IN (...))`
  in `db/database.js`, the dropdown in `public/js/match.js`, and (if it
  should count as a goal) the scoring logic in `routes/matches.js`.
- **Session secret** — change the string in `server.js`
  (`session({ secret: '...' })`) before putting this on the internet for
  real.

---

## 6. Deploying it for real

This app needs to run somewhere that can execute Node.js continuously
(it's not a static site) — for example Render, Railway, Fly.io, a small
VPS, or any host that supports Node + a persistent disk (for the SQLite
file). Set the `PORT` environment variable if your host requires it;
otherwise it defaults to 3000.
