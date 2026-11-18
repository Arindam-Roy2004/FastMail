export type ApiIssue = { path: string; message: string };

type Envelope<T> = { success: boolean; message: string; data?: T; issues?: ApiIssue[] };

export class ApiRequestError extends Error {
  readonly status: number;
  readonly issues: ApiIssue[];

  constructor(status: number, message: string, issues: ApiIssue[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.issues = issues;
  }

  issueFor(field: string) {
    return this.issues.find((i) => i.path.replace(/^(body|query|params)\./, '') === field)?.message;
  }
}

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const setSessionLostHandler = (handler: (() => void) | null) => {
  onSessionLost = handler;
};

const parse = async <T>(response: Response): Promise<Envelope<T>> => {
  const text = await response.text();
  if (!text) return { success: response.ok, message: response.statusText };
  try {
    return JSON.parse(text) as Envelope<T>;
  } catch {
    // A proxy error page or a crash: not our JSON envelope.
    return { success: false, message: response.ok ? 'Unexpected response' : `Server error (${response.status})` };
  }
};

export type RefreshResult<U> = { accessToken: string; user: U };

let refreshing: Promise<RefreshResult<unknown> | null> | null = null;

export const refreshSession = <U>(): Promise<RefreshResult<U> | null> => {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (response) => {
      if (!response.ok) return null;
      const body = await parse<RefreshResult<unknown>>(response);
      return body.data ?? null;
    })
    .catch(() => null)
    .then((result) => {
      setAccessToken(result?.accessToken ?? null);
      return result;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing as Promise<RefreshResult<U> | null>;
};

type Query = Record<string, string | number | undefined | null>;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  auth?: boolean;
};

const withQuery = (path: string, query?: Query) => {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, auth = true } = options;
  const url = withQuery(path, query);

  const send = () =>
    fetch(url, {
      method,
      signal,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response: Response;
  try {
    response = await send();
    if (response.status === 401 && auth) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        onSessionLost?.();
        throw new ApiRequestError(401, 'Your session expired. Sign in again.');
      }
      response = await send();
    }
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiRequestError(0, 'Cannot reach the server. Check that the API is running.');
  }

  const envelope = await parse<T>(response);
  if (!response.ok || !envelope.success) {
    throw new ApiRequestError(response.status, envelope.message || 'Request failed', envelope.issues);
  }
  return envelope.data as T;
}

export const errorMessage = (err: unknown, fallback = 'Something went wrong') =>
  err instanceof Error && err.message ? err.message : fallback;

export const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';
