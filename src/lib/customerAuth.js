const CUSTOMER_KEY = 'winwin_customer';
const SESSION_KEY = 'winwin_session';
const ADMIN_KEY = 'winwin_admin';
const ADMIN_SESSION_KEY = 'winwin_admin_session';

export function getCustomer() {
  const data = localStorage.getItem(CUSTOMER_KEY);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (!localStorage.getItem(SESSION_KEY)) {
      localStorage.removeItem(CUSTOMER_KEY);
      return null;
    }
    if (parsed?.password) delete parsed.password;
    return parsed;
  } catch {
    return null;
  }
}

export function setCustomer(customer) {
  if (!customer) {
    clearCustomer();
    return;
  }
  const copy = { ...customer };
  delete copy.password;
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(copy));
}

export function clearCustomer() {
  localStorage.removeItem(CUSTOMER_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function getSessionToken() {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token) {
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

export function isAdmin() {
  return localStorage.getItem(ADMIN_KEY) === 'true' && Boolean(getAdminSessionToken());
}

export function setAdmin(val) {
  localStorage.setItem(ADMIN_KEY, val ? 'true' : 'false');
}

export function getAdminSessionToken() {
  return localStorage.getItem(ADMIN_SESSION_KEY);
}

export function setAdminSessionToken(token) {
  if (token) localStorage.setItem(ADMIN_SESSION_KEY, token);
  else localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function clearAdmin() {
  localStorage.removeItem(ADMIN_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function isCardActive(customer = getCustomer()) {
  if (!customer) return false;
  if (typeof customer.card_active === 'boolean') return customer.card_active;
  if (!customer.has_winwin_card || !customer.card_expiry_date) return false;
  const today = new Date().toISOString().split('T')[0];
  return String(customer.card_expiry_date).split('T')[0] >= today;
}

async function invoke(name, payload) {
  const res = await fetch(`/api/fn/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return { error: res.ok ? 'Invalid server response' : `Admin login failed (${res.status})` };
  }
  if (!res.ok && !data.error) data.error = res.statusText || 'Request failed';
  return data;
}

export async function invokeCustomer(name, payload = {}) {
  const session_token = getSessionToken();
  const data = await invoke(name, { ...payload, session_token });
  if (data?.error === 'unauthorized') {
    clearCustomer();
  }
  if (data?.customer) setCustomer(data.customer);
  return data;
}

export async function invokeAdmin(name, payload = {}) {
  const admin_session_token = getAdminSessionToken();
  const data = await invoke(name, { ...payload, admin_session_token });
  if (data?.error === 'unauthorized') {
    clearAdmin();
  }
  return data;
}

export async function invokePublic(name, payload = {}) {
  return invoke(name, payload);
}
