// middleware/auth.js
// -----------------------------------------------------------------------
// Small helpers used by routes to check "is someone logged in?" and
// "does this logged-in person have the right role?"
//
// Roles, from most to least powerful:
//   superadmin -> can do everything, including adding/removing other admins
//   admin      -> can manage tournaments, clubs, players, schedule, scores
//   referee    -> can only enter live scores / goals / cards for matches
// -----------------------------------------------------------------------

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'You must be logged in.' });
  }
  next();
}

// Usage: requireRole('superadmin') or requireRole('superadmin', 'admin')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'You must be logged in.' });
    }
    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
