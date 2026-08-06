// public/js/bracket.js
// -----------------------------------------------------------------------
// Powers tournament.html. Reads ?gender=men or ?gender=women from the
// URL, loads that gender's tournament(s), and draws the bracket as a
// vertical triangle: widest round (Round of 16) at the top, narrowing
// down to a single match (the Final) at the bottom.
// -----------------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
let currentGender = params.get('gender') === 'women' ? 'women' : 'men';

function setActiveTab() {
  document.getElementById('tab-men').classList.toggle('active', currentGender === 'men');
  document.getElementById('tab-women').classList.toggle('active', currentGender === 'women');
  document.getElementById('page-title').textContent =
    currentGender === 'men' ? "Men's Tournament" : "Women's Tournament";
}

document.getElementById('tab-men').addEventListener('click', () => {
  currentGender = 'men';
  updateUrl();
  loadTournamentsForGender();
});
document.getElementById('tab-women').addEventListener('click', () => {
  currentGender = 'women';
  updateUrl();
  loadTournamentsForGender();
});

function updateUrl() {
  const url = new URL(window.location);
  url.searchParams.set('gender', currentGender);
  window.history.replaceState({}, '', url);
}

async function loadTournamentsForGender() {
  setActiveTab();
  const container = document.getElementById('bracket-container');
  const picker = document.getElementById('tournament-picker');
  container.innerHTML = '<p class="subtitle">Loading...</p>';

  const { tournaments } = await api.get(`/api/tournaments?gender=${currentGender}`);

  if (tournaments.length === 0) {
    picker.style.display = 'none';
    container.innerHTML = `<p class="subtitle">No ${currentGender}'s tournament has been set up yet. Check back soon!</p>`;
    return;
  }

  if (tournaments.length > 1) {
    picker.style.display = 'block';
    const select = document.getElementById('tournament-select');
    select.innerHTML = tournaments.map((t) => `<option value="${t.id}">${t.name} (${t.year})</option>`).join('');
    select.onchange = () => loadBracket(select.value);
    loadBracket(tournaments[0].id);
  } else {
    picker.style.display = 'none';
    loadBracket(tournaments[0].id);
  }
}

async function loadBracket(tournamentId) {
  const container = document.getElementById('bracket-container');
  container.innerHTML = '<p class="subtitle">Loading bracket...</p>';

  const { tournament, rounds } = await api.get(`/api/tournaments/${tournamentId}/bracket`);

  if (rounds.every((r) => r.matches.length === 0)) {
    container.innerHTML = `<p class="subtitle">The bracket for "${tournament.name}" hasn't been generated yet.</p>`;
    return;
  }

  const html = `
    <h2 style="text-align:center;color:var(--muted);font-weight:400;">${tournament.name} - ${tournament.year}</h2>
    <div class="bracket">
      ${rounds.map((round) => renderRound(round)).join('')}
    </div>
  `;
  container.innerHTML = html;
}

function renderRound(round) {
  const isFinal = round.name === 'Final';
  return `
    <div class="bracket-round" data-round-tag="${isFinal ? 'final' : ''}">
      <h4>${round.name}</h4>
      <div class="match-row">
        ${round.matches.map((m) => renderMatchCard(m)).join('')}
      </div>
    </div>
  `;
}

function renderMatchCard(m) {
  const team1 = m.team1_name || 'TBD';
  const team2 = m.team2_name || 'TBD';
  const t1Winner = m.winner_id && m.winner_id === m.team1_id;
  const t2Winner = m.winner_id && m.winner_id === m.team2_id;

  const when = m.match_date ? formatDate(m.match_date) : 'Date TBA';

  return `
    <a class="match-card" href="/match.html?id=${m.id}">
      <div class="team ${t1Winner ? 'winner' : ''}"><span>${team1}</span><span>${m.status === 'scheduled' ? '' : m.team1_score}</span></div>
      <div class="team ${t2Winner ? 'winner' : ''}"><span>${team2}</span><span>${m.status === 'scheduled' ? '' : m.team2_score}</span></div>
      <div class="meta">
        <span>${when}${m.venue ? ' · ' + m.venue : ''}</span>
        <span class="status-pill ${m.status}">${m.status}</span>
      </div>
    </a>
  `;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

renderHeaderNav();
setActiveTab();
loadTournamentsForGender();
