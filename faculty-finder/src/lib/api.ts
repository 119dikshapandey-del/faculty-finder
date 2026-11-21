import { io, type Socket } from 'socket.io-client';

let authTokenMemory: string | null = null;

export function setAuthToken(token: string | null): void {
  authTokenMemory = token;
}

export function getAuthToken(): string | null {
  return authTokenMemory;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authTokenMemory) {
    headers.set('Authorization', `Bearer ${authTokenMemory}`);
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function connectCollegeSocket(token: string): Socket {
  return io({
    auth: { token },
    transports: ['websocket', 'polling'],
  });
}
