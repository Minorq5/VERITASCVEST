'use client';

import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

export type SessionStatus = 'loading' | 'signed-in' | 'signed-out';

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  user: User | null;
  setSession: (session: Session | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  session: null,
  user: null,
  setSession: (session) =>
    set({ session, user: session?.user ?? null, status: session ? 'signed-in' : 'signed-out' }),
}));
