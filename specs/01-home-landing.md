# SPEC 01 — Home page (landing)

> **Status:** aprobado
> **Depends on:** —
> **Date:** 2026-07-30
> **Objective:** Reemplazar la Biblioteca actual como página raíz por un Home de landing basado en `references/templates/home-about/home.jsx`, moviendo la Biblioteca a `/games`.

## Scope

**In:**

- Nuevo Home en `app/page.tsx` (ruta `/`), basado en `references/templates/home-about/home.jsx`: hero, sección "por qué Arcade Vault", preview de juegos, stats, actividad en vivo (mock), pricing, CTA final.
- Biblioteca actual (`app/page.tsx` hoy) movida a `app/games/page.tsx` (ruta `/games`), sin cambios de contenido/lógica.
- `components/nav.tsx` actualizado: link "Inicio" → `/`, link "Biblioteca" → `/games`, lógica `isActive` ajustada a las nuevas rutas.
- Corrección de los 4 links/redirects que hoy apuntan a `/` esperando la Biblioteca, para que apunten a `/games`:
  - `app/salon/page.tsx` ("VOLVER A LA BIBLIOTECA")
  - `app/juego/[id]/page.tsx` ("VOLVER AL VAULT")
  - `app/auth/page.tsx` (redirect tras login y tras "jugar como invitado")
  - `app/juego/[id]/jugar/page.tsx` (botón salir de partida)
- Estilos nuevos necesarios (hero, feature-grid, mini-rail, stats, activity-grid, pricing, silhouettes decorativas) agregados a `app/globals.css`, reutilizando variables de tema existentes (`--cyan`, `--magenta`, `--yellow`, `--green`, etc.).
- Preview de juegos del Home usa `GAMES.slice(0, 6)` de `lib/data.ts` (datos reales existentes).
- Sección "Actividad en vivo" (últimas puntuaciones, top jugadores) con datos mock hardcodeados, igual que el template.

**Out of scope (for future specs):**

- Página "Acerca de" (`about.jsx`) y su formulario de contacto.
- Conectar "Actividad en vivo" a datos reales de puntuaciones.
- Backend de envío de mensajes de contacto.
- Cambios al contenido/lógica interna de la Biblioteca más allá de moverla de ruta.

## Data model

Esta spec no introduce estructuras de datos nuevas. Reutiliza `Game` de `lib/data.ts` (ya usado por la Biblioteca) para la sección de preview de juegos del Home.

Los datos mock de "Actividad en vivo" (últimas puntuaciones y top jugadores) son arrays literales locales dentro de `app/page.tsx`, igual que en `home.jsx`, sin persistencia ni archivo compartido — no hay contrato que otras partes del código dependan de ellos.

## Implementation plan

1. Mover `app/page.tsx` (Biblioteca actual) a `app/games/page.tsx` sin modificar su contenido. Verificar que `/games` sirve la Biblioteca igual que antes.
2. Crear el nuevo `app/page.tsx` con el Home: portar `home.jsx` a TSX, adaptando `navigate(...)` a `next/link` / `useRouter` (patrón ya usado en `components/nav.tsx`), y `GAMES.slice(0, 6)` a `lib/data.ts`. Botones "Explorar juegos" / "Ver todos los juegos" → `/games`; "Crear cuenta" → `/auth`.
3. Portar los estilos de `home.jsx` desde `references/templates/home-about/styles.css` (secciones hero, feature-grid, mini-rail, stats, activity-grid, pricing, silhouettes) a `app/globals.css`, reutilizando variables de tema existentes.
4. Actualizar `components/nav.tsx`: agregar link "Inicio" → `/`, cambiar link "Biblioteca" → `/games`, ajustar `isActive` para ambas rutas (desktop y menú mobile).
5. Corregir los 4 links/redirects que hoy apuntan a `/` esperando la Biblioteca, para que apunten a `/games`: `app/salon/page.tsx`, `app/juego/[id]/page.tsx`, `app/auth/page.tsx` (ambos redirects), `app/juego/[id]/jugar/page.tsx`.

## Acceptance criteria

- [x] `/` muestra el Home (hero, por qué Arcade Vault, preview de juegos, stats, actividad en vivo, pricing, CTA final) sin errores en consola.
- [x] `/games` muestra la Biblioteca actual (buscador, filtros por categoría, grid de juegos) funcionando igual que antes de mover el archivo.
- [x] Nav muestra "Inicio" y "Biblioteca" como links separados; "Inicio" resalta activo en `/`, "Biblioteca" resalta activo en `/games` y en `/juego/*`.
- [x] El preview de juegos del Home muestra 6 juegos reales tomados de `lib/data.ts`, y cada uno navega a `/juego/[id]` al hacer click.
- [x] Botón "Explorar juegos" y "Ver todos los juegos" del Home navegan a `/games`.
- [x] Botón "Crear cuenta" del Home navega a `/auth`.
- [x] Tras login o "jugar como invitado" en `/auth`, se redirige a `/games`.
- [x] "VOLVER A LA BIBLIOTECA" (salón) y "VOLVER AL VAULT" (detalle de juego) navegan a `/games`.
- [x] Botón de salir de partida en `/juego/[id]/jugar` navega a `/games`.
- [x] El Home es responsive y no rompe layout en mobile (menú hamburguesa existente sigue funcionando).

## Decisions

- **Yes:** Home reemplaza Biblioteca como ruta raíz (`/`). Alinea con el template, que trata Home como landing separado de la Biblioteca.
- **Yes:** Biblioteca se mueve a `/games` sin tocar su lógica interna. Minimiza riesgo — es solo un cambio de ruta.
- **Yes:** Corregir los 4 links que hoy dependen de `/` = Biblioteca. Sin esto la navegación queda rota (usuarios caerían en Home donde antes esperaban la lista de juegos).
- **Yes:** Home en un solo `app/page.tsx`, siguiendo el patrón ya usado por la Biblioteca actual. Consistencia con el resto del proyecto, sin fragmentar en componentes separados sin necesidad real todavía.
- **Yes:** Preview de juegos usa `GAMES` real de `lib/data.ts` en vez de mock propio. Evita duplicar datos que ya existen.
- **Yes:** "Actividad en vivo" queda con datos mock hardcodeados, igual que el template. No hay sistema de puntuaciones real todavía; conectarlo es otro spec.
- **No:** Página "Acerca de" (`about.jsx`). Se deja explícitamente fuera — el usuario pidió enfocar este spec solo en Home.
- **No:** Backend de contacto / envío real de mensajes. No aplica, About queda fuera de scope.

## What is **not** in this spec

- Página "Acerca de" y su formulario de contacto.
- Conexión de "Actividad en vivo" a datos reales.
- Backend de envío de mensajes de contacto.

Cada uno de estos, si se implementa, va en su propio spec.
