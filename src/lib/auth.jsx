import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createAuthSignupClient, supabase, withTimeout } from './supabase';
import { toRecord } from './supabaseData';
import { actorOf, useStore } from './store';
import { uid } from './storage';

const AuthContext = createContext(null);

export function homePath(role) {
  return role === 'admin' ? '/admin' : role === 'collector' ? '/collector' : '/resident';
}

async function getProfile(userId) {
  const { data, error } = await withTimeout(
    supabase.from('users').select('*').eq('auth_user_id', userId).maybeSingle(),
    'Loading your account profile',
  );
  if (error) throw new Error(`Could not load your account: ${error.message}`);
  return data ? toRecord(data) : null;
}

async function writeActivity(profile, action, details) {
  const actor = actorOf(profile);
  const { error } = await supabase.from('activity').insert({
    id: uid('ac-'),
    actor_id: actor.id,
    actor_name: actor.name,
    role: actor.role,
    action,
    details,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not record account activity: ${error.message}`);
}

export function AuthProvider({ children }) {
  const { db, loaded } = useStore();
  const [authUserId, setAuthUserId] = useState(null);
  const [authProfile, setAuthProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const storedProfile = db.users.find((entry) => entry.id === authUserId);
  const profile = storedProfile ?? authProfile;
  const user =
    profile?.active && (profile.role !== 'resident' || profile.status === 'approved') ? profile : null;

  useEffect(() => {
    if (loaded && authUserId && !user) void supabase.auth.signOut();
  }, [authUserId, loaded, user]);

  useEffect(() => {
    let active = true;
    const load = async (session) => {
      if (!session?.user) {
        setAuthUserId(null);
        setAuthProfile(null);
        setAuthError(null);
        setReady(true);
        return;
      }
      try {
        const profile = await getProfile(session.user.id);
        if (!active) return;
        if (!profile || !profile.active || (profile.role === 'resident' && profile.status !== 'approved')) {
          setAuthUserId(null);
          setAuthProfile(null);
          await supabase.auth.signOut();
        } else {
          setAuthUserId(profile.id);
          setAuthProfile(profile);
          setAuthError(null);
        }
      } catch (error) {
        if (active) setAuthError(error instanceof Error ? error.message : 'Could not load your account.');
      } finally {
        if (active) setReady(true);
      }
    };
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void load(session), 0);
    });
    void withTimeout(supabase.auth.getSession(), 'Checking your account session').then(({ data, error }) => {
      if (error) {
        setAuthError(`Supabase session check failed: ${error.message}`);
        setReady(true);
      } else {
        void load(data.session);
      }
    }).catch((error) => {
      if (!active) return;
      setAuthError(error instanceof Error ? error.message : 'Could not verify your account session.');
      setReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        }),
        'Signing in',
      );
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          return {
            ok: false,
            error:
              'Email confirmation is still enabled for this Supabase project. Turn off Confirm email in Authentication settings, then try signing in again.',
          };
        }
        return { ok: false, error: error.message };
      }
      if (!data.user) return { ok: false, error: 'Supabase did not return an authenticated user.' };

      let profile;
      try {
        profile = await getProfile(data.user.id);
      } catch (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }
      if (!profile) {
        await supabase.auth.signOut();
        return { ok: false, error: 'This account has no EcoRescue profile. Contact the barangay administrator.' };
      }
      if (!profile.active) {
        await supabase.auth.signOut();
        return { ok: false, error: 'This account has been deactivated. Please contact the barangay office.' };
      }
      if (profile.role === 'resident' && profile.status !== 'approved') {
        await supabase.auth.signOut();
        return {
          ok: false,
          status: profile.status === 'rejected' ? 'rejected' : 'pending',
          error:
            profile.status === 'rejected'
              ? 'Your registration was rejected. Please contact the barangay office or register again with valid proof of residency.'
              : 'Your registration is still pending approval. You will be able to sign in once the barangay approves your proof of residency.',
        };
      }

      setAuthUserId(profile.id);
      setAuthProfile(profile);
      setReady(true);
      let warning;
      try {
        await withTimeout(
          writeActivity(profile, 'Signed in', `${profile.name} (${profile.code}) signed in.`),
          'Recording sign-in activity',
        );
      } catch (activityError) {
        warning = activityError instanceof Error ? activityError.message : 'Could not record sign-in activity.';
      }
      return { ok: true, user: profile, warning };
    },
    [],
  );

  const registerResident = useCallback(async (application) => {
    const signupClient = createAuthSignupClient();
    const { data, error } = await signupClient.auth.signUp({
      email: application.email.trim().toLowerCase(),
      password: application.password,
      options: {
        data: {
          name: application.name,
          phone: application.phone,
          address: application.address,
          purok: application.purok,
          proof_image: application.proofImage,
        },
      },
    });
    if (error) throw new Error(error.message);
    if (!data.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0)) {
      throw new Error('An account with this email may already exist. Try signing in or use a different email.');
    }
    return `R-${data.user.id.replaceAll('-', '').toUpperCase()}`;
  }, []);

  const logout = useCallback(async () => {
    let warning;
    if (user) {
      try {
        await writeActivity(user, 'Signed out', `${user.name} (${user.code}) signed out.`);
      } catch (activityError) {
        warning = activityError instanceof Error ? activityError.message : 'Could not record sign-out activity.';
      }
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Could not sign out: ${error.message}`);
    setAuthUserId(null);
    setAuthProfile(null);
    return { warning };
  }, [user]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return { ok: false, error: 'No signed-in email is available.' };
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyError) return { ok: false, error: 'Current password is incorrect.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, authError, login, logout, registerResident, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Use inside role-protected pages where the user is guaranteed. */
export function useCurrentUser() {
  const { user } = useAuth();
  if (!user) throw new Error('No authenticated user');
  return user;
}
