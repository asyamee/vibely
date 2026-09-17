# Coding Guidelines & Style Guide — Vibely Frontend

> Goal: reduce code review time and ensure codebase consistency.
> If you break a rule, you must have a strong reason — comment it inline.

Code style source of truth: this file. If a rule appears in multiple places and they conflict, this file wins.

---

## 1. Architecture

| Rule | Why |
|------|-----|
| **Separate logic from markup.** Use hooks/services. Components must be "dumb" (render only); all business logic extracted to hooks or services. | Easier to test without DOM rendering; easier to read. |
| **No HTTP requests directly in components.** Use API services (`shared/api/`) and stores. | Hard to reuse, blocks testing, violates Single Responsibility. |
| **Access `localStorage` / `sessionStorage` only through a service or utility wrapper.** | Direct calls in components make tests impossible; a wrapper is easy to mock. |
| **No hardcoded values (strings, numbers, config) inside markup.** Extract to separate files or constants. | One place to update when design changes. |
| **Route strings as constants.** All routes (`/login`, `/profile`, etc.) in `shared/config/routes.ts`. | No magic strings, no typos. |

---

## 2. TypeScript

| Rule | Why |
|------|-----|
| **`I` prefix for interfaces, `T` prefix for type aliases.** Apply to new files and types being modified — do not bulk-rename existing code. | Better IDE autocomplete; easy to tell types from variables. |
| **No `enum`.** Use `as const` + `type` instead. | `enum` emits extra JS at runtime and doesn't tree-shake. |
| **No `FC` / `React.FC` / `FunctionComponent`.** Type props explicitly via destructuring. | `FC` implicitly adds `children`, hides return type, adds unnecessary indirection. |
| **Avoid `any`.** Allowed only for untyped third-party integrations, with `// @ts-expect-error`. | `any` disables TypeScript. Use `unknown` + type guard. |
| **No non-null assertions (`!`) on array access or object fields.** Use optional chaining and nullish coalescing. | Silent runtime crash when assumption is wrong. |

```tsx
// Wrong
export const Foo: FC<FooProps> = ({ bar }) => (...)

// Correct
interface IFooProps { bar: string }
export const Foo = ({ bar }: IFooProps) => (...)
```

```tsx
// Wrong
const name = track.artists[0]!.name

// Correct
const name = track.artists?.[0]?.name ?? 'Unknown'
```

---

## 3. React Performance

| Rule | Why |
|------|-----|
| **Use `useMemo` and `useCallback` only when genuinely needed.** | Premature optimisation hurts readability. Cache only expensive computations or callbacks passed to `React.memo`. |
| **If a component has 7 or more props — decompose it.** Break into smaller components or group props into an object. | Too many props is a sign the component does too much and is hard to test. |

---

## 4. Naming & Code Quality

| Rule | Why |
|------|-----|
| **Use descriptive names for files, functions, and constants.** Name must answer "What is this?" or "What does it do?" | Code should read like prose without diving into implementation. |
| **Follow KISS. Explicit over implicit.** If a solution feels "clever" — simplify it. | Complex code is hard to maintain and debug. |
| **Avoid negative logic** like `!dontShowAlert` or `if (!isNotVisible)`. Use positive names: `showAlert`, `isVisible`. | Double negation breaks reading flow. |
| **Comment "why", not "what".** What the code does should be clear from names. Comments are for non-obvious workarounds (browser bugs, quirks, etc.). | "What" comments go stale faster than code and add noise. |
| **No magic numbers or opaque values.** Anything that isn't `0`, `1`, or `-1` must be a named constant. | `86400` tells you nothing. `SECONDS_IN_DAY` tells you everything. |

---

## 5. Components

Arrow functions only — no `function` declarations:

```tsx
// Wrong
function Foo({ bar }: IFooProps) { ... }

// Correct
const Foo = ({ bar }: IFooProps) => { ... }
```

---

## 6. Exports

Named exports everywhere. Default export only for Next.js pages:

```tsx
// src/shared/ui/Button/Button.tsx — named
export const Button = () => (...)

// src/app/some-page/page.tsx — default (Next.js requirement)
const SomePage = () => (...)
export default SomePage
```

Barrel exports via `export *`:

```ts
// src/shared/ui/index.ts
export * from './Button/Button'
export * from './Input/Input'
export * from './BackButton/BackButton'
```

---

## 7. SVG Icons

Extend `ComponentPropsWithoutRef<'svg'>` and spread `...props` onto `<svg>`:

```tsx
import { ComponentPropsWithoutRef } from 'react'

interface IFooIconProps extends ComponentPropsWithoutRef<'svg'> {
  fill?: string
}

export const FooIcon = ({ fill = 'currentColor', ...props }: IFooIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path fill={fill} d="..." />
  </svg>
)
```

---

## 8. Styles & Layout

| Rule | Why |
|------|-----|
| **All styles (except trivial single-property overrides) go into `<ComponentName>.module.css` next to the component file.** | Separates render logic from layout; makes style changes self-contained. |
| **No `style={{}}` attribute anywhere — only `className`.** | Inline styles bypass CSS Modules scoping and are not overridable. |
| **No hardcoded color values (`#FFFFFF`, `rgba(...)`) in `.module.css`.** Use CSS custom properties defined in `globals.css`: `color: var(--color-text-primary)`. | Hardcoded colors break theming. Variables update centrally. |
| **No hardcoded spacing that has a token equivalent.** Use variables from `globals.css` for consistent spacing. | Single source of truth for the design system. |
| **Check intermediate breakpoints.** Design shows mobile and desktop — test everything in between. | Real devices have thousands of resolutions. Layout must not break between breakpoints. |
| **Semantic HTML.** Use `<button>`, `<nav>`, `<header>`, `<main>`, `<section>`, `<article>` where appropriate. No div-soup. | Screen readers and SEO depend on semantics. |
| **Every interactive element must have accessible text.** Icon-only buttons require `aria-label`. Images require descriptive `alt`. | Accessibility is not optional. |
| **Modal dialogs must trap focus, close on Escape, and carry `role="dialog"` + `aria-modal="true"`.** | Screen reader and keyboard users must not fall out of an open modal. |

---

## 9. Import Order

1. `react` imports
2. Third-party (`next/`, `zustand`, `axios`, `react-hook-form`, etc.)
3. Path aliases: `@/*` (shared → entities → screens order)
4. Local relative imports

Blank line between each group:

```tsx
import { useState } from 'react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { apiClient } from '@/shared/api/client'
import { Button } from '@/shared/ui'

import styles from './LoginPage.module.css'
```

---

## 10. Zustand

Selectors only; parameter is always named `state`.

```tsx
import { useShallow } from 'zustand/react/shallow'

const userId = useUserStore((state) => state.userId)

const { userId, profile } = useUserStore(
  useShallow((state) => ({
    userId: state.userId,
    profile: state.profile,
  }))
)
```

Do not call `useStore()` without a selector. Use `useShallow` when selecting 2 or more fields.

---

## 11. Formatting

- No semicolons
- Trailing commas in multiline arrays/objects
- Single quotes for strings

---

## 12. Prohibited

| Rule | Why |
|------|-----|
| **No `console.log` / `console.warn` / `console.error` in code that reaches the main branch.** | Noise, performance cost, potential data leak. Use debug flags or proper log levels. |
| **No hardcoded URLs, tokens, or keys.** | All endpoints and secrets must go through environment variables and `shared/config/env.ts`. |
| **No silent `catch` blocks.** Every caught error must either show feedback to the user or be logged to an error monitoring service. `catch { // noop }` is forbidden. | Users deserve to know when something failed. |
| **No duplicate utility functions across files.** If the same logic appears twice, extract to `shared/lib/`. | Divergence between copies is a time bomb. |

---

## 13. Error Handling

Extract error messages consistently:

```ts
// shared/lib/error.ts
export const extractErrorMessage = (e: unknown, fallback = 'Что-то пошло не так'): string => {
  if (e && typeof e === 'object' && 'response' in e) {
    const res = (e as { response?: { data?: { message?: string } } }).response
    if (res?.data?.message) return res.data.message
  }
  if (e instanceof Error) return e.message
  return fallback
}
```

Use this helper everywhere instead of inline type gymnastics.

---

## 14. Process

If you spend **more than 1 hour** stuck on a problem and feel like you've hit a wall — stop and ask a colleague. 15 minutes of pair programming often saves 3 hours of debugging and produces a simpler solution.

> **Checklist reminder:** Run through these rules before opening a PR.
> If a rule is violated, either fix it or leave an inline comment explaining why the exception is justified.
