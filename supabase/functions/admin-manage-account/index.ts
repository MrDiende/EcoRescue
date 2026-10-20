import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !anonKey || !serviceRoleKey) {
    return response(500, { error: 'Collector provisioning is not configured on the server.' });
  }
  if (!authorization) return response(401, { error: 'Sign in as an administrator first.' });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return response(401, { error: 'Your session is not valid.' });

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await serviceClient
    .from('users')
    .select('role, active')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error('Could not verify administrator profile:', profileError);
    return response(500, { error: 'Could not verify administrator access.' });
  }
  if (profile?.role !== 'admin' || !profile.active) {
    return response(403, { error: 'Administrator access is required.' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return response(400, { error: 'Request body must be valid JSON.' });
  }

  const action = body.action;
  if (action === 'create') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!email || !password || !name) return response(400, { error: 'Email, password, and name are required.' });
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return response(400, { error: 'Password must be 8 characters and include uppercase, lowercase, and a number.' });
    }

    const { data, error } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'collector' },
      user_metadata: {
        name,
        phone: typeof body.phone === 'string' ? body.phone : '',
        address: typeof body.address === 'string' ? body.address : '',
        purok: typeof body.purok === 'string' ? body.purok : '',
      },
    });
    if (error) return response(400, { error: error.message });
    if (!data.user) return response(500, { error: 'Supabase did not return the created collector.' });
    const { data: collector, error: collectorError } = await serviceClient
      .from('users')
      .select('code')
      .eq('id', data.user.id)
      .single();
    if (collectorError) return response(500, { error: 'Collector account was created but its profile could not be loaded.' });
    return response(200, { userId: data.user.id, code: collector.code });
  }

  if (action === 'update') {
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!userId || !email || !name) return response(400, { error: 'Collector ID, email, and name are required.' });

    const { data: target, error: targetError } = await serviceClient
      .from('users')
      .select('id, auth_user_id, email')
      .eq('id', userId)
      .eq('role', 'collector')
      .maybeSingle();
    if (targetError) return response(500, { error: 'Could not verify the collector account.' });
    if (!target) return response(404, { error: 'Collector account was not found.' });
    if (!target.auth_user_id) return response(404, { error: 'Linked collector Auth account was not found.' });

    const authChanges = {};
    authChanges.email_confirm = true;
    if (email !== target.email) {
      authChanges.email = email;
    }
    if (typeof body.password === 'string' && body.password) authChanges.password = body.password;
    if (
      authChanges.password &&
      (authChanges.password.length < 8 ||
        !/[A-Z]/.test(authChanges.password) ||
        !/[a-z]/.test(authChanges.password) ||
        !/\d/.test(authChanges.password))
    ) {
      return response(400, { error: 'Password must be 8 characters and include uppercase, lowercase, and a number.' });
    }
    if (Object.keys(authChanges).length) {
      const { error } = await serviceClient.auth.admin.updateUserById(target.auth_user_id, authChanges);
      if (error) return response(400, { error: error.message });
    }

    const { error } = await serviceClient
      .from('users')
      .update({
        email,
        name,
        phone: typeof body.phone === 'string' ? body.phone : '',
        address: typeof body.address === 'string' ? body.address : '',
        purok: typeof body.purok === 'string' ? body.purok : '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) return response(500, { error: `Auth was updated but the collector profile could not be saved: ${error.message}` });
    return response(200, { userId });
  }

  if (action === 'update-resident') {
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!userId || !email || !name) return response(400, { error: 'Resident ID, email, and name are required.' });

    const { data: target, error: targetError } = await serviceClient
      .from('users')
      .select('id, auth_user_id, email')
      .eq('id', userId)
      .eq('role', 'resident')
      .maybeSingle();
    if (targetError) return response(500, { error: 'Could not verify the resident account.' });
    if (!target?.auth_user_id) return response(404, { error: 'Linked resident Auth account was not found.' });

    if (email !== target.email) {
      const { error } = await serviceClient.auth.admin.updateUserById(target.auth_user_id, {
        email,
        email_confirm: true,
      });
      if (error) return response(400, { error: error.message });
    }
    const { error } = await serviceClient
      .from('users')
      .update({
        email,
        name,
        phone: typeof body.phone === 'string' ? body.phone : '',
        address: typeof body.address === 'string' ? body.address : '',
        purok: typeof body.purok === 'string' ? body.purok : '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) return response(500, { error: `Auth was updated but the resident profile could not be saved: ${error.message}` });
    return response(200, { userId });
  }

  if (action === 'approve-resident') {
    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId) return response(400, { error: 'Resident ID is required.' });

    const { data: target, error: targetError } = await serviceClient
      .from('users')
      .select('auth_user_id')
      .eq('id', userId)
      .eq('role', 'resident')
      .maybeSingle();
    if (targetError) return response(500, { error: 'Could not verify the resident account.' });
    if (!target?.auth_user_id) return response(404, { error: 'Linked resident Auth account was not found.' });

    const { error } = await serviceClient.auth.admin.updateUserById(target.auth_user_id, {
      email_confirm: true,
    });
    if (error) return response(400, { error: `Could not confirm the resident email: ${error.message}` });
    return response(200, { userId });
  }

  if (action === 'delete-resident') {
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const { data: target, error: targetError } = await serviceClient
      .from('users')
      .select('auth_user_id')
      .eq('id', userId)
      .eq('role', 'resident')
      .maybeSingle();
    if (targetError) return response(500, { error: 'Could not verify the resident account.' });
    if (!target?.auth_user_id) return response(404, { error: 'Linked resident Auth account was not found.' });
    const { error } = await serviceClient.auth.admin.deleteUser(target.auth_user_id);
    if (error) return response(400, { error: error.message });
    return response(200, { userId });
  }

  return response(400, { error: 'Unsupported collector action.' });
});
