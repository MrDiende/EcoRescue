import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const REQUEST_TIMEOUT_MS = 15000;

const configurationErrors = [];

if (!supabaseUrl) {
  configurationErrors.push('VITE_SUPABASE_URL is missing.');
} else {
  try {
    const url = new URL(supabaseUrl);
    if (
      !url.hostname ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    ) {
      configurationErrors.push('VITE_SUPABASE_URL must be an HTTPS URL (HTTP is allowed for localhost).');
    }
  } catch {
    configurationErrors.push('VITE_SUPABASE_URL must be a valid URL.');
  }
}

if (!supabaseKey) {
  configurationErrors.push('VITE_SUPABASE_ANON_KEY is missing.');
}

export const supabaseConfigurationError = configurationErrors.join(' ');

async function fetchWithTimeout(input, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromRequest = () => controller.abort();

  if (options.signal?.aborted) {
    abortFromRequest();
  } else {
    options.signal?.addEventListener('abort', abortFromRequest, { once: true });
  }

  try {
    return await fetch(input, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new Error('Supabase request timed out. Check your internet connection and Supabase project settings.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromRequest);
  }
}

export function withTimeout(promise, action, timeoutMs = 20000) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${action} timed out. Check your internet connection and try again.`)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export const supabase = supabaseConfigurationError
  ? null
  : createClient(supabaseUrl, supabaseKey, {
      global: { fetch: fetchWithTimeout },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

export function createAuthSignupClient() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError);
  }

  return createClient(supabaseUrl, supabaseKey, {
    global: { fetch: fetchWithTimeout },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
