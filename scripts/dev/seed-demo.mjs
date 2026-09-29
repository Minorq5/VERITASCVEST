/**
 * A demo account with a realistic day of tasks, created straight in the
 * local database (service key). Used by screenshot scripts.
 *
 *   import { createDemoAccount } from './seed-demo.mjs';
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

function env(name) {
  if (process.env[name]) return process.env[name];
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing in .env.local`);
  return line.slice(name.length + 1).trim();
}

export const API = env('NEXT_PUBLIC_SUPABASE_URL');
const SECRET = env('SUPABASE_SECRET_KEY');
const PUBLISHABLE = env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

/** Writes rows the way the app does: signed in as the person, through sync_push. */
async function pushAs(email, password, rows) {
  const auth = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!auth.ok) throw new Error(`sign in: ${auth.status} ${await auth.text()}`);
  const { access_token: token } = await auth.json();
  let ts = Date.now();
  const mutations = rows.map(([entity, data]) => ({ id: randomUUID(), entity, op: 'insert', row_id: data.id, data, ts: (ts += 1) }));
  for (let i = 0; i < mutations.length; i += 150) {
    const res = await fetch(`${API}/rest/v1/rpc/sync_push`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_mutations: mutations.slice(i, i + 150) }),
    });
    if (!res.ok) throw new Error(`sync_push: ${res.status} ${await res.text()}`);
    const { results } = await res.json();
    const bad = results.filter((r) => r.status === 'rejected');
    if (bad.length) throw new Error(`sync_push rejected: ${JSON.stringify(bad.slice(0, 3))}`);
  }
}

async function admin(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { apikey: SECRET, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const pad = (n) => String(n).padStart(2, '0');
function moscowDate(offsetDays = 0) {
  const d = new Date(Date.now() + 3 * 3600_000 + offsetDays * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();

/** Creates a confirmed, onboarded account; with `tasks`, fills a realistic day. */
export async function createDemoAccount({ tag = 'demo', tasks = true, onboarded = true } = {}) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `alina-${tag}-${id}@example.com`;
  const username = `alina_${id}`.slice(0, 24);
  const user = await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'Orbita2026x',
      email_confirm: true,
      user_metadata: { username, display_name: 'Алина Орлова', locale: 'ru', timezone: 'Europe/Moscow' },
    }),
  });
  await admin(`/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ xp: 2050, level: 6, bio: 'Утро — для глубокой работы, вечер — для бега.' }),
  });
  if (onboarded) {
    await admin(`/rest/v1/user_settings?user_id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ onboarding_completed_at: new Date().toISOString() }),
    });
  }
  if (tasks) await seedTasks(user.id, email, 'Orbita2026x');
  return { id: user.id, email, username, password: 'Orbita2026x' };
}

async function seedTasks(owner, email, password) {
  const out = [];
  const [priorities, statuses] = await Promise.all([
    admin(`/rest/v1/priorities?owner_id=eq.${owner}&select=id,system_key`),
    admin(`/rest/v1/statuses?owner_id=eq.${owner}&select=id,system_key`),
  ]);
  const prio = Object.fromEntries(priorities.map((p) => [p.system_key, p.id]));
  const status = Object.fromEntries(statuses.map((s) => [s.system_key, s.id]));
  const today = moscowDate(0);

  const tagRows = [
    { id: randomUUID(), owner_id: owner, name: 'работа', color: 'blue' },
    { id: randomUUID(), owner_id: owner, name: 'дом', color: 'sand' },
    { id: randomUUID(), owner_id: owner, name: 'здоровье', color: 'gold' },
  ];
  for (const t of tagRows) out.push(['tags', t]);
  const tagId = Object.fromEntries(tagRows.map((t) => [t.name, t.id]));
  // A small universe of projects: one with subprojects, two plain ones and one archived.
  const planet = (name, color, sortKey, seed, extra = {}) => ({ id: randomUUID(), owner_id: owner, name, color, sort_key: sortKey, planet_seed: seed, ...extra });
  const project = planet('Запуск сайта', 'amber', 'a0', 20260417, { description: 'Лендинг, тексты и первые пользователи к концу месяца.' });
  const design = planet('Дизайн', 'blue', 'a0', 771, { parent_id: project.id });
  const copy = planet('Тексты', 'sand', 'a1', 90210, { parent_id: project.id });
  const home = planet('Дом', 'ice', 'a1', 4242);
  const health = planet('Здоровье', 'gold', 'a2', 31337, { description: 'Сон, бег и вода — каждый день понемногу.' });
  const trip = planet('Поездка в Карелию', 'rust', 'a3', 555, { archived_at: hoursAgo(240) });
  for (const p of [project, design, copy, home, health, trip]) out.push(['projects', p]);

  let order = 0;
  const task = (title, extra = {}) => ({
    id: randomUUID(),
    owner_id: owner,
    title,
    type: 'normal',
    timezone: 'Europe/Moscow',
    status_id: status.todo,
    sort_key: `a${order++}`,
    ...extra,
  });
  const rows = {
    report: task('Отправить отчёт по кварталу', { due_date: moscowDate(-1), due_time: '18:00', priority_id: prio.high }),
    call: task('Созвон с командой дизайна', { due_date: today, due_time: '11:00', priority_id: prio.medium, estimate_minutes: 30 }),
    groceries: task('Купить продукты на неделю', { due_date: today, project_id: home.id }),
    thesis: task('Написать главу диплома', { type: 'percent', due_date: today, progress_current: 60, priority_id: prio.critical }),
    book: task('Прочитать «Интерстеллар: наука за кадром»', { type: 'numeric', due_date: today, progress_target: 300, progress_unit: 'страниц' }),
    run: task('Пробежка в парке', { type: 'time', due_date: today, due_time: '19:30', progress_target: 45, project_id: health.id }),
    water: task('Вода', { type: 'counter', progress_target: 8, progress_unit: 'стаканов', type_config: { period: 'day', mode: 'goal', step: 1 } }),
    meditation: task('Медитация', { type: 'habit', type_config: { schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] }, start: moscowDate(-20) } }),
    launch: task('Запуск лендинга', { type: 'stages', due_date: moscowDate(3), project_id: project.id, priority_id: prio.high }),
    mom: task('Позвонить маме', { due_date: moscowDate(1), due_time: '20:00' }),
    internet: task('Оплатить интернет', {
      due_date: moscowDate(4),
      recurrence: { freq: 'monthly', interval: 1, byMonthDay: Number(moscowDate(4).slice(8)), mode: 'schedule', anchor: moscowDate(4) },
    }),
    letters: task('Ответить на письма', { due_date: today, completed_at: hoursAgo(2), status_id: status.done }),
    idea: task('Старая идея для блога', { deleted_at: hoursAgo(30) }),
    mockup: task('Макет главной страницы', { project_id: design.id, completed_at: hoursAgo(30), status_id: status.done }),
    icons: task('Иконки для разделов', { project_id: design.id, due_date: moscowDate(2), priority_id: prio.medium }),
    contrast: task('Проверить контраст текста', { project_id: design.id }),
    heroText: task('Текст для первого экрана', { project_id: copy.id, completed_at: hoursAgo(20), status_id: status.done }),
    faq: task('Ответы на частые вопросы', { project_id: copy.id, due_date: moscowDate(5) }),
    domain: task('Подключить домен', { project_id: project.id, completed_at: hoursAgo(50), status_id: status.done }),
    tap: task('Починить кран на кухне', { project_id: home.id, due_date: moscowDate(-2), priority_id: prio.high }),
    sleep: task('Ложиться до полуночи', { project_id: health.id }),
    tickets: task('Купить билеты на поезд', { project_id: trip.id, completed_at: hoursAgo(260), status_id: status.done }),
  };
  for (const row of Object.values(rows)) out.push(['tasks', row]);

  // Two smart lists: what burns, and work for the week.
  out.push(
    ...toRows('saved_filters', [
      { id: randomUUID(), owner_id: owner, name: 'Горит', color: 'rust', query: { priorities: [prio.critical, prio.high] }, sort: 'due', sort_key: 'a0' },
      { id: randomUUID(), owner_id: owner, name: 'Работа на неделю', color: 'blue', query: { tags: [tagId.работа], due: ['overdue', 'week'] }, sort: 'priority', sort_key: 'a1' },
    ]),
  );

  out.push(
    ...toRows('task_tags', [
      { id: randomUUID(), task_id: rows.report.id, tag_id: tagId.работа, owner_id: owner },
      { id: randomUUID(), task_id: rows.call.id, tag_id: tagId.работа, owner_id: owner },
      { id: randomUUID(), task_id: rows.groceries.id, tag_id: tagId.дом, owner_id: owner },
      { id: randomUUID(), task_id: rows.run.id, tag_id: tagId.здоровье, owner_id: owner },
    ]),
  );
  out.push(
    ...toRows('progress_events', [
      { id: randomUUID(), task_id: rows.book.id, user_id: owner, kind: 'set', value: 96, occurred_at: hoursAgo(50) },
      { id: randomUUID(), task_id: rows.book.id, user_id: owner, kind: 'delta', value: 28, occurred_at: hoursAgo(3) },
      ...[0.2, 1, 2, 3, 4].map((h) => ({ id: randomUUID(), task_id: rows.water.id, user_id: owner, kind: 'delta', value: 1, occurred_at: hoursAgo(h) })),
    ]),
  );
  out.push(
    ...toRows('time_sessions', [
      { id: randomUUID(), task_id: rows.run.id, user_id: owner, started_at: hoursAgo(26), ended_at: hoursAgo(25.6), seconds: 1500, kind: 'focus' },
    ]),
  );
  const habitDays = [];
  for (let d = -20; d <= -1; d += 1) {
    if (d !== -7) habitDays.push({ id: randomUUID(), task_id: rows.meditation.id, user_id: owner, date: moscowDate(d), status: 'done' });
  }
  out.push(...toRows('habit_logs', habitDays));
  out.push(
    ...toRows(
      'task_milestones',
      ['Структура и тексты', 'Дизайн', 'Вёрстка', 'Публикация'].map((title, i) => ({
        id: randomUUID(),
        task_id: rows.launch.id,
        created_by: owner,
        title,
        weight: 25,
        sort_key: `a${i}`,
        done_at: i < 2 ? hoursAgo(40 - i * 10) : null,
      })),
    ),
  );
  out.push(
    ...toRows('task_completions', [
      { id: randomUUID(), task_id: rows.letters.id, user_id: owner, completed_at: hoursAgo(2), on_time: true, task_type: 'normal' },
    ]),
  );
  await pushAs(email, password, out);
  return rows;
}

const toRows = (entity, list) => list.map((row) => [entity, row]);
