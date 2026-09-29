import type { SupabaseClient } from '@supabase/supabase-js';
import { entities, type Entity } from '@/lib/db/types';
import {
  TransportError,
  type PullResponse,
  type PushResult,
  type RealtimeHandlers,
  type SyncTransport,
  type WireMutation,
} from './engine';

interface RpcError {
  message?: string;
  code?: string;
  details?: string | null;
}

/** Sorts a failed call into what the engine does next (retry later, sign in again…). */
export function classifyError(error: RpcError, status: number | undefined): TransportError {
  const message = `${error.code ?? ''} ${error.message ?? ''}`.trim();
  if (status === 401 || status === 403 || error.code === 'PGRST301' || error.code === 'PGRST303' || /jwt|not_authenticated/i.test(message)) {
    return new TransportError('auth', message);
  }
  if (status === 429 || error.code === 'PT429') return new TransportError('rate', message);
  if (!status || /fetch|network|load failed|timed? ?out|econn|socket/i.test(message)) return new TransportError('network', message);
  return new TransportError('server', message);
}

type AnyClient = SupabaseClient<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function supabaseTransport(client: AnyClient, channelName = 'sync'): SyncTransport {
  async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    let response: { data: unknown; error: RpcError | null; status?: number };
    try {
      response = (await client.rpc(fn, args)) as typeof response;
    } catch (error) {
      throw new TransportError('network', error instanceof Error ? error.message : String(error));
    }
    if (response.error) throw classifyError(response.error, response.status);
    return response.data as T;
  }

  return {
    async push(mutations: WireMutation[]): Promise<PushResult[]> {
      const data = await call<{ results: PushResult[] }>('sync_push', { p_mutations: mutations });
      return data.results;
    },
    pull(cursor: string | null): Promise<PullResponse> {
      return call<PullResponse>('sync_pull', { p_cursor: cursor });
    },
    cursor(): Promise<string> {
      return call<string>('sync_cursor', {});
    },
    bootstrap(entity: Entity, after: string | null, limit: number) {
      return call<Record<string, unknown>[]>('sync_bootstrap', { p_entity: entity, p_after: after, p_limit: limit });
    },
    subscribe(handlers: RealtimeHandlers) {
      const channel = client.channel(channelName);
      for (const entity of entities) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: entity }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string } | null)?.id;
            if (id) handlers.onDelete(entity, id);
          } else if (payload.new && typeof payload.new === 'object') {
            handlers.onRow(entity, payload.new as Record<string, unknown>);
          }
        });
      }
      channel.subscribe((state) => {
        // Events may have been missed while (re)connecting: catch up with a pull.
        if (state === 'SUBSCRIBED') handlers.onReconnect();
      });
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
