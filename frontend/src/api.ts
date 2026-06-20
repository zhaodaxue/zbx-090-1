const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('yishiting_token');
}

function setToken(token: string) {
  localStorage.setItem('yishiting_token', token);
}

function clearToken() {
  localStorage.removeItem('yishiting_token');
}

export interface ApiError extends Error {
  status: number;
  data?: any;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const resp = await fetch(url, { ...options, headers });

  if (!resp.ok) {
    let data: any = null;
    try { data = await resp.json(); } catch {}
    const err = new Error(data?.error || `请求失败 (${resp.status})`) as ApiError;
    err.status = resp.status;
    err.data = data;
    throw err;
  }

  if (resp.status === 204) return undefined as T;
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('text/csv') || ct.includes('text/plain')) {
    return (await resp.text()) as unknown as T;
  }
  return resp.json();
}

export const api = {
  getToken,
  setToken,
  clearToken,

  login: (username: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<any>('/auth/me'),

  listTopics: () => request<{ topics: any[]; totalResidents: number }>('/topics'),
  getTopic: (id: string) => request<any>(`/topics/${id}`),
  createTopic: (title: string, description: string) =>
    request<any>('/topics', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),
  advanceStage: (id: string, remark?: string) =>
    request<any>(`/topics/${id}/advance`, {
      method: 'POST',
      body: JSON.stringify(remark ? { remark } : {}),
    }),
  vote: (id: string, choice: string) =>
    request<any>(`/topics/${id}/vote`, {
      method: 'POST',
      body: JSON.stringify({ choice }),
    }),
  exportTopicCsv: (id: string) => {
    const token = getToken();
    const url = `${API_BASE}/topics/${id}/export/csv`;
    return fetch(url, { headers: { Authorization: `Bearer ${token || ''}` } });
  },

  myRecords: () => request<any>('/users/my/records'),
  listResidents: () => request<any[]>('/users'),
  createResident: (data: { username: string; password: string; realName: string; roomNumber: string }) =>
    request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  liftObservation: (userId: string) =>
    request<any>(`/users/${userId}/lift-observation`, { method: 'POST' }),
};
