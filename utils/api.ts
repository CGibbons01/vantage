import { supabase } from '@/lib/auth';

// Supabase edge functions base URL
const SUPABASE_FUNCTIONS_URL = 'https://dokdulxrrpumtinlbyiv.supabase.co/functions/v1';

// Map /api/* logical paths to Supabase edge function URLs
function resolveUrl(endpoint: string): string {
  if (endpoint === '/api/profile' || endpoint === '/api/profile/') {
    return `${SUPABASE_FUNCTIONS_URL}/api-profile`;
  }
  if (endpoint.startsWith('/api/applications')) {
    const suffix = endpoint.slice('/api/applications'.length);
    return `${SUPABASE_FUNCTIONS_URL}/api-applications${suffix}`;
  }
  if (endpoint === '/api/cv/parse') {
    return `${SUPABASE_FUNCTIONS_URL}/api-cv-parse`;
  }
  if (endpoint.startsWith('/api/cv')) {
    const suffix = endpoint.slice('/api/cv'.length);
    return `${SUPABASE_FUNCTIONS_URL}/api-cv${suffix}`;
  }
  return `${SUPABASE_FUNCTIONS_URL}${endpoint}`;
}

export const getBearerToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch (error) {
    console.error('[API] Error retrieving bearer token:', error);
    return null;
  }
};

export const apiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  const url = resolveUrl(endpoint);
  const method = options?.method || 'GET';
  console.log(`[API] ${method} ${url}`);

  const token = await getBearerToken();

  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkError: any) {
    const message =
      networkError?.message && !networkError.message.toLowerCase().includes('failed to fetch')
        ? networkError.message
        : 'Network error: unable to reach the server. Check your internet connection and try again.';
    console.error(`[API] Network error for ${method} ${url}:`, message);
    throw new Error(message);
  }

  console.log(`[API] ${method} ${url} → ${response.status}`);

  if (!response.ok) {
    const text = await response.text();
    console.error(`[API] Error response for ${method} ${url}:`, response.status, text);
    throw new Error(`API error: ${response.status} - ${text}`);
  }

  return response.json();
};

export const apiGet = async <T = any>(endpoint: string): Promise<T> =>
  apiCall<T>(endpoint, { method: 'GET' });

export const apiPost = async <T = any>(endpoint: string, data: any): Promise<T> =>
  apiCall<T>(endpoint, { method: 'POST', body: JSON.stringify(data) });

export const apiPut = async <T = any>(endpoint: string, data: any): Promise<T> =>
  apiCall<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) });

export const apiPatch = async <T = any>(endpoint: string, data: any): Promise<T> =>
  apiCall<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) });

export const apiDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> =>
  apiCall<T>(endpoint, { method: 'DELETE', body: JSON.stringify(data) });

// Authenticated variants — token is always injected by apiCall, these are aliases
export const authenticatedApiCall = apiCall;
export const authenticatedGet = apiGet;
export const authenticatedPost = apiPost;
export const authenticatedPut = apiPut;
export const authenticatedPatch = apiPatch;
export const authenticatedDelete = apiDelete;

// Legacy compat exports
export const BACKEND_URL = SUPABASE_FUNCTIONS_URL;
export const isBackendConfigured = () => true;
