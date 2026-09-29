export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          diff: NonNullable<Json>;
          entity_id: string;
          entity_type: string;
          id: number;
          owner_id: string;
          project_id: string | null;
          task_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: NonNullable<Json>;
          entity_id: string;
          entity_type: string;
          id?: never;
          owner_id: string;
          project_id?: string | null;
          task_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: NonNullable<Json>;
          entity_id?: string;
          entity_type?: string;
          id?: never;
          owner_id?: string;
          project_id?: string | null;
          task_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_log_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_log_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_log_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      attachments: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          field_ts: NonNullable<Json>;
          file_name: string;
          height: number | null;
          id: string;
          mime: string;
          size_bytes: number;
          storage_path: string;
          task_id: string;
          thumb_path: string | null;
          tx_id: unknown;
          updated_at: string;
          uploader_id: string;
          version: number;
          width: number | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          file_name: string;
          height?: number | null;
          id: string;
          mime?: string;
          size_bytes: number;
          storage_path: string;
          task_id: string;
          thumb_path?: string | null;
          tx_id?: unknown;
          updated_at?: string;
          uploader_id: string;
          version?: number;
          width?: number | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          file_name?: string;
          height?: number | null;
          id?: string;
          mime?: string;
          size_bytes?: number;
          storage_path?: string;
          task_id?: string;
          thumb_path?: string | null;
          tx_id?: unknown;
          updated_at?: string;
          uploader_id?: string;
          version?: number;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attachments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attachments_uploader_id_fkey';
            columns: ['uploader_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          task_id: string;
          tx_id: unknown;
          updated_at: string;
          version: number;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          field_ts?: NonNullable<Json>;
          id: string;
          task_id: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          task_id?: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      habit_logs: {
        Row: {
          created_at: string;
          date: string;
          deleted_at: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          status: string;
          task_id: string;
          tx_id: unknown;
          updated_at: string;
          user_id: string;
          value: number | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          date: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id: string;
          status: string;
          task_id: string;
          tx_id?: unknown;
          updated_at?: string;
          user_id: string;
          value?: number | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          status?: string;
          task_id?: string;
          tx_id?: unknown;
          updated_at?: string;
          user_id?: string;
          value?: number | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'habit_logs_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'habit_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      priorities: {
        Row: {
          color: string;
          created_at: string;
          deleted_at: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          name: string | null;
          owner_id: string;
          rank: number;
          system_key: string | null;
          tx_id: unknown;
          updated_at: string;
          version: number;
        };
        Insert: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          name?: string | null;
          owner_id: string;
          rank: number;
          system_key?: string | null;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Update: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          name?: string | null;
          owner_id?: string;
          rank?: number;
          system_key?: string | null;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'priorities_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          best_streak: number;
          bio: string;
          created_at: string;
          current_streak: number;
          display_name: string;
          id: string;
          last_seen_at: string | null;
          level: number;
          public_id: string;
          searchable: boolean;
          updated_at: string;
          username: string;
          xp: number;
        };
        Insert: {
          avatar_path?: string | null;
          best_streak?: number;
          bio?: string;
          created_at?: string;
          current_streak?: number;
          display_name: string;
          id: string;
          last_seen_at?: string | null;
          level?: number;
          public_id: string;
          searchable?: boolean;
          updated_at?: string;
          username: string;
          xp?: number;
        };
        Update: {
          avatar_path?: string | null;
          best_streak?: number;
          bio?: string;
          created_at?: string;
          current_streak?: number;
          display_name?: string;
          id?: string;
          last_seen_at?: string | null;
          level?: number;
          public_id?: string;
          searchable?: boolean;
          updated_at?: string;
          username?: string;
          xp?: number;
        };
        Relationships: [];
      };
      progress_events: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          kind: string;
          note: string | null;
          occurred_at: string;
          task_id: string;
          tx_id: unknown;
          updated_at: string;
          user_id: string;
          value: number;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id: string;
          kind: string;
          note?: string | null;
          occurred_at?: string;
          task_id: string;
          tx_id?: unknown;
          updated_at?: string;
          user_id: string;
          value?: number;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          kind?: string;
          note?: string | null;
          occurred_at?: string;
          task_id?: string;
          tx_id?: unknown;
          updated_at?: string;
          user_id?: string;
          value?: number;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'progress_events_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'progress_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          deleted_at: string | null;
          description: string;
          field_ts: NonNullable<Json>;
          icon: string | null;
          id: string;
          name: string;
          owner_id: string;
          parent_id: string | null;
          planet_seed: number;
          sort_key: string;
          tx_id: unknown;
          updated_at: string;
          version: number;
          view_settings: NonNullable<Json>;
        };
        Insert: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          field_ts?: NonNullable<Json>;
          icon?: string | null;
          id: string;
          name: string;
          owner_id: string;
          parent_id?: string | null;
          planet_seed?: number;
          sort_key?: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
          view_settings?: NonNullable<Json>;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          field_ts?: NonNullable<Json>;
          icon?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          parent_id?: string | null;
          planet_seed?: number;
          sort_key?: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
          view_settings?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      statuses: {
        Row: {
          category: string;
          color: string;
          created_at: string;
          deleted_at: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          name: string | null;
          owner_id: string;
          sort_key: string;
          system_key: string | null;
          tx_id: unknown;
          updated_at: string;
          version: number;
        };
        Insert: {
          category?: string;
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          name?: string | null;
          owner_id: string;
          sort_key?: string;
          system_key?: string | null;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Update: {
          category?: string;
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          name?: string | null;
          owner_id?: string;
          sort_key?: string;
          system_key?: string | null;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'statuses_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          deleted_at: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          name: string;
          owner_id: string;
          tx_id: unknown;
          updated_at: string;
          version: number;
        };
        Insert: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id: string;
          name: string;
          owner_id: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Update: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          name?: string;
          owner_id?: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'tags_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      task_completions: {
        Row: {
          completed_at: string;
          created_at: string;
          deleted_at: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          occurrence_date: string | null;
          on_time: boolean | null;
          priority_rank: number | null;
          project_id: string | null;
          task_id: string;
          task_type: string | null;
          tx_id: unknown;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          completed_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id: string;
          occurrence_date?: string | null;
          on_time?: boolean | null;
          priority_rank?: number | null;
          project_id?: string | null;
          task_id: string;
          task_type?: string | null;
          tx_id?: unknown;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          completed_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          occurrence_date?: string | null;
          on_time?: boolean | null;
          priority_rank?: number | null;
          project_id?: string | null;
          task_id?: string;
          task_type?: string | null;
          tx_id?: unknown;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'task_completions_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_completions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      task_milestones: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          done_at: string | null;
          due_date: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          sort_key: string;
          task_id: string;
          title: string;
          tx_id: unknown;
          updated_at: string;
          version: number;
          weight: number;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          done_at?: string | null;
          due_date?: string | null;
          field_ts?: NonNullable<Json>;
          id: string;
          sort_key?: string;
          task_id: string;
          title: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
          weight?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          done_at?: string | null;
          due_date?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          sort_key?: string;
          task_id?: string;
          title?: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'task_milestones_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_milestones_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_tags: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          owner_id: string;
          tag_id: string;
          task_id: string;
          tx_id: unknown;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id: string;
          owner_id: string;
          tag_id: string;
          task_id: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          owner_id?: string;
          tag_id?: string;
          task_id?: string;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'task_tags_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_tags_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          color: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          description: Json | null;
          description_text: string;
          due_at: string | null;
          due_date: string | null;
          due_time: string | null;
          estimate_minutes: number | null;
          field_ts: NonNullable<Json>;
          icon: string | null;
          id: string;
          owner_id: string;
          parent_id: string | null;
          priority_id: string | null;
          progress_current: number;
          progress_target: number | null;
          progress_unit: string | null;
          project_id: string | null;
          quest_id: string | null;
          recurrence: Json | null;
          reminders: NonNullable<Json>;
          sort_key: string;
          start_at: string | null;
          start_date: string | null;
          start_time: string | null;
          status_id: string | null;
          timezone: string;
          title: string;
          tx_id: unknown;
          type: string;
          type_config: NonNullable<Json>;
          updated_at: string;
          version: number;
        };
        Insert: {
          color?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: Json | null;
          description_text?: string;
          due_at?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          estimate_minutes?: number | null;
          field_ts?: NonNullable<Json>;
          icon?: string | null;
          id: string;
          owner_id: string;
          parent_id?: string | null;
          priority_id?: string | null;
          progress_current?: number;
          progress_target?: number | null;
          progress_unit?: string | null;
          project_id?: string | null;
          quest_id?: string | null;
          recurrence?: Json | null;
          reminders?: NonNullable<Json>;
          sort_key?: string;
          start_at?: string | null;
          start_date?: string | null;
          start_time?: string | null;
          status_id?: string | null;
          timezone?: string;
          title: string;
          tx_id?: unknown;
          type?: string;
          type_config?: NonNullable<Json>;
          updated_at?: string;
          version?: number;
        };
        Update: {
          color?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: Json | null;
          description_text?: string;
          due_at?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          estimate_minutes?: number | null;
          field_ts?: NonNullable<Json>;
          icon?: string | null;
          id?: string;
          owner_id?: string;
          parent_id?: string | null;
          priority_id?: string | null;
          progress_current?: number;
          progress_target?: number | null;
          progress_unit?: string | null;
          project_id?: string | null;
          quest_id?: string | null;
          recurrence?: Json | null;
          reminders?: NonNullable<Json>;
          sort_key?: string;
          start_at?: string | null;
          start_date?: string | null;
          start_time?: string | null;
          status_id?: string | null;
          timezone?: string;
          title?: string;
          tx_id?: unknown;
          type?: string;
          type_config?: NonNullable<Json>;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_priority_id_fkey';
            columns: ['priority_id'];
            isOneToOne: false;
            referencedRelation: 'priorities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_status_id_fkey';
            columns: ['status_id'];
            isOneToOne: false;
            referencedRelation: 'statuses';
            referencedColumns: ['id'];
          },
        ];
      };
      templates: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          field_ts: NonNullable<Json>;
          icon: string | null;
          id: string;
          kind: string;
          name: string;
          owner_id: string;
          payload: NonNullable<Json>;
          tx_id: unknown;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          icon?: string | null;
          id: string;
          kind?: string;
          name: string;
          owner_id: string;
          payload: NonNullable<Json>;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          field_ts?: NonNullable<Json>;
          icon?: string | null;
          id?: string;
          kind?: string;
          name?: string;
          owner_id?: string;
          payload?: NonNullable<Json>;
          tx_id?: unknown;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'templates_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      time_sessions: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          ended_at: string | null;
          field_ts: NonNullable<Json>;
          id: string;
          kind: string;
          pomodoro_index: number | null;
          seconds: number | null;
          started_at: string;
          task_id: string;
          tx_id: unknown;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          ended_at?: string | null;
          field_ts?: NonNullable<Json>;
          id: string;
          kind?: string;
          pomodoro_index?: number | null;
          seconds?: number | null;
          started_at: string;
          task_id: string;
          tx_id?: unknown;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          ended_at?: string | null;
          field_ts?: NonNullable<Json>;
          id?: string;
          kind?: string;
          pomodoro_index?: number | null;
          seconds?: number | null;
          started_at?: string;
          task_id?: string;
          tx_id?: unknown;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'time_sessions_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'time_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_settings: {
        Row: {
          accent: string;
          ambient_enabled: boolean;
          created_at: string;
          friend_requests: string;
          haptics: boolean;
          locale: string;
          notifications: NonNullable<Json>;
          onboarding_completed_at: string | null;
          show_in_leaderboard: boolean;
          sound_ambient: number;
          sound_enabled: boolean;
          sound_fx: number;
          sound_ui: number;
          sound_volume: number;
          time_format: string;
          timezone: string;
          updated_at: string;
          user_id: string;
          week_start: number;
        };
        Insert: {
          accent?: string;
          ambient_enabled?: boolean;
          created_at?: string;
          friend_requests?: string;
          haptics?: boolean;
          locale?: string;
          notifications?: NonNullable<Json>;
          onboarding_completed_at?: string | null;
          show_in_leaderboard?: boolean;
          sound_ambient?: number;
          sound_enabled?: boolean;
          sound_fx?: number;
          sound_ui?: number;
          sound_volume?: number;
          time_format?: string;
          timezone?: string;
          updated_at?: string;
          user_id: string;
          week_start?: number;
        };
        Update: {
          accent?: string;
          ambient_enabled?: boolean;
          created_at?: string;
          friend_requests?: string;
          haptics?: boolean;
          locale?: string;
          notifications?: NonNullable<Json>;
          onboarding_completed_at?: string | null;
          show_in_leaderboard?: boolean;
          sound_ambient?: number;
          sound_enabled?: boolean;
          sound_fx?: number;
          sound_ui?: number;
          sound_volume?: number;
          time_format?: string;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
          week_start?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'user_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      change_username: { Args: { p_username: string }; Returns: string };
      check_username: { Args: { p_username: string }; Returns: Json };
      sync_bootstrap: {
        Args: { p_after?: string; p_entity: string; p_limit?: number };
        Returns: Json;
      };
      sync_cursor: { Args: Record<PropertyKey, never>; Returns: string };
      sync_pull: { Args: { p_cursor?: string; p_limit?: number }; Returns: Json };
      sync_push: { Args: { p_mutations: Json }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
