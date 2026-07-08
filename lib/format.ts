import type { PillTone } from '@/components/ui/StatusPill';

function titleCase(s: string): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

export function riderStatusPill(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'accent' };
    case 'pending':
      return { label: 'Pending', tone: 'warning' };
    case 'blacklisted':
      return { label: 'Blacklisted', tone: 'danger' };
    default:
      return { label: titleCase(status), tone: 'neutral' };
  }
}

export function rentStatusPill(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'Collected':
      return { label: 'Collected', tone: 'accent' };
    case 'Partial':
      return { label: 'Partial', tone: 'warning' };
    case 'Overdue':
      return { label: 'Overdue', tone: 'danger' };
    default:
      return { label: 'Pending', tone: 'neutral' };
  }
}

export function penaltyStatusPill(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', tone: 'accent' };
    case 'waived':
      return { label: 'Waived', tone: 'neutral' };
    default:
      return { label: 'Pending', tone: 'danger' };
  }
}

export function formatINR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Mirrors the dashboard's lib/vehicleStatus.ts. The DB stores the precise
// workflow vocabulary; we map each value to a label + pill tone.
export function vehicleStatusPill(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'assigned':
      return { label: 'Assigned', tone: 'accent' };
    case 'ready_to_deploy':
    case 'available':
      return { label: 'Available', tone: 'neutral' };
    case 'mechanically_ok':
      return { label: 'Mechanically OK', tone: 'neutral' };
    case 'under_maintenance':
    case 'maintenance':
      return { label: 'Under Maintenance', tone: 'warning' };
    case 'returned':
      return { label: 'Returned', tone: 'warning' };
    case 'retired':
      return { label: 'Retired', tone: 'danger' };
    case 'blocked':
      return { label: 'Blocked', tone: 'danger' };
    default:
      return { label: titleCase(status), tone: 'neutral' };
  }
}
