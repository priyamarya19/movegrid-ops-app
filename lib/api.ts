import { API_BASE_URL } from '@/constants/config';

export class ApiError extends Error {
  status: number;
  /** Machine-readable failure code from the backend, when present. */
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---- Global 401 (session expired) handling ----
// api.ts can't reach the React auth context directly, so the context registers
// its signOut here on mount. A 401 anywhere calls this exactly once per burst.

type UnauthorizedHandler = (code?: string) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  unauthorizedHandler = fn;
}

function handleUnauthorized(code?: string): void {
  // signOut itself is idempotent; the handler just forwards the signal.
  unauthorizedHandler?.(code);
}

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

const TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = opts;

  const headers: Record<string, string> = {
    'X-Client-Type': 'mobile',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  // Retry transient network failures only on idempotent GETs (never on writes).
  const maxAttempts = method === 'GET' ? 3 : 1;
  let res: Response | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetchWithTimeout(`${API_BASE_URL}${path}`, init);
      break;
    } catch {
      if (attempt === maxAttempts) {
        throw new ApiError(`Can't reach the server at ${API_BASE_URL}. Check the connection.`, 0);
      }
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }

  const text = await res!.text();
  const data = text ? safeJson(text) : null;

  if (!res!.ok) {
    const code = data && (data.code as string | undefined);
    const message = (data && (data.error as string)) || `Request failed (${res!.status})`;
    // 401 = authentication failure (token_expired | unauthorized) → force logout.
    // 403 = permission failure (forbidden) → surfaced as an error, never logs out.
    if (res!.status === 401) handleUnauthorized(code);
    throw new ApiError(message, res!.status, code);
  }
  return data as T;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---- Auth ----

export type LoginResponse = {
  success: boolean;
  role: string;
  name: string;
  token: string;
};

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export type SessionUser = {
  name: string;
  role: string;
  email: string;
};

export function getSession(token: string) {
  return apiFetch<SessionUser>('/api/auth/session', { token });
}

// ---- Payment modes (shared across rent, returns, penalties) ----

/** Canonical payment-mode vocabulary, mirroring the dashboard contract. */
export type PaymentMode = 'Cash' | 'Online' | 'Cash + Online';

/** Ordered list of payment modes for UI selectors. */
export const PAYMENT_MODES: readonly PaymentMode[] = ['Cash', 'Online', 'Cash + Online'];

// ---- Riders ----

export type Rider = {
  id: string;
  rider_code: string;
  name: string;
  mobile: string;
  status: string;
  hub_name: string | null;
  vehicle_number: string | null;
  rent_paid_this_week: boolean;
  has_active_assignment?: boolean;
  // The following are only present when queried with ?rent=overdue|due_soon.
  next_due_date?: string;
  last_due_date?: string;
  period_days?: number;
  /** Un-rounded single-week rent (daily_rent * 7). Prefer `amount_due` for what's actually owed. */
  period_amount?: number;
  /** Whole weeks owed, rounded up — rent is billed weekly (CEIL(days_behind / 7)). */
  overdue_weeks?: number;
  /** Whole-week-rounded amount owed. Use this instead of `period_amount` / `period_amount - partial_paid`. */
  amount_due?: number;
  /** Always null now — there's no more "partial week" concept, just whole weeks owed. */
  partial_paid?: number | null;
};

export function getRiders(token: string, params?: { rent?: 'overdue' | 'due_soon'; status?: string }) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<Rider[]>(`/api/riders${qs ? `?${qs}` : ''}`, { token });
}

// ---- Vehicles ----

export type Vehicle = {
  id: string;
  ev_number: string;
  status: string;
  model_name: string | null;
  oem: string | null;
  hub_name: string | null;
  assigned_rider: string | null;
};

export function getVehicles(token: string, params?: { status?: string }) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<Vehicle[]>(`/api/vehicles${qs ? `?${qs}` : ''}`, { token });
}

// ---- Rider detail ----

export type RiderDetail = {
  rider: {
    id: string;
    rider_code: string;
    name: string;
    mobile: string;
    status: string;
    hub_name: string | null;
    hub_city: string | null;
    current_address: string | null;
    rental_mode: string | null;
    business_type: string | null;
    onboarding_fee: number | string | null;
    security_deposit: number | string | null;
    aadhaar: string | null;
    pan: string | null;
    dl_number: string | null;
  };
  payments: { amount_collected: number | string; payment_date: string; ev_number: string | null }[];
  assignments: {
    assigned_date: string;
    assignment_status: string;
    ev_number: string;
    vehicle_id: string;
    vehicle_status: string;
    model_name: string | null;
    oem: string | null;
  }[];
  totalCollected: number;
};

export function getRider(token: string, id: string) {
  return apiFetch<RiderDetail>(`/api/riders/${id}`, { token });
}

// ---- Vehicle detail ----

export type VehicleDetail = {
  vehicle: {
    id: string;
    ev_number: string;
    status: string;
    price: number | string | null;
    purchase_date: string | null;
    model_name: string | null;
    oem: string | null;
    rental_per_day: number | string | null;
    hub_name: string | null;
    hub_city: string | null;
    investor_name: string | null;
    total_invested: number | string | null;
  };
  assignments: {
    assigned_date: string;
    returned_date: string | null;
    status: string;
    rider_name: string;
    rider_id: string;
    rider_mobile: string | null;
  }[];
  payouts: { amount: number | string; due_date: string; paid_date: string | null; status: string }[];
};

export function getVehicle(token: string, id: string) {
  return apiFetch<VehicleDetail>(`/api/vehicles/${id}`, { token });
}

// ---- Hubs ----

export type Hub = {
  id: string;
  hub_name: string;
  city: string | null;
  area?: string | null;
  vehicle_capacity?: number | null;
  active_riders?: number | string | null;
  assigned_vehicles?: number | string | null;
  available_vehicles?: number | string | null;
};

export function getHubs(token: string) {
  return apiFetch<Hub[]>('/api/hubs', { token });
}

// ---- Lookups (for allotment / return forms) ----

export type VehicleLookup = {
  id: string;
  ev_number: string;
  status: string;
  oem: string | null;
  model_name: string | null;
  hub_id: string | null;
  hub_name: string | null;
  chassis_number: string | null;
  motor_number: string | null;
  controller_number: string | null;
  battery_number: string | null;
};

export function lookupVehicle(token: string, evNumber: string) {
  return apiFetch<VehicleLookup>(`/api/vehicles/lookup?ev_number=${encodeURIComponent(evNumber)}`, { token });
}

export type RiderLookup = {
  id: string;
  name: string;
  nickname: string | null;
  mobile: string;
  status: string;
  rental_mode: string | null;
  onboarding_fee: number | string | null;
  security_deposit: number | string | null;
  hub_id: string | null;
  hub_name: string | null;
};

export function lookupRider(token: string, mobile: string) {
  return apiFetch<RiderLookup>(`/api/vehicles/lookup?mobile=${encodeURIComponent(mobile)}`, { token });
}

export type ActiveAssignment = {
  id: string;
  assigned_date: string;
  status: string;
  rider_name: string;
  rider_id: string;
  ev_number: string;
};

export function getActiveAssignment(token: string, vehicleId: string) {
  return apiFetch<ActiveAssignment>(`/api/vehicles/${vehicleId}/assignment`, { token });
}

// ---- Mutations ----

export type NewAllotment = {
  rider_id: string;
  vehicle_id: string;
  hub_id?: string | null;
  rental_mode?: string | null;
  onboarding_fee?: number | null;
  security_deposit?: number | null;
  amount_collected?: number | null;
  payment_screenshot_url?: string | null;
  undertaking_url?: string | null;
  allotment_pics?: string[] | null;
  assigned_date?: string | null;
};

export function createAllotment(token: string, body: NewAllotment) {
  return apiFetch<{ id: string }>('/api/allotments', { method: 'POST', body, token });
}

export type ReturnPayload = {
  returned_date?: string | null;
  rent_cleared?: boolean | null;
  /** Vehicle was non-functional and rider is being immediately reallotted a replacement. */
  is_issue_swap?: boolean;
  /** Days the vehicle was down; credited to the rider on the new assignment. 0 when is_issue_swap is false. */
  non_functional_days?: number;
  penalty_amount?: number | null;
  /** Free-text penalty note. If present (or penalty_amount), backend creates a rider_penalties row. */
  penalty_detail?: string | null;
  condition_on_return?: string[] | null;
  return_photos?: string[] | null;
  return_remarks?: string | null;
  /** Rent settlement proof — REQUIRED when rent_cleared === true. */
  rent_settlement_mode?: PaymentMode | null;
  rent_settlement_utr?: string | null;
  rent_settlement_proof_url?: string | null;
};

export function returnAllotment(token: string, assignmentId: string, body: ReturnPayload) {
  return apiFetch<{ ok: boolean }>(`/api/allotments/${assignmentId}/return`, { method: 'PATCH', body, token });
}

export type NewRider = {
  name: string;
  mobile: string;
  nickname?: string | null;
  current_address?: string | null;
  permanent_address?: string | null;
  address_map_link?: string | null;
  profile_photo_url?: string | null;
  aadhaar?: string | null;
  aadhaar_front_url?: string | null;
  aadhaar_back_url?: string | null;
  pan?: string | null;
  pan_image_url?: string | null;
  dl_number?: string | null;
  dl_front_url?: string | null;
  dl_back_url?: string | null;
  bank?: string | null;
  ifsc?: string | null;
  account_number?: string | null;
  bank_doc_url?: string | null;
  family_ref_name?: string | null;
  family_ref_mobile?: string | null;
  family_ref_aadhaar?: string | null;
  family_ref_aadhaar_url?: string | null;
  local_ref_name?: string | null;
  local_ref_mobile?: string | null;
};

export function createRider(token: string, body: NewRider) {
  return apiFetch<{ id: string; rider_code: string; name: string }>('/api/riders', {
    method: 'POST',
    body,
    token,
  });
}

// ---- Blacklist check ----

export function checkBlacklist(token: string, aadhaar: string) {
  return apiFetch<{ blacklisted: boolean; reason?: string }>(
    `/api/riders/blacklist-check?aadhaar=${encodeURIComponent(aadhaar)}`,
    { token }
  );
}

// ---- File upload (multipart → S3 key) ----

export type UploadAsset = { uri: string; name: string; type: string };

export async function uploadFile(token: string, asset: UploadAsset, folder: string): Promise<{ key: string }> {
  const form = new FormData();
  form.append('folder', folder);
  // React Native FormData file shape.
  form.append('file', { uri: asset.uri, name: asset.name, type: asset.type } as unknown as Blob);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        // NOTE: do not set Content-Type — RN adds the multipart boundary.
        'X-Client-Type': 'mobile',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
  } catch {
    throw new ApiError(`Can't reach the server at ${API_BASE_URL}. Check the connection.`, 0);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const code = data && (data.code as string | undefined);
    if (res.status === 401) handleUnauthorized(code);
    throw new ApiError((data && (data.error as string)) || `Upload failed (${res.status})`, res.status, code);
  }
  return data as { key: string };
}

// ---- Rent ledger (rent_dues based, rolling paid_through_date balance) ----

export type RentWeek = {
  week_no: number;
  period_start: string;
  period_end: string;
  due_date: string;
  amount: number;
  paid: number;
  status: 'Collected' | 'Partial' | 'Overdue' | 'Pending';
  ev_number: string | null;
  vehicle_id: string | null;
};

export type RiderRentCycle = {
  weeks: RentWeek[];
  /** Rolling balance date: the rider's rent is settled up to (and including) this date. */
  paid_through_date: string | null;
  /** Daily rent for the rider's active assignment; used for the "N days of rent" preview. */
  daily_rent: number | null;
};

export function getRiderRentCycle(token: string, riderId: string) {
  return apiFetch<RiderRentCycle>(`/api/riders/${riderId}/rent`, { token });
}

// Recording a payment of any amount converts it to (amount / daily_rate) days and
// extends the rider's rolling paid_through_date — there is no "which week is this
// for" concept anymore, so no period params are sent.
export type RecordRent = {
  amount: number;
  /** Backend rejects with 400 unless payment_mode AND payment_screenshot_url are present. */
  payment_mode: PaymentMode;
  payment_utr?: string | null;
  payment_screenshot_url: string;
};

export type RecordRentResponse = {
  ok: boolean;
  /** The rider's new rolling paid-through date after this payment. */
  paid_through_date: string;
  /** How many days of rent this payment covered (amount ÷ daily_rate, floored). */
  days_added: number;
};

export function recordRentReceived(token: string, riderId: string, body: RecordRent) {
  return apiFetch<RecordRentResponse>(`/api/riders/${riderId}/rent-received`, { method: 'POST', body, token });
}

// ---- Rider penalties ----

export type RiderPenalty = {
  id: string;
  amount: number | string | null;
  detail: string;
  status: 'pending' | 'paid' | 'waived';
  created_by: string | null;
  created_at: string;
  ev_number: string | null;
  payment_mode: string | null;
  payment_utr: string | null;
  payment_proof_url: string | null;
};

export function getRiderPenalties(token: string, riderId: string) {
  return apiFetch<{ penalties: RiderPenalty[] }>(`/api/riders/${riderId}/penalties`, { token });
}

export function addRiderPenalty(
  token: string,
  riderId: string,
  body: { detail: string; amount?: number | null }
) {
  return apiFetch<{ ok: boolean }>(`/api/riders/${riderId}/penalties`, { method: 'POST', body, token });
}

export type UpdateRiderPenalty = {
  penalty_id: string;
  action: 'pay' | 'waive';
  /** Required for action:'pay'. */
  payment_mode?: PaymentMode | null;
  payment_utr?: string | null;
  payment_proof_url?: string;
};

export function updateRiderPenalty(token: string, riderId: string, body: UpdateRiderPenalty) {
  return apiFetch<{ ok: boolean }>(`/api/riders/${riderId}/penalties`, { method: 'PATCH', body, token });
}

export type RentSummary = {
  expectedToDate: number;
  collected: number;
  /** Whole-week-rounded total overdue amount across all riders (CEIL'd on the backend). */
  overdue: number;
  /** Count of distinct riders currently overdue (was `overdueWeeks` — a summed week count — before the rounding fix; renamed on the backend since it's no longer a week total). */
  overdueRiders: number;
  pct: number;
};

export function getRentSummary(token: string) {
  return apiFetch<RentSummary>('/api/rent/summary', { token });
}

export type OverdueRider = {
  rider_id: string;
  rider_code: string;
  name: string;
  mobile: string;
  /** Whole weeks overdue, rounded up (rent is billed weekly — CEIL(days_behind / 7)). */
  overdue_weeks: number;
  /** Whole-week-rounded amount owed (overdue_weeks * daily_rent * 7). */
  overdue_amount: number | null;
};

export function getOverdueRiders(token: string) {
  return apiFetch<{ riders: OverdueRider[] }>('/api/rent/overdue', { token });
}

// ---- Vehicle status + create ----

/** Ops-settable maintenance statuses (mirrors dashboard OPS_STATUSES). */
export type VehicleOpsStatus = 'under_maintenance' | 'mechanically_ok' | 'ready_to_deploy';

export function setVehicleStatus(token: string, vehicleId: string, status: VehicleOpsStatus) {
  return apiFetch<{ success: boolean; status: string }>(`/api/vehicles/${vehicleId}`, {
    method: 'PATCH',
    body: { status },
    token,
  });
}

export type NewVehicle = {
  ev_number: string;
  chassis_number: string;
  oem: string;
  motor_number?: string | null;
  controller_number?: string | null;
  iot_imei?: string | null;
  iot_partner?: string | null;
  battery_number?: string | null;
  battery_partner?: string | null;
  hub_id?: string | null;
  purchase_date?: string | null;
  price?: number | null;
  vehicle_photo_url?: string | null;
  rc_book_url?: string | null;
};

export function createVehicle(token: string, body: NewVehicle) {
  return apiFetch<{ id: string; ev_number: string; status: string }>('/api/vehicles', {
    method: 'POST',
    body,
    token,
  });
}

// ---- Profile & account ----

export type Profile = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  photo_url: string | null;
  role: string;
};

export function getProfile(token: string) {
  return apiFetch<Profile>('/api/auth/profile', { token });
}

export function updateProfile(
  token: string,
  body: { name?: string; mobile?: string | null; photo_url?: string | null }
) {
  return apiFetch<{ success: boolean }>('/api/auth/profile', { method: 'PATCH', body, token });
}

export function changePassword(token: string, currentPassword: string, newPassword: string) {
  return apiFetch<{ success: boolean }>('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
    token,
  });
}

// ---- Rent waiver approvals ----
//
// Approving a non_functional_days credit (captured at return time on an
// issue-swap) is gated behind a per-user permission (can_approve_rent_waivers)
// that's independent of role, so there's no client-side role check — GET
// doubles as the "am I authorized" probe. A non-ok response (403 for
// unauthorized users) means: show nothing. See dashboard
// app/api/rent-waivers/route.ts + [id]/route.ts for the reference contract.

export type RentWaiverRequest = {
  id: string;
  rider_id: string;
  rider_name: string;
  rider_code: string;
  /** May be absent for very old/malformed rows; render as '—'. */
  ev_number: string | null;
  non_functional_days: number;
  requested_by: string | null;
  requested_at: string;
};

/** Always the pending queue — the endpoint doesn't support filtering by status. */
export function getRentWaivers(token: string) {
  return apiFetch<RentWaiverRequest[]>('/api/rent-waivers', { token });
}

export function actOnRentWaiver(token: string, id: string, action: 'approve' | 'reject') {
  return apiFetch<{ ok: boolean }>(`/api/rent-waivers/${id}`, { method: 'PATCH', body: { action }, token });
}

// ---- Leads ----

export type Lead = {
  id: string;
  type: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  fleet_size: number | string | null;
  amount: number | string | null;
  status: string;
  created_at: string;
};

export function getLeads(token: string) {
  return apiFetch<Lead[]>('/api/leads', { token });
}
