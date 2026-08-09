// public/js/admin.js
// -----------------------------------------------------------------------
// Powers admin.html. Split into one render function per tab:
//   renderTournamentsTab, renderClubsTab, renderPlayersTab,
//   renderBracketTab, renderAdminsTab
// Each one draws its own HTML into #admin-panel and wires up its own
// buttons/forms. Look for the tab you want to change and edit that
// function - they don't depend on each other.
// -----------------------------------------------------------------------

let user = null;
let currentTab = 'tournaments';

async function init() {
  renderHeaderNav();
  user = await getCurrentUser();
  const gate = document.getElementById('gate');

  if (!user) {
    gate.innerHTML = `<p class="msg error">You need to <a href="/admin-login.html">log in</a> to see this page.</p>`;
    return;
  }
  if (user.role === 'referee') {
    gate.innerHTML = `<p class="msg error">Referee accounts don't use this dashboard - go to the <a href="/referee.html">Referee page</a> instead.</p>`;
    return;
  }

  document.getElementById('admin-area').style.display = 'flex';
  if (user.role === 'superadmin') {
    document.getElementById('admins-tab-btn').style.display = 'block';
  }

  document.querySelectorAll('#admin-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#admin-tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      renderCurrentTab();
    });
  });

  renderCurrentTab();
}

function renderCurrentTab() {
  const panel = document.getElementById('admin-panel');
  panel.innerHTML = 'Loading...';
  const renderers = {
    tournaments: renderTournamentsTab,
    clubs: renderClubsTab,
    players: renderPlayersTab,
    bracket: renderBracketTab,
    admins: renderAdminsTab,
  };
  renderers[currentTab]();
}

function msgBox(text, type) {
  return `<div class="msg ${type}">${text}</div>`;
}

/* ============================== TOURNAMENTS ============================== */

async function renderTournamentsTab() {
  const panel = document.getElementById('admin-panel');
  const { tournaments } = await api.get('/api/tournaments');

  panel.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Create Tournament</h3>
      <label>Name</label>
      <input type="text" id="t-name" placeholder="e.g. Goldenboot Men's Cup" />
      <label>Gender</label>
      <select id="t-gender">
        <option value="men">Men</option>
        <option value="women">Women</option>
      </select>
      <label>Year</label>
      <input type="number" id="t-year" value="${new Date().getFullYear()}" />
      <label>Number of teams</label>
      <select id="t-size">
        <option value="16" selected>16</option>
        <option value="8">8</option>
        <option value="4">4</option>
        <option value="2">2</option>
      </select>
      <button class="btn" id="create-tournament-btn" style="margin-top:14px;">Create Tournament</button>
      <div id="t-msg"></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Existing Tournaments</h3>
      <table>
        <thead><tr><th>Name</th><th>Gender</th><th>Year</th><th>Size</th></tr></thead>
        <tbody>
          ${tournaments.length
      ? tournaments.map((t) => `<tr><td>${t.name}</td><td>${t.gender}</td><td>${t.year}</td><td>${t.size} teams</td></tr>`).join('')
      : '<tr><td colspan="4" style="color:var(--muted);">None yet.</td></tr>'
    }
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('create-tournament-btn').addEventListener('click', async () => {
    const msg = document.getElementById('t-msg');
    try {
      await api.post('/api/tournaments', {
        name: document.getElementById('t-name').value,
        gender: document.getElementById('t-gender').value,
        year: Number(document.getElementById('t-year').value),
        size: Number(document.getElementById('t-size').value),
      });
      msg.innerHTML = msgBox('Tournament created.', 'success');
      renderTournamentsTab();
    } catch (err) {
      msg.innerHTML = msgBox(err.message, 'error');
    }
  });
}

/* ================================= CLUBS ================================= */

async function tournamentSelectOptions() {
  const { tournaments } = await api.get('/api/tournaments');
  return tournaments
    .map((t) => `<option value="${t.id}">${t.name} (${t.gender}, ${t.year})</option>`)
    .join('');
}

async function renderClubsTab() {
  const panel = document.getElementById('admin-panel');
  const options = await tournamentSelectOptions();

  panel.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Add Club</h3>
      <label>Tournament</label>
      <select id="c-tournament">${options || '<option value="">Create a tournament first</option>'}</select>
      <label>Club name</label>
      <input type="text" id="c-name" placeholder="e.g. Hawassa United" />
      <label>Logo URL (optional)</label>
      <input type="text" id="c-logo" placeholder="https://..." />
      <button class="btn" id="add-club-btn" style="margin-top:14px;">Add Club</button>
      <div id="c-msg"></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Clubs in Selected Tournament</h3>
      <div id="club-list">Select a tournament above.</div>
    </div>
  `;

  const tSelect = document.getElementById('c-tournament');
  const loadClubList = async () => {
    const list = document.getElementById('club-list');
    if (!tSelect.value) { list.innerHTML = 'No tournament selected.'; return; }
    const { clubs } = await api.get(`/api/clubs?tournament_id=${tSelect.value}`);
    list.innerHTML = clubs.length
      ? `<table><thead><tr><th>Name</th><th></th></tr></thead><tbody>
          ${clubs.map((c) => `<tr><td>${c.name}</td><td><button class="btn danger small" data-del-club="${c.id}">Remove</button></td></tr>`).join('')}
        </tbody></table>`
      : '<p style="color:var(--muted);">No clubs yet.</p>';

    list.querySelectorAll('[data-del-club]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api.del(`/api/clubs/${btn.dataset.delClub}`);
        loadClubList();
      });
    });
  };
  tSelect.addEventListener('change', loadClubList);
  if (tSelect.value) loadClubList();

  document.getElementById('add-club-btn').addEventListener('click', async () => {
    const msg = document.getElementById('c-msg');
    try {
      await api.post('/api/clubs', {
        tournament_id: Number(tSelect.value),
        name: document.getElementById('c-name').value,
        logo_url: document.getElementById('c-logo').value,
      });
      msg.innerHTML = msgBox('Club added.', 'success');
      document.getElementById('c-name').value = '';
      loadClubList();
    } catch (err) {
      msg.innerHTML = msgBox(err.message, 'error');
    }
  });
}

/* ================================ PLAYERS ================================ */

async function renderPlayersTab() {
  const panel = document.getElementById('admin-panel');
  const options = await tournamentSelectOptions();

  panel.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Add Player</h3>
      <label>Tournament</label>
      <select id="p-tournament">${options || '<option value="">Create a tournament first</option>'}</select>
      <label>Club</label>
      <select id="p-club"></select>
      <label>Player name</label>
      <input type="text" id="p-name" placeholder="e.g. Abebe Kebede" />
      <label>Jersey number (optional)</label>
      <input type="number" id="p-jersey" min="1" max="99" />
      <button class="btn" id="add-player-btn" style="margin-top:14px;">Add Player</button>
      <div id="p-msg"></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Players in Selected Club</h3>
      <div id="player-list">Select a club above.</div>
    </div>
  `;

  const tSelect = document.getElementById('p-tournament');
  const cSelect = document.getElementById('p-club');

  const loadClubOptions = async () => {
    if (!tSelect.value) { cSelect.innerHTML = ''; return; }
    const { clubs } = await api.get(`/api/clubs?tournament_id=${tSelect.value}`);
    cSelect.innerHTML = clubs.length
      ? clubs.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')
      : '<option value="">Add clubs to this tournament first</option>';
    loadPlayerList();
  };

  const loadPlayerList = async () => {
    const list = document.getElementById('player-list');
    if (!cSelect.value) { list.innerHTML = 'No club selected.'; return; }
    const { players } = await api.get(`/api/players?club_id=${cSelect.value}`);
    list.innerHTML = players.length
      ? `<table><thead><tr><th>#</th><th>Name</th><th></th></tr></thead><tbody>
          ${players.map((p) => `<tr><td>${p.jersey_number || '-'}</td><td>${p.name}</td><td><button class="btn danger small" data-del-player="${p.id}">Remove</button></td></tr>`).join('')}
        </tbody></table>`
      : '<p style="color:var(--muted);">No players yet.</p>';

    list.querySelectorAll('[data-del-player]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api.del(`/api/players/${btn.dataset.delPlayer}`);
        loadPlayerList();
      });
    });
  };

  tSelect.addEventListener('change', loadClubOptions);
  cSelect.addEventListener('change', loadPlayerList);
  if (tSelect.value) loadClubOptions();

  document.getElementById('add-player-btn').addEventListener('click', async () => {
    const msg = document.getElementById('p-msg');
    try {
      await api.post('/api/players', {
        club_id: Number(cSelect.value),
        name: document.getElementById('p-name').value,
        jersey_number: Number(document.getElementById('p-jersey').value) || null,
      });
      msg.innerHTML = msgBox('Player added.', 'success');
      document.getElementById('p-name').value = '';
      loadPlayerList();
    } catch (err) {
      msg.innerHTML = msgBox(err.message, 'error');
    }
  });
}

/* ============================ BRACKET & SCHEDULE ============================ */

async function renderBracketTab() {
  const panel = document.getElementById('admin-panel');
  const options = await tournamentSelectOptions();

  panel.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Generate Bracket</h3>
      <p style="color:var(--muted);font-size:0.85rem;">
        Pick a tournament, then tick the clubs in the order you want them seeded
        (1 plays 2, 3 plays 4, and so on). You need exactly as many clubs
        ticked as the tournament size.
      </p>
      <label>Tournament</label>
      <select id="b-tournament">${options || '<option value="">Create a tournament first</option>'}</select>
      <div id="b-club-checkboxes" style="margin-top:10px;"></div>
      <button class="btn" id="generate-bracket-btn" style="margin-top:14px;">Generate Bracket</button>
      <div id="b-msg"></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Matches - set date, venue & view</h3>
      <div id="match-list">Select a tournament above.</div>
    </div>
  `;

  const tSelect = document.getElementById('b-tournament');

  const loadClubCheckboxes = async () => {
    const box = document.getElementById('b-club-checkboxes');
    if (!tSelect.value) { box.innerHTML = ''; return; }
    const { clubs } = await api.get(`/api/clubs?tournament_id=${tSelect.value}`);
    box.innerHTML = clubs.length
      ? clubs
        .map(
          (c, i) => `<label style="display:flex;align-items:center;gap:8px;margin:4px 0;">
              <input type="checkbox" value="${c.id}" class="bracket-club-checkbox" /> ${c.name}
            </label>`
        )
        .join('')
      : '<p style="color:var(--muted);">Add clubs to this tournament first.</p>';
  };

  const loadMatchList = async () => {
    const list = document.getElementById('match-list');
    if (!tSelect.value) { list.innerHTML = 'No tournament selected.'; return; }
    const { rounds } = await api.get(`/api/tournaments/${tSelect.value}/bracket`);
    const allMatches = rounds.flatMap((r) => r.matches.map((m) => ({ ...m, roundName: r.name })));

    let clubs = [];
    if (user.role === 'superadmin') {
      const clubsRes = await api.get(`/api/clubs?tournament_id=${tSelect.value}`);
      clubs = clubsRes.clubs;
    }
    const clubOptions = (selectedId) =>
      `<option value="">TBD</option>` +
      clubs.map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`).join('');

    list.innerHTML = allMatches.length
      ? `<table><thead><tr><th>Round</th><th>Match</th><th>Status</th><th></th></tr></thead><tbody>
          ${allMatches
        .map(
          (m) => `<tr>
                <td>${m.roundName}</td>
                <td>
                  ${user.role === 'superadmin'
              ? `<select class="edit-team1" data-match="${m.id}">${clubOptions(m.team1_id)}</select>
                         vs
                         <select class="edit-team2" data-match="${m.id}">${clubOptions(m.team2_id)}</select>
                         <button class="btn small" data-save-teams="${m.id}">Save</button>`
              : `${m.team1_name || 'TBD'} vs ${m.team2_name || 'TBD'}`
            }
                </td>
                <td><span class="status-pill ${m.status}">${m.status}</span></td>
                <td><a href="/match.html?id=${m.id}" class="btn small secondary">Open</a></td>
              </tr>`
        )
        .join('')}
        </tbody></table>`
      : '<p style="color:var(--muted);">No bracket generated yet.</p>';

    if (user.role === 'superadmin') {
      list.querySelectorAll('[data-save-teams]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const matchId = btn.dataset.saveTeams;
          const t1 = list.querySelector(`.edit-team1[data-match="${matchId}"]`).value;
          const t2 = list.querySelector(`.edit-team2[data-match="${matchId}"]`).value;
          try {
            await api.put(`/api/matches/${matchId}/teams`, {
              team1_id: t1 ? Number(t1) : null,
              team2_id: t2 ? Number(t2) : null,
            });
            loadMatchList();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    }
  };
  tSelect.addEventListener('change', () => {
    loadClubCheckboxes();
    loadMatchList();
  });
  if (tSelect.value) {
    loadClubCheckboxes();
    loadMatchList();
  }

  document.getElementById('generate-bracket-btn').addEventListener('click', async () => {
    const msg = document.getElementById('b-msg');
    const checked = Array.from(document.querySelectorAll('.bracket-club-checkbox:checked')).map((cb) => Number(cb.value));
    try {
      await api.post(`/api/tournaments/${tSelect.value}/generate-bracket`, { clubIds: checked });
      msg.innerHTML = msgBox('Bracket generated! You can now open each match to set its date/venue.', 'success');
      loadMatchList();
    } catch (err) {
      msg.innerHTML = msgBox(err.message, 'error');
    }
  });
}

/* ============================== ADMINS / REFEREES ============================== */

async function renderAdminsTab() {
  if (user.role !== 'superadmin') {
    document.getElementById('admin-panel').innerHTML = msgBox('Only the superadmin can manage accounts.', 'error');
    return;
  }
  const panel = document.getElementById('admin-panel');
  const { admins } = await api.get('/api/admins');

  panel.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Add Admin or Referee</h3>
      <label>Username</label>
      <input type="text" id="a-username" />
      <label>Password</label>
      <input type="password" id="a-password" />
      <label>Role</label>
      <select id="a-role">
        <option value="referee">Referee (can only enter live scores/events)</option>
        <option value="admin">Admin (manages tournaments, clubs, players, schedule)</option>
        <option value="superadmin">Superadmin (full access, incl. managing accounts)</option>
      </select>
      <button class="btn" id="add-admin-btn" style="margin-top:14px;">Create Account</button>
      <div id="a-msg"></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Existing Accounts</h3>
      <table>
        <thead><tr><th>Username</th><th>Role</th><th></th></tr></thead>
        <tbody>
          ${admins
      .map(
        (a) => `<tr>
                <td>${a.username}</td>
                <td>${a.role}</td>
                <td>${a.id === user.id ? '<span style="color:var(--muted);">(you)</span>' : `<button class="btn danger small" data-del-admin="${a.id}">Remove</button>`}</td>
              </tr>`
      )
      .join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('add-admin-btn').addEventListener('click', async () => {
    const msg = document.getElementById('a-msg');
    try {
      await api.post('/api/admins', {
        username: document.getElementById('a-username').value,
        password: document.getElementById('a-password').value,
        role: document.getElementById('a-role').value,
      });
      msg.innerHTML = msgBox('Account created.', 'success');
      renderAdminsTab();
    } catch (err) {
      msg.innerHTML = msgBox(err.message, 'error');
    }
  });

  panel.querySelectorAll('[data-del-admin]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api.del(`/api/admins/${btn.dataset.delAdmin}`);
      renderAdminsTab();
    });
  });
}

init();
