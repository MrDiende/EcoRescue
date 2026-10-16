import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

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
export const supabase = supabaseConfigurationError
  ? null
  : createClient(supabaseUrl, supabaseKey, {
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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
