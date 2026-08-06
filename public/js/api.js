// public/js/api.js
// -----------------------------------------------------------------------
// Tiny wrapper around fetch() so every page can call the backend the
// same way, without repeating boilerplate. All the real page logic
// lives in the other js files (main.js, bracket.js, admin.js, etc).
// -----------------------------------------------------------------------

const api = {
  async get(url) {
    const res = await fetch(url);
    return handle(res);
  },
  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return handle(res);
  },
  async put(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return handle(res);
  },
  async del(url) {
    const res = await fetch(url, { method: 'DELETE' });
    return handle(res);
  },
};

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }
  return data;
}

// Used by lots of pages to know if the visitor is logged in, and as who.
// Returns { id, username, role } or null.
async function getCurrentUser() {
  const { user } = await api.get('/api/auth/me');
  return user;
}

// Fills the little header nav depending on login state - shared across pages.
async function renderHeaderNav() {
  const nav = document.getElementById('header-nav');
  if (!nav) return;
  const user = await getCurrentUser();
  if (user) {
    nav.innerHTML = `
      <a href="/admin.html">Admin Dashboard</a>
      <a href="/referee.html">Referee</a>
      <span style="margin-left:16px;color:var(--muted)">${user.username} (${user.role})</span>
      <a href="#" id="logout-link">Logout</a>
    `;
    document.getElementById('logout-link').addEventListener('click', async (e) => {
      e.preventDefault();
      await api.post('/api/auth/logout');
      window.location.href = '/';
    });
  } else {
    nav.innerHTML = `<a href="/admin-login.html">Admin / Referee Login</a>`;
  }
}
