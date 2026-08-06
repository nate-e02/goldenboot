// public/js/leaderboard.js
// -----------------------------------------------------------------------
// Shared by scorers.html and assists.html - same layout, different API
// endpoint. Which endpoint/label to use is read from the <script> tag's
// data-endpoint / data-label attributes so we only need one file.
// -----------------------------------------------------------------------

const thisScript = document.currentScript;
const endpoint = thisScript.dataset.endpoint;
const columnLabel = thisScript.dataset.label;

let gender = 'men';

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    gender = btn.dataset.gender;
    load();
  });
});

async function load() {
  const body = document.getElementById('leaderboard-body');
  body.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

  const { leaderboard } = await api.get(`${endpoint}?gender=${gender}`);

  if (leaderboard.length === 0) {
    body.innerHTML = `<tr><td colspan="4" style="color:var(--muted);">No ${columnLabel.toLowerCase()} logged yet.</td></tr>`;
    return;
  }

  body.innerHTML = leaderboard
    .map(
      (row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${row.player_name}</td>
      <td>${row.club_name}</td>
      <td><strong>${row.total}</strong></td>
    </tr>`
    )
    .join('');
}

renderHeaderNav();
load();
