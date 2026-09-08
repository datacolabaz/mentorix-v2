/**
 * Email+parol uğurlu olanda sessiya rolunu seç: istənilən uyğun hint, yoxsa
 * hesabın öz rollarından birincisi (müəllim və iştirakçı eyni qaydada).
 */
function pickEmailLoginRole(requestedRole, eligibleRoles) {
  const eligible = Array.isArray(eligibleRoles) ? eligibleRoles.filter(Boolean) : [];
  const requested = String(requestedRole || '').trim().toLowerCase();
  if (requested && eligible.includes(requested)) return requested;
  return eligible[0] || null;
}

module.exports = { pickEmailLoginRole };
