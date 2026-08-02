# SPEC 05 — Tablas de juegos y puntuaciones en Supabase

> **Estado:** Implementado
> **Depende de:** [03-supabase-integration](03-supabase-integration.md)
> **Fecha:** 2026-08-02
> **Objetivo:** Crear las tablas `games` y `scores` en Supabase (con RLS), migrar el catálogo de juegos y el guardado de puntuaciones a datos reales, y reemplazar los leaderboards fake (salón de la fama y detalle de juego) por consultas reales a la base de datos.

## Scope

**In:**

- Tabla `games` en Supabase (migración SQL vía `apply_migration`), sembrada con los 12 juegos actuales de `lib/data.ts` (incluye `rocas`).
- Tabla `scores` en Supabase (migración SQL), vacía al crearse — sin seed de datos fake.
- Políticas RLS: `games` con SELECT público; `scores` con SELECT público e INSERT público (rol `anon`), sin UPDATE/DELETE para nadie salvo `service_role`.
- `rocas` deja de estar oculto: se elimina el filtro `VISIBLE_GAMES` (o se deja como alias directo a `GAMES`) y vuelve a listarse junto a `asteroids` en `/games`, home y salón, igual que antes de spec 04.
- Funciones centralizadas de acceso a datos vía Server Components con fetch directo al cliente de servidor de Supabase (sin capa de librería intermedia tipo `getGames()`).
- `app/games/page.tsx`, `app/page.tsx` (preview), `app/salon/page.tsx`, `app/juego/[id]/page.tsx`: leen `games` (y `scores` donde corresponda) desde Supabase en vez de `lib/data.ts`.
- `best` y `plays` por juego se calculan en query (agregación sobre `scores`: `MAX(score)`, `COUNT(*)`), no son columnas fijas.
- `lib/scores.ts` (`saveScore`): pasa a hacer `INSERT` en la tabla `scores` vía cliente de navegador de Supabase. Se elimina el guardado de score en `localStorage`.
- El nombre/iniciales que la persona escribe en el modal de fin de partida se recuerda en `localStorage` (ej. clave `av_player_name`) para prellenar el input la próxima vez — esto es la única persistencia local que queda, no reemplaza el guardado real en Supabase.
- Salón de la fama (`app/salon/page.tsx`) y detalle de juego (`app/juego/[id]/page.tsx`): reemplazan `seededScores` por el ranking real de `scores` (ordenado por score descendente) para el juego seleccionado.

**Out of scope (para specs futuras):**

- Autenticación real / `user_id` en `scores` — sigue sin login real, el mock de `providers.tsx` no se toca.
- Componente Asteroids en sí (ya implementado en spec 04) — no se modifica su motor.
- Edición/borrado de juegos desde una UI de administración.
- Paginación del leaderboard (se trae un TOP fijo, igual que hoy con `seededScores(seed, 12)`).
- Rate limiting o validación anti-cheat sobre el INSERT de scores.

## Data model

### Tabla `games`

```sql
create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  created_at timestamptz not null default now()
);

alter table games enable row level security;

create policy "games are publicly readable"
  on games for select
  to anon, authenticated
  using (true);
```

Seed (migración): las 12 filas actuales de `GAMES` en `lib/data.ts` (incluye `rocas` y `asteroids`), sin columnas `best`/`plays` — esas se calculan.

### Tabla `scores`

```sql
create table scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id),
  name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table scores enable row level security;

create policy "scores are publicly readable"
  on scores for select
  to anon, authenticated
  using (true);

create policy "anyone can submit a score"
  on scores for insert
  to anon, authenticated
  with check (true);
```

Sin seed — arranca vacía.

### Tipos TypeScript (locales, para las queries)

```ts
// lib/data.ts o donde se centralicen los tipos
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
}

export interface GameWithStats extends Game {
  best: number; // MAX(scores.score) por game_id, 0 si no hay filas
  plays: number; // COUNT(scores.*) por game_id
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // created_at formateado
}
```

## Implementation plan

1. Migración SQL (`apply_migration`) — tabla `games` + RLS + seed de los 12 juegos actuales (incluye `rocas`), tal como se definió en Data model.
2. Migración SQL (`apply_migration`) — tabla `scores` + RLS, sin seed.
3. Migración SQL (`apply_migration`) — vista `games_with_stats`:
   ```sql
   create view games_with_stats as
   select
     g.*,
     coalesce(max(s.score), 0) as best,
     count(s.id) as plays
   from games g
   left join scores s on s.game_id = g.id
   group by g.id;
   ```
   Las páginas que necesitan `best`/`plays` consultan esta vista en vez de `games` directo.
4. `lib/data.ts`: quitar `GAMES`, `VISIBLE_GAMES`, `PLAYERS`, `seededScores`. Dejar `Game` (sin `best`/`plays`), agregar `GameWithStats`, mantener `GameCategory`, `CATS`, `ScoreRow`.
5. `lib/scores.ts`: reemplazar `saveScore` (localStorage) por un insert real vía `createClient()` de `lib/supabase/client.ts`. Agregar `getSavedPlayerName()` / `setSavedPlayerName(name)` sobre `localStorage` (clave `av_player_name`) — solo para recordar el nombre tipeado, no el score.
6. `app/games/page.tsx`: separar en Server Component `page.tsx` (async, query a `games_with_stats`) + nuevo `components/games/library-client.tsx` (mueve ahí el filtro/búsqueda actual, recibe `games: GameWithStats[]` como prop). `GameCard` pasa a tipar `game: GameWithStats`.
7. `app/page.tsx`: separar en Server Component `page.tsx` (async, primeros 6 de `games_with_stats`) + `components/home/home-client.tsx` (todo el JSX/hooks actuales, recibe `games` como prop). `RECENT_SCORES` y `TOP_PLAYERS` quedan como están (fuera de scope).
8. `app/juego/[id]/page.tsx`: convertir a Server Component async (revisar `node_modules/next/dist/docs/01-app` por convención de `params` en Next 16 antes de escribir). Query del juego a `games_with_stats` por `id` (→ `notFound()` si no existe) y de los últimos/mejores 10 `scores` de ese juego (orden desc, `rank` calculado en JS). Si no hay scores, el leaderboard muestra "SIN PUNTUACIONES AÚN — SÉ EL PRIMERO".
9. `app/juego/[id]/jugar/page.tsx`: separar en Server Component `page.tsx` (fetch del juego por `id` en `games`, sin stats) + `components/games/game-player-client.tsx` (todo lo que hoy vive en este archivo). El input de iniciales se prellena con `getSavedPlayerName() ?? user?.name ?? "INVITADO"`; al guardar, llama `saveScore(...)` y `setSavedPlayerName(name)`.
10. `app/salon/page.tsx`: se mantiene como client component. Al montar, hace fetch de `games_with_stats` (cliente de navegador Supabase) para las tabs; cada cambio de `tab` dispara un fetch de los top 12 `scores` de ese juego (SELECT es público, no requiere Server Component). Reemplaza `seededScores`. Estado vacío igual que en el detalle de juego.
11. Verificación manual: `npm run dev`. Recorrer `/`, `/games` (buscar/filtrar, `rocas` visible de nuevo junto a `asteroids`), `/juego/asteroids` (leaderboard vacío al inicio), jugar una partida de Asteroids, guardar puntuación con iniciales, confirmar que aparece en `/juego/asteroids` y en `/salon`, confirmar `best`/`plays` en la card de `/games` reflejan ese score real. Reabrir el modal de fin de partida en otra sesión/pestaña y confirmar que el nombre viene precargado desde `localStorage`.
12. Cerrar con `npm run build` y `npm run lint`.

## Acceptance criteria

- [x] Tablas `games` y `scores` existen en Supabase con RLS habilitado (`get_advisors` sin warnings de seguridad críticos).
- [x] `games` contiene los 12 juegos actuales (incluye `rocas` y `asteroids`) tras la migración.
- [x] `scores` está vacía tras la migración (sin datos fake).
- [x] Vista `games_with_stats` devuelve `best`/`plays` correctos (0 si el juego no tiene partidas guardadas).
- [x] `/games` lista los 12 juegos (incluye `rocas` visible de nuevo), filtro por categoría y búsqueda por texto siguen funcionando igual que antes.
- [x] Home (`/`) muestra el preview de 6 juegos desde Supabase; el resto de la página (actividad, precios, etc.) no cambia.
- [x] `/juego/[id]` muestra detalle del juego real y leaderboard real (top scores de `scores` para ese juego); si no hay scores, muestra el mensaje de estado vacío.
- [x] `/juego/[id]/jugar` sigue funcionando igual que antes (HUD, pausa, fin de partida) pero con los datos del juego traídos de Supabase.
- [x] Guardar puntuación en el modal hace un `INSERT` real en `scores` (verificable con `execute_sql` o recargando `/juego/[id]`), ya no escribe en `av_scores` de `localStorage`.
- [x] El nombre tipeado en el modal de fin de partida se recuerda en `localStorage` (`av_player_name`) y precarga el input en la siguiente partida.
- [x] `/salon` reemplaza `seededScores` por scores reales; cambiar de tab consulta el juego correspondiente; estado vacío si un juego no tiene partidas.
- [x] Card de juego (`GameCard`) muestra `best` real (0 si no hay partidas) en vez del valor fijo anterior.
- [x] `npm run build` y `npm run lint` pasan sin errores.
- [x] Ninguna key de Supabase queda expuesta más allá de lo ya documentado en spec 03.

## Decisions

- **Sí:** Tablas `games` y `scores` creadas desde cero vía migración SQL (`apply_migration`), no existían en el proyecto Supabase real.
- **Sí:** `best`/`plays` calculados dinámicamente vía vista `games_with_stats` (agregación sobre `scores`), no columnas fijas en `games`. Mantiene los datos siempre consistentes con las partidas reales.
- **Sí:** `scores` sin seed — leaderboard arranca vacío. Decisión explícita del usuario tras reconsiderar: el sistema pasa a ser real, no tiene sentido mezclar datos fake con reales.
- **Sí:** RLS de `scores` con INSERT público (rol `anon`), sin validación adicional. Igual al comportamiento actual (cualquiera guarda su score sin login); rate limiting queda fuera de scope.
- **Sí:** Server Components con fetch directo por página, sin capa `lib/games.ts` centralizada. Decisión explícita del usuario — menos indirección, cada página resuelve su propio query.
- **Sí:** `rocas` vuelve a ser visible en los listados (se elimina el filtro `VISIBLE_GAMES`). Decisión explícita del usuario, revierte la decisión de spec 04.
- **Sí:** `plays` = `count(scores)` por juego. No hay tracking de sesiones ni columna manual — cada fila de `scores` ya representa una partida completada y guardada.
- **Sí:** `localStorage` (`av_player_name`) se conserva solo para recordar el nombre tipeado, no el score. Decisión explícita del usuario — comodidad de UX, no persistencia de datos de juego.
- **No:** `user_id` en `scores` ni autenticación real — queda para una spec de auth futura, explícito por el usuario.
- **No:** Paginación del leaderboard — se mantiene un TOP fijo (10-12), igual que con `seededScores`.
- **No:** Rate limiting o validación anti-cheat sobre el insert de scores — fuera de scope, mismo nivel de confianza que el sistema actual.

## Identified risks

- **INSERT público sin validación:** cualquiera puede insertar scores arbitrarios (score negativo, absurdamente alto, `game_id` inexistente salvo por la FK). Sin auth ni rate limit, el leaderboard es vulnerable a spam/trampa. Mitigación futura: constraint `check (score >= 0)` como mínimo, o mover a spec de auth.
- **Vista `games_with_stats` recalculada en cada query:** con pocos juegos/scores no es problema, pero si el volumen de `scores` crece mucho, el `group by` sin índice en `scores.game_id` puede volverse lento. Mitigación: agregar índice `create index on scores(game_id)` en la misma migración.
- **Server vs. Client Components en Next 16:** varias páginas hoy `"use client"` (`/juego/[id]`, `/juego/[id]/jugar`) se separan en Server+Client. Antes de escribir, revisar `node_modules/next/dist/docs/01-app` por convenciones de `params` async y límites de boundary — un error acá rompe rutas dinámicas enteras.
- **`rocas` vuelve a listarse duplicado con `asteroids`:** mismo `cover`, `short`/`long` casi idénticos (ver spec 04) — UX confusa de dos cards visualmente iguales. Decisión explícita del usuario, se deja registrado como riesgo conocido, no bloqueante.
- **Fetch client-side en `/salon` por cada cambio de tab:** doce juegos → doce fetches potenciales si el usuario recorre todas las tabs rápido. Sin debounce ni caché. Aceptable para el volumen actual, revisar si escala.
