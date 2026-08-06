// public/js/referee.js
// -----------------------------------------------------------------------
// Powers referee.html: a simple flat list of every match (for the
// selected gender) so a referee can quickly jump into the one they're
// officiating and log events. The actual score/event entry controls
// live on match.html (see js/match.js) - this page is just a finder.
// -----------------------------------------------------------------------

let gender = 'men';

async function init() {
  renderHeaderNav();
  const user = await getCurrentUser();
  const gate = document.getElementById('gate');

  if (!user) {
    gate.innerHTML = `<p class="msg error">You need to <a href="/admin-login.html">log in</a> to see this page.</p>`;
    return;
  }

  document.getElementById('ref-tabs').style.display = 'flex';
  document.querySelectorAll('#ref-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ref-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      gender = btn.dataset.gender;
      loadMatches();
    });
  });

  loadMatches();
}

async function loadMatches() {
  const content = document.getElementById('ref-content');
  content.innerHTML = 'Loading...';

  const { tournaments } = await api.get(`/api/tournaments?gender=${gender}`);
  if (tournaments.length === 0) {
    content.innerHTML = `<p class="subtitle">No ${gender}'s tournament yet.</p>`;
    return;
  }

  let allMatches = [];
  for (const t of tournaments) {
    const { rounds } = await api.get(`/api/tournaments/${t.id}/bracket`);
    rounds.forEach((r) => {
      r.matches.forEach((m) => allMatches.push({ ...m, roundName: r.name, tournamentName: t.name }));
    });
  }
  allMatches = allMatches.filter((m) => m.team1_id && m.team2_id); // only real, playable matches

  if (allMatches.length === 0) {
    content.innerHTML = `<p class="subtitle">No matches with both teams set yet.</p>`;
    return;
  }

  // Live matches first, then scheduled, then finished
  const order = { live: 0, scheduled: 1, finished: 2 };
  allMatches.sort((a, b) => order[a.status] - order[b.status]);

  content.innerHTML = `
    <div class="card">
      <table>
        <thead><tr><th>Tournament</th><th>Round</th><th>Match</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${allMatches
            .map(
              (m) => `<tr>
                <td>${m.tournamentName}</td>
                <td>${m.roundName}</td>
                <td>${m.team1_name} vs ${m.team2_name}</td>
                <td><span class="status-pill ${m.status}">${m.status}</span></td>
                <td><a href="/match.html?id=${m.id}" class="btn small">Open</a></td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

init();
