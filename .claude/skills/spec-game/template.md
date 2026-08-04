# SPEC NN — <Título del juego>

> **Estado:** Draft
> **Depende de:** 05-games-and-leaderboard
> **Fecha:** <fecha>
> **Objetivo:** <una frase — qué juego se agrega y dónde queda jugable>

## Scope

**In:**

- Fila en la tabla `games` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`) vía `apply_migration`.
- Componente `components/games/<slug>-game.tsx`, motor porteado de `references/started-games/<carpeta>/game.js` (o construido de cero) siguiendo el contrato `GameEngineProps` (`components/games/engine-types.ts`).
- Registro en `components/games/registry.ts`: `<slug>: <Slug>Game`.
- Clase `.cover-<slug>` en `app/globals.css` (sección "Cover art generators") — o nota explícita de qué clase existente se reusa.
- <ajustar: assets, controles, mapeo de HUD específicos del juego>

**Out of scope (para specs futuras):**

- <lo que se descarta explícitamente del original, ej. controles táctiles, sonido, niveles extra>
- Cambios a `lib/scores.ts`, `lib/supabase/*`, o a otros juegos ya integrados — no se tocan.

## Data model

No se crean tablas nuevas (`games`/`scores` ya existen, spec 05). Solo una fila nueva:

```sql
insert into games (id, title, short, long, cat, cover, color)
values ('<slug>', '<TITLE>', '<short>', '<long>', '<CAT>', 'cover-<slug-o-existente>', '<color>')
on conflict (id) do nothing;
```

Tipos: reusa `GameEngineState` / `GameEngineProps` de `components/games/engine-types.ts`. Sin tipos nuevos salvo que el motor necesite tipos internos propios (clases del juego), que quedan locales al archivo del componente, no exportados.

## Implementation plan

1. Migración `apply_migration` — insertar la fila del juego (ver Data model).
2. `app/globals.css` — agregar `.cover-<slug>` (o confirmar reuso de una clase existente).
3. <si aplica> Copiar assets a `public/games/<slug>/`.
4. `components/games/<slug>-game.tsx` — portar el motor siguiendo `references/porting-guide.md` de este skill: un solo `useEffect` dueño del loop, refs espejo para `paused`/callbacks, `onStateChange` solo en cambios, `onGameOver` en vez de reinicio interno, cleanup de listeners y `cancelAnimationFrame`.
5. `components/games/registry.ts` — agregar `<slug>: <Slug>Game`.
6. Verificación manual: `/games` muestra la card nueva (filtro por categoría y búsqueda la encuentran), `/juego/<slug>` muestra detalle + leaderboard vacío ("SIN PUNTUACIONES AÚN"), `/juego/<slug>/jugar` renderiza el motor real y es jugable con teclado, HUD en vivo refleja `onStateChange`, PAUSA congela, perder/terminar dispara el modal de fin de partida, guardar puntuación aparece en `/juego/<slug>` y en `/salon`, `best`/`plays` en la card de `/games` reflejan el score guardado.
7. Cerrar con `npm run build` y `npm run lint`.

## Acceptance criteria

- [ ] Fila `<slug>` existe en `games` con `cat`/`color`/`cover` correctos.
- [ ] `/games` muestra la card del juego, filtrable por su categoría y por búsqueda de texto.
- [ ] `/juego/<slug>` muestra detalle real y leaderboard vacío antes de la primera partida.
- [ ] `/juego/<slug>/jugar` renderiza el motor real dentro de `.crt-screen`, escalado sin desbordar el layout.
- [ ] Controles de teclado del juego no scrollean la página (`preventDefault` en las teclas capturadas).
- [ ] HUD superior (Jugador/Puntuación/Vidas/Nivel) refleja en tiempo real `onStateChange`.
- [ ] PAUSA congela el motor; REANUDAR continúa sin salto.
- [ ] Fin de partida (game over del motor, o botón FIN) dispara el modal con el score final correcto.
- [ ] Guardar puntuación hace INSERT real en `scores` (verificable recargando `/juego/<slug>` o con `execute_sql`).
- [ ] `/salon`, tab del juego, muestra el score guardado.
- [ ] Card de `/games` refleja `best`/`plays` reales tras la partida.
- [ ] Salir/desmontar detiene el loop (`cancelAnimationFrame`, sin listeners colgados).
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisions

- <cada Sí/No de las preguntas de identidad, mapeo de HUD, canvas/aspecto — con justificación>

## Identified risks

- <si aplica: aspect ratio distinto a 4:3, assets async, controles que colisionan con atajos de la página, etc.>
