# Mapa de integración — juego nuevo en Arcade Vault

Hechos relevados del código (no suposiciones), a usar al escribir la spec.

## Catálogo y leaderboard viven en Supabase, no en código

`lib/data.ts` solo exporta tipos: `Game`, `GameWithStats`, `GameCategory`, `CATS`, `ScoreRow`. No hay array `GAMES` en el repo — agregar un juego significa insertar una fila en la tabla `games` (Supabase), no editar un archivo TS.

Tabla `games` (columnas): `id text PK`, `title`, `short`, `long`, `cat` (CHECK `ARCADE|PUZZLE|SHOOTER|VERSUS`), `cover`, `color` (CHECK `cyan|magenta|yellow|green`), `created_at`.

Tabla `scores`: `id uuid PK`, `game_id` (FK a `games`), `name`, `score`, `created_at`. RLS: SELECT e INSERT públicos, sin UPDATE/DELETE.

Vista `games_with_stats` = `games` + `best` (`max(scores.score)`, 0 si no hay filas) + `plays` (`count(scores.*)`), agregados por `game_id`.

## Quién consulta qué

- `app/page.tsx` (Server) — `games_with_stats`, primeros 6 por `id`.
- `app/games/page.tsx` (Server) — `games_with_stats` completo → `components/games/library-client.tsx` (filtro/búsqueda).
- `app/salon/page.tsx` (Client) — `games_with_stats` para tabs, `scores` top 12 por tab.
- `app/juego/[id]/page.tsx` (Server) — `games_with_stats` por `id` (`notFound()` si no existe), `scores` top 10 por `game_id`.
- `app/juego/[id]/jugar/page.tsx` (Server) — `games` directo (sin stats) por `id` → `components/games/game-player-client.tsx`.

Un juego nuevo aparece automáticamente en las cinco vistas apenas existe la fila en `games` — ninguna de estas páginas necesita tocarse.

## Clientes Supabase

- `lib/supabase/client.ts` → `createClient()` **sync**, browser (`createBrowserClient`).
- `lib/supabase/server.ts` → `createClient()` **async, requiere `await`**, server (`createServerClient` + `cookies()`).

## Scores — ya resuelto, no tocar

`lib/scores.ts`:

- `saveScore({ game, score, name })` — insert en `scores` vía cliente browser.
- `getSavedPlayerName()` / `setSavedPlayerName(name)` — `localStorage` key `av_player_name`, recuerda el nombre tipeado (no el score).

`components/games/game-player-client.tsx` ya llama a `saveScore` con `game_id: game.id` al guardar el modal de fin de partida. Un juego nuevo no requiere ningún cambio acá — el `id` de la fila en `games` es todo lo que hace falta.

## Dispatcher de motores

`components/games/registry.ts` — `Record<string, ComponentType<GameEngineProps>>` por `game.id`. `game-player-client.tsx` hace `const Engine = GAME_ENGINES[game.id]`; si existe, renderiza el motor real; si no, cae al mock (`grid-floor`/`enemy`/`player-ship`, ticker de score falso). Agregar un juego real = una línea en este registry + el componente del motor.

Contrato (`components/games/engine-types.ts`):

```ts
export type GameEngineState = { score: number; lives: number; level: number };
export type GameEngineProps = {
  paused: boolean;
  onStateChange: (state: GameEngineState) => void;
  onGameOver: (finalScore: number) => void;
};
```

## CSS

`app/globals.css`:

- Cover art (`:396-510` aprox., sección "Cover art generators") — 8 clases existentes: `.cover-bricks`, `.cover-tetro`, `.cover-snake`, `.cover-glot`, `.cover-invaders`, `.cover-rocas`, `.cover-rana`, `.cover-duelo`. Todas pure-CSS (`::before`/`::after`), sin imágenes. Una `cover` sin clase correspondiente renderiza una card vacía.
- `.crt-screen` — `aspect-ratio: 4/3`, `overflow: hidden`, fondo negro. Canvas con otra proporción letterboxea o se recorta.
- `.game-arena` — `position: absolute; inset: 0`, flex centrado; ahí monta el motor (o el mock).
- `.btn` — variantes de color solo `.magenta` y `.yellow`. `cyan`/`green` como `color` del juego no tienen botón a juego; cae al `.btn` default.

## Player HUD (fijo, no se toca por juego)

`components/games/game-player-client.tsx` — HUD con Jugador/Puntuación/Vidas(`♥` repetido)/Nivel, botones PAUSA/FIN/SALIR, modal de fin de partida con input de iniciales. Todo esto es genérico y ya funciona para cualquier motor que cumpla `GameEngineProps` — un juego nuevo no lo modifica, solo lo alimenta vía `onStateChange`/`onGameOver`.
