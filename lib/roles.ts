/** Roles that can perform ops data entry (the app's audience). */
const OPS_ROLES = ['admin', 'ops_manager', 'hub_incharge'];

export function canManageOps(role: string | undefined | null): boolean {
  return !!role && OPS_ROLES.includes(role);
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  ops_manager: 'Ops Manager',
  hub_incharge: 'Hub Incharge',
  investor: 'Investor',
};

export function roleLabel(role: string | undefined | null): string {
  return (role && ROLE_LABEL[role]) || role || '—';
}
