'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabase } from '@/lib/supabase/client';
import { useSession } from '@/stores/session';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type ProfilePatch = Pick<
  Database['public']['Tables']['profiles']['Update'],
  'display_name' | 'bio' | 'avatar_path' | 'searchable'
>;
export type SettingsPatch = Omit<
  Database['public']['Tables']['user_settings']['Update'],
  'user_id' | 'created_at' | 'updated_at'
>;

export const accountKeys = {
  profile: (id: string | undefined) => ['profile', id] as const,
  settings: (id: string | undefined) => ['settings', id] as const,
};

export function useProfile() {
  const userId = useSession((s) => s.user?.id);
  return useQuery({
    queryKey: accountKeys.profile(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId!).single();
      if (error) throw error;
      return data;
    },
  });
}

const settingsCacheKey = (userId: string) => `vt:settings:${userId}`;

/** The account settings last seen on this device, so the app opens when the server is out of reach. */
function cachedSettings(userId: string | undefined): UserSettings | undefined {
  if (!userId) return undefined;
  try {
    const raw = localStorage.getItem(settingsCacheKey(userId));
    return raw ? (JSON.parse(raw) as UserSettings) : undefined;
  } catch {
    return undefined;
  }
}

export function rememberSettings(settings: UserSettings) {
  try {
    localStorage.setItem(settingsCacheKey(settings.user_id), JSON.stringify(settings));
  } catch {
    // Private mode or a full disk: the app just needs the server next time.
  }
}

export function forgetSettings(userId: string) {
  try {
    localStorage.removeItem(settingsCacheKey(userId));
  } catch {
    // Nothing stored.
  }
}

export function useSettings() {
  const userId = useSession((s) => s.user?.id);
  return useQuery({
    queryKey: accountKeys.settings(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('user_settings').select('*').eq('user_id', userId!).single();
      if (error) throw error;
      return data;
    },
    // Start from the device copy (stale at once, so the server is still asked).
    initialData: () => cachedSettings(userId),
    initialDataUpdatedAt: 0,
  });
}

/** Optimistic update: the screen changes at once, the server catches up. */
export function useUpdateProfile() {
  const userId = useSession((s) => s.user?.id);
  const queryClient = useQueryClient();
  const key = accountKeys.profile(userId);
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { data, error } = await getSupabase().from('profiles').update(patch).eq('id', userId!).select('*').single();
      if (error) throw error;
      return data;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile>(key);
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(key, data),
  });
}

export function useUpdateSettings() {
  const userId = useSession((s) => s.user?.id);
  const queryClient = useQueryClient();
  const key = accountKeys.settings(userId);
  return useMutation({
    mutationFn: async (patch: SettingsPatch) => {
      const { data, error } = await getSupabase()
        .from('user_settings')
        .update(patch)
        .eq('user_id', userId!)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<UserSettings>(key);
      if (previous) queryClient.setQueryData<UserSettings>(key, { ...previous, ...patch } as UserSettings);
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(key, data),
  });
}

export function useChangeUsername() {
  const userId = useSession((s) => s.user?.id);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const { data, error } = await getSupabase().rpc('change_username', { p_username: username });
      if (error) throw error;
      return data;
    },
    onSuccess: (username) => {
      queryClient.setQueryData<Profile>(accountKeys.profile(userId), (p) => (p ? { ...p, username } : p));
    },
  });
}

/** Changes made on another device appear here without a reload. */
export function useAccountRealtime() {
  const userId = useSession((s) => s.user?.id);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`account:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => queryClient.setQueryData(accountKeys.profile(userId), payload.new as Profile),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_settings', filter: `user_id=eq.${userId}` },
        (payload) => queryClient.setQueryData(accountKeys.settings(userId), payload.new as UserSettings),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
