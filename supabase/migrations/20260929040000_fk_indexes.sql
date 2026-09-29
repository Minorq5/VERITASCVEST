-- Indexes for foreign keys that had none (Supabase performance advisor).
-- They keep account deletion fast: every ON DELETE CASCADE / SET NULL from a
-- profile or project looks rows up by these columns.
create index if not exists activity_log_actor on public.activity_log (actor_id);
create index if not exists activity_log_project on public.activity_log (project_id);
create index if not exists attachments_uploader on public.attachments (uploader_id);
create index if not exists comments_author on public.comments (author_id);
create index if not exists habit_logs_user on public.habit_logs (user_id);
create index if not exists progress_events_user on public.progress_events (user_id);
create index if not exists task_milestones_created_by on public.task_milestones (created_by);
create index if not exists time_sessions_user on public.time_sessions (user_id);
