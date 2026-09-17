# Frontend Refactor Plan — Vibely

> Дата: 2026-09-17  
> Область: `frontend/`  
> Стек: Next.js 16, React 19, Zustand, CSS Modules, Axios, react-hook-form + Zod

---

## Контекст

Аудит выявил три класса проблем: дыры в безопасности (включая незащищённый admin-роут), баги в обработке ошибок и race conditions, а также UX/доступность без скелетонов и a11y. Параллельно вводится `AGENTS.md` — адаптированные правила из payments-esim под CSS Modules, обязательные для всего frontend-кода.

---

## Задача 1 — Создать `frontend/AGENTS.md`

Адаптировать AGENTS.md из payments-esim: сохранить все архитектурные, TypeScript, React, naming, компонентные, export, import-order, Zustand, formatting и process правила. Раздел «Styles & Layout» заменить на эквивалент для CSS Modules.

**Ключевые отличия от оригинала:**

| Payments-esim (MUI) | Vibely (CSS Modules) |
|---------------------|----------------------|
| `styled()` в `styles.ts` | Стили в `<Name>.module.css` рядом с компонентом |
| `Box`, `Typography` вместо HTML | Bare HTML — допустимо, но семантическое |
| `sx={{ color: theme.palette.* }}` | `color: var(--color-*)` через CSS-переменные в `globals.css` |
| Нет `style={{}}` | Нет `style={{}}` — только `className` |
| Нет хардкода цветов | Нет хардкода цветов — только CSS var |

---

## Задача 2 — Обновить `CLAUDE.md`

В раздел «Frontend» добавить:

```
> **Обязательно:** перед любой работой с frontend-кодом прочитать
> `frontend/AGENTS.md`. Это source of truth по стилю и архитектуре.
```

---

## Задача 3 — Исправить проблемы по приоритетам

---

### Безопасность

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| S1 | **Незащищённый `/admin` роут** — любой авторизованный пользователь может запускать переобучение модели | `middleware.ts`, `app/admin/page.tsx` | 🔴 Критично |
| S2 | **Race condition при рефреше токена** — несколько параллельных 401 порождают несколько POST /refresh | `shared/api/client.ts:27–43` | 🔴 Критично |
| S3 | **Слабая валидация пароля** — только `min(8)`, без требований к сложности | `screens/login/ui/LoginPage.tsx:16`, `screens/register/ui/RegisterPage.tsx:17` | 🟡 Среднее |
| S4 | **Type assertion без runtime-проверки** — если бекенд изменит структуру ответа `/refresh`, silent fail | `middleware.ts:51` | 🟡 Среднее |
| S5 | **Нет Content Security Policy** — нет CSP-заголовков ни в `next.config.ts`, ни в nginx | `next.config.ts` | 🟡 Среднее |
| S6 | **Нет CSRF-токенов** — только SameSite cookie | все POST/PUT/DELETE | 🟢 Низкое |

**Как исправить S1:** в `middleware.ts` добавить список admin userId из env и редиректить 403 если `req.user.userId` не в списке, до рендера `/admin`.

**Как исправить S2:** заменить локальный флаг `isRefreshing` на синглтон-промис (`let refreshPromise: Promise<string> | null`), все очереди ждут одного промиса.

---

### Баги

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| B1 | **Silent catch без feedback** — `catch { // noop }` при принятии/отклонении заявки | `screens/notifications/ui/NotificationsPage.tsx:30–34` | 🔴 Критично |
| B2 | **Non-null assertion на массиве** — `track.track.artists[0]!.name` упадёт если artists пустой | `screens/model-train/ui/ModelTrainPage.tsx:293` | 🔴 Критично |
| B3 | **Race condition модальных окон** — два boolean-флага, быстрый клик открывает оба сразу | `screens/profile-settings/ui/ProfileSettingsPage.tsx` | 🟡 Среднее |
| B4 | **Нет fallback для аватара** — сломанный img ломает layout | `screens/profile/ui/ProfilePage.tsx:47`, `screens/notifications/ui/NotificationsPage.tsx:48` | 🟡 Среднее |
| B5 | **Дублирование `extractPlaylistId`** — одна функция в двух местах, рассинхронизируются | `screens/model-train/…`, `screens/my-playlists/…` | 🟡 Среднее |
| B6 | **`favorited` state не персистируется** — useState, не связан с бекендом, сбрасывается на refresh | `screens/main-feed/ui/MainFeedPage.tsx:16` | 🟢 Низкое |
| B7 | **Нет error-boundary на уровне экранов** — только глобальный `error.tsx` | `app/error.tsx` | 🟢 Низкое |

---

### UI / UX

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| U1 | **Нет loading-скелетонов** — страницы пустые во время SSR/fetch, нет skeleton-компонентов | все страницы | 🔴 Критично |
| U2 | **Модалки недоступны** — нет `aria-modal`, фокус не трапится, Escape не закрывает | `screens/profile-settings/ui/ProfileSettingsPage.tsx:265,334` | 🔴 Критично |
| U3 | **Нет системы уведомлений об ошибках** — ошибки либо `alert()`, либо немой catch | повсюду | 🟡 Среднее |
| U4 | **Icon-only кнопки без `aria-label`** — скрин-ридер не поймёт назначение | `shared/ui/Button`, несколько мест | 🟡 Среднее |
| U5 | **Alt-текст аватаров пустой** — `alt=""` вместо имени пользователя | `screens/notifications/ui/NotificationsPage.tsx:48` | 🟡 Среднее |
| U6 | **Форма настроек: нет `inputmode`/`autocomplete`** — телефон, telegram не подсказывают mobile-клавиатуру | `screens/profile-settings/ui/ProfileSettingsPage.tsx:149–160` | 🟢 Низкое |
| U7 | **Нет дизайн-токенов для отступов** — raw px/% в каждом `.module.css` | `*.module.css` | 🟢 Низкое |

---

### Соответствие AGENTS.md

| # | Нарушение | Файл | Приоритет |
|---|-----------|------|-----------|
| A1 | **Интерфейсы без `I` префикса** — `UserCardData`, `UserProfile` и др. | `entities/user/model/types.ts`, все screens | 🟡 Среднее |
| A2 | **Props объявлены inline** — `{ bar }: { bar: string }` вместо `IFooProps` | несколько компонентов | 🟡 Среднее |
| A3 | **Нет barrel-экспортов** — каждый импорт идёт по полному пути | `shared/ui/*`, `shared/api/*` | 🟡 Среднее |
| A4 | **Захардкоженные route-строки** — `/login`, `/profile`, `/model-train` по всему коду | повсюду | 🟡 Среднее |
| A5 | **Нарушен порядок импортов** — react / third-party / aliases / local не разделены пустой строкой | несколько файлов | 🟢 Низкое |
| A6 | **Zustand без `useShallow`** — множественные поля выбираются по одному | `shared/store/userStore.ts` | 🟢 Низкое |

---

## Порядок выполнения

### Этап 0 — Документация (1 день)
1. Создать `frontend/AGENTS.md`
2. Обновить `CLAUDE.md`

### Этап 1 — Критичное (2–3 дня)
- S1: Защита `/admin` в middleware
- S2: Singleton refresh promise в `client.ts`
- B1: Обработка ошибок в NotificationsPage
- B2: Заменить `artists[0]!` на `artists?.[0]?.name ?? 'Unknown'`
- U1: Базовые skeleton-компоненты (1 общий `<Skeleton>` + использование на главных страницах)
- U2: Доступные модалки (focus trap + Escape + aria-modal)

### Этап 2 — Высокое (3–4 дня)
- B3: Унифицировать modal state → `{ type: 'password' | 'delete' | null }`
- B4: Fallback для аватаров (onerror → placeholder)
- B5: Вынести `extractPlaylistId` в `shared/lib/playlist.ts`
- U3: Toast/notification компонент для ошибок (можно react-hot-toast или самописный)
- U4/U5: aria-label на кнопках, alt-тексты
- A1–A3: Переименовать интерфейсы, вынести props, добавить barrel-экспорты

### Этап 3 — Среднее / Низкое (по мере)
- S3: Усилить password validation в Zod-схемах
- S4: Runtime-валидация ответа /refresh
- S5: CSP заголовки в next.config.ts
- A4: `shared/config/routes.ts` с константами маршрутов
- A5/A6: Import order + useShallow
- U6/U7: inputmode/autocomplete + CSS-токены

---

## Проверка

После каждого этапа:
- `npm run lint` — 0 ошибок
- `npm run build` — успешная сборка
- Ручное тестирование: login → main feed → profile → notifications → playlists
- Admin: попытка зайти на `/admin` без прав → редирект 403
- Параллельные запросы: открыть DevTools Network → убедиться что refresh вызывается 1 раз при 401
