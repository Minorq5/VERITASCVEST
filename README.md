# Veritas Tasks

Планировщик задач в космическом стиле: задачи — звёзды, проекты — планеты, общие цели с друзьями — созвездия. Работает на компьютере и телефоне, устанавливается как приложение, работает без интернета, говорит на русском, английском и болгарском.

> Проект в разработке. Где мы сейчас — [PROGRESS.md](PROGRESS.md). Полный план — [PLAN.md](PLAN.md). Дизайн-система — [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Подробный гайд по установке и публикации появится в `SETUP_GUIDE.md`.

## Технологии

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Motion · GSAP · Three.js / React Three Fiber · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, pg_cron) · Dexie · next-intl · Vitest · Playwright.

## Быстрый старт для разработчика

```bash
npm install
npm run db:start      # локальный Supabase в Docker
cp .env.example .env.local   # и заполните значения (см. комментарии в файле)
npm run dev           # http://localhost:3000
```

Полезные команды:

| Команда | Что делает |
|---|---|
| `npm run dev` | сайт в режиме разработки |
| `npm run build` / `npm start` | production-сборка и запуск |
| `npm run check` | линтер + проверка типов + тесты |
| `npm run icons` | иконки и фавиконы из логотипа (`-- --og <url>` — ещё и картинки превью) |
| `npm run db:start` / `db:stop` / `db:reset` | локальный Supabase |
| `npx tsx scripts/screenshots.ts --routes /ru/design --full` | скриншоты ПК и телефона для дизайн-разбора |

## Структура

```
src/app/[locale]/     страницы (язык в адресе: /ru, /en, /bg)
src/components/ui/    базовые компоненты дизайн-системы
src/components/brand/ логотип и фирменные иконки
src/features/         крупные части приложения
src/lib/              логика (без интерфейса)
src/messages/         переводы ru / en / bg
src/styles/           дизайн-токены
supabase/             конфигурация, миграции базы, функции
scripts/              генераторы, скриншоты, демо-видео
tests/                автотесты
public/brand/         логотип в SVG
```
