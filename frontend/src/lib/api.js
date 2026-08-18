const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    const message = data.details?.length
      ? data.details.map(d => d.message).join('. ')
      : data.error || 'Request failed';
    throw new Error(message);
  }

  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getEmails: (status) =>
    request(`/emails${status ? `?status=${status}` : ''}`),
  getStats: () =>
    request('/emails/stats'),
  scheduleEmail: (data) =>
    request('/emails/schedule', { method: 'POST', body: JSON.stringify(data) }),
};
