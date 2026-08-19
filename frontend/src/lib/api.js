const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
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
  logout: () =>
    request('/auth/logout', { method: 'POST' }),
  me: () =>
    request('/auth/me'),
  getEmails: (status) =>
    request(`/emails${status ? `?status=${status}` : ''}`),
  getStats: () =>
    request('/emails/stats'),
  scheduleEmail: (data) =>
    request('/emails/schedule', { method: 'POST', body: JSON.stringify(data) }),
  retryEmail: (id) =>
    request(`/emails/retry/${id}`, { method: 'POST' }),
  deleteEmail: (id) =>
    request(`/emails/${id}`, { method: 'DELETE' }),
};
