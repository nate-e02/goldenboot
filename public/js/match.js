// public/js/match.js
// -----------------------------------------------------------------------
// Powers match.html. Everyone sees the scoreboard and the event list
// (goals/assists/cards). If you're logged in as an admin or referee,
// an extra panel appears letting you set the schedule, start/finish the
// match, and log events live during the game.
// -----------------------------------------------------------------------

const matchId = new URLSearchParams(window.location.search).get('id');
let currentUser = null;
let currentMatch = null;

async function loadMatch() {
  const { match, events } = await api.get(`/api/matches/${matchId}`);
  currentMatch = match;
  renderPublicView(match, events);
  if (currentUser) renderEntryPanel(match, events);
}

function eventIcon(type) {
  return { goal: '⚽', assist: '🎯', yellow: '🟨', red: '🟥' }[type] || '';
}

function renderPublicView(match, events) {
  const when = match.match_date ? new Date(match.match_date).toLocaleString() : 'Date TBA';
  document.getElementById('match-content').innerHTML = `
    <p class="subtitle">${match.tournament_name} · ${match.tournament_gender === 'women' ? "Women's" : "Men's"}</p>
    <div class="scoreboard">
      <div class="team-name">${match.team1_name || 'TBD'}</div>
      <div class="score">${match.status === 'scheduled' ? '-' : match.team1_score}</div>
      <div class="vs">vs</div>
      <div class="score">${match.status === 'scheduled' ? '-' : match.team2_score}</div>
      <div class="team-name">${match.team2_name || 'TBD'}</div>
    </div>
    <p style="text-align:center;">
      <span class="status-pill ${match.status}">${match.status}</span>
      &nbsp; ${when} ${match.venue ? '· ' + match.venue : ''}
    </p>
    ${match.status === 'finished' ? `<p style="text-align:center;color:var(--gold);">Winner: ${match.winner_name}</p>` : ''}

    <h3>Match Events</h3>
    <ul class="event-list">
      ${
        events.length === 0
          ? '<li style="color:var(--muted);">No events logged yet.</li>'
          : events
              .map(
                (e) => `
        <li>
          <span class="event-tag ${e.event_type}">${eventIcon(e.event_type)} ${e.event_type}</span>
          <span>${e.player_name || 'Unknown player'} (${e.club_name})</span>
          ${e.minute ? `<span style="margin-left:auto;color:var(--muted);">${e.minute}'</span>` : ''}
        </li>`
              )
              .join('')
      }
    </ul>
  `;
}

async function renderEntryPanel(match, events) {
  // Only admins/referees get here. Admins additionally get the schedule form.
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
  const panel = document.getElementById('entry-panel');
  panel.style.display = 'block';

  let players1 = [];
  let players2 = [];
  if (match.team1_id) players1 = (await api.get(`/api/players?club_id=${match.team1_id}`)).players;
  if (match.team2_id) players2 = (await api.get(`/api/players?club_id=${match.team2_id}`)).players;

  const playerOptions = (players, clubId, clubName) =>
    players.map((p) => `<option value="${p.id}" data-club="${clubId}">${p.name} (${clubName})</option>`).join('');

  panel.innerHTML = `
    <h3>Match Control (${currentUser.role})</h3>

    ${
      isAdmin
        ? `
    <div class="card">
      <h4 style="margin-top:0;">Schedule</h4>
      <label>Date & time</label>
      <input type="datetime-local" id="match-date-input" value="${match.match_date ? toLocalInputValue(match.match_date) : ''}" />
      <label>Venue</label>
      <input type="text" id="venue-input" value="${match.venue || ''}" placeholder="e.g. Hawassa Stadium" />
      <button class="btn" style="margin-top:12px;" id="save-schedule-btn">Save Schedule</button>
    </div>`
        : ''
    }

    <div class="card">
      <h4 style="margin-top:0;">Match Status</h4>
      <p>Current: <span class="status-pill ${match.status}">${match.status}</span></p>
      ${match.status === 'scheduled' ? `<button class="btn" id="start-match-btn">Start Match (go live)</button>` : ''}
      ${match.status === 'live' ? `<button class="btn" id="finish-match-btn">Finish Match</button>` : ''}
      ${match.status === 'finished' ? `<p style="color:var(--muted);">This match is finished.</p>` : ''}
    </div>

    <div class="card">
      <h4 style="margin-top:0;">Log an Event</h4>
      ${
        !match.team1_id || !match.team2_id
          ? '<p style="color:var(--muted);">Both teams need to be set for this match first.</p>'
          : `
      <label>Event type</label>
      <select id="event-type-select">
        <option value="goal">⚽ Goal</option>
        <option value="assist">🎯 Assist</option>
        <option value="yellow">🟨 Yellow Card</option>
        <option value="red">🟥 Red Card</option>
      </select>
      <label>Player</label>
      <select id="event-player-select">
        <optgroup label="${match.team1_name}">${playerOptions(players1, match.team1_id, match.team1_name)}</optgroup>
        <optgroup label="${match.team2_name}">${playerOptions(players2, match.team2_id, match.team2_name)}</optgroup>
      </select>
      <label>Minute (optional)</label>
      <input type="number" id="event-minute-input" min="0" max="130" placeholder="e.g. 23" />
      <button class="btn" style="margin-top:12px;" id="add-event-btn">Add Event</button>
      `
      }
    </div>

    <div class="card">
      <h4 style="margin-top:0;">Remove a logged event</h4>
      <ul class="event-list" id="removable-events">
        ${events
          .map(
            (e) => `<li>
              <span class="event-tag ${e.event_type}">${eventIcon(e.event_type)} ${e.event_type}</span>
              <span>${e.player_name || '?'} (${e.club_name})</span>
              <button class="btn danger small" style="margin-left:auto;" data-remove-event="${e.id}">Remove</button>
            </li>`
          )
          .join('') || '<li style="color:var(--muted);">Nothing logged yet.</li>'}
      </ul>
    </div>

    <div id="entry-msg"></div>
  `;

  wireEntryPanelEvents();
}

function toLocalInputValue(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showMsg(text, type) {
  document.getElementById('entry-msg').innerHTML = `<div class="msg ${type}">${text}</div>`;
}

function wireEntryPanelEvents() {
  const scheduleBtn = document.getElementById('save-schedule-btn');
  if (scheduleBtn) {
    scheduleBtn.addEventListener('click', async () => {
      try {
        await api.put(`/api/matches/${matchId}/schedule`, {
          match_date: document.getElementById('match-date-input').value,
          venue: document.getElementById('venue-input').value,
        });
        showMsg('Schedule saved.', 'success');
        loadMatch();
      } catch (err) {
        showMsg(err.message, 'error');
      }
    });
  }

  const startBtn = document.getElementById('start-match-btn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      await api.put(`/api/matches/${matchId}/status`, { status: 'live' });
      loadMatch();
    });
  }

  const finishBtn = document.getElementById('finish-match-btn');
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      try {
        await api.put(`/api/matches/${matchId}/status`, { status: 'finished' });
        loadMatch();
      } catch (err) {
        // likely a tie - ask who won on penalties
        if (confirm(err.message + '\n\nClick OK to pick the winner now (e.g. penalty shoot-out).')) {
          const winner = prompt(`Type "1" for ${currentMatch.team1_name} or "2" for ${currentMatch.team2_name}`);
          const winner_id = winner === '1' ? currentMatch.team1_id : winner === '2' ? currentMatch.team2_id : null;
          if (winner_id) {
            await api.put(`/api/matches/${matchId}/status`, { status: 'finished', winner_id });
            loadMatch();
          }
        }
      }
    });
  }

  const addEventBtn = document.getElementById('add-event-btn');
  if (addEventBtn) {
    addEventBtn.addEventListener('click', async () => {
      const playerSelect = document.getElementById('event-player-select');
      const selectedOption = playerSelect.options[playerSelect.selectedIndex];
      if (!selectedOption) {
        showMsg('No players available - add players to both clubs first.', 'error');
        return;
      }
      try {
        await api.post(`/api/matches/${matchId}/events`, {
          club_id: Number(selectedOption.dataset.club),
          player_id: Number(playerSelect.value),
          event_type: document.getElementById('event-type-select').value,
          minute: Number(document.getElementById('event-minute-input').value) || null,
        });
        showMsg('Event added.', 'success');
        loadMatch();
      } catch (err) {
        showMsg(err.message, 'error');
      }
    });
  }

  document.querySelectorAll('[data-remove-event]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api.del(`/api/events/${btn.dataset.removeEvent}`);
      loadMatch();
    });
  });
}

async function init() {
  renderHeaderNav();
  currentUser = await getCurrentUser();
  loadMatch();
}

init();
