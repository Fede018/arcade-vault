# SPEC 06 — Tetris

> **Estado:** Aprobado
> **Depende de:** 05-games-and-leaderboard
> **Fecha:** 2026-08-04
> **Objetivo:** Agregar Tetris como motor jugable real (piezas estándar, rotación simple, next piece, HUD interno propio) integrado al catálogo y leaderboard de Arcade Vault.

## Scope

**In:**

- Fila en tabla `games`: `id: tetris`, `title: Tetris`, `short/long` según acordado, `cat: PUZZLE`, `cover: cover-tetro` (reuso), `color: magenta` — vía `apply_migration`.
- Componente `components/games/tetris-game.tsx`, motor construido de cero (sin referencia), contrato `GameEngineProps`.
- Registro en `components/games/registry.ts`: `tetris: TetrisGame`.
- Sin clase CSS nueva (reusa `.cover-tetro`).
- Canvas único 4:3 (ej. `600×450`): grid de juego 10×20 a la izquierda + panel lateral con next-piece y HUD interno propio (score/líneas/nivel), dibujado por el motor.
- Mapeo HUD superior: `lives` fijo en `1` (game over directo al perder), `level` sube cada 10 líneas, `score` clásico `100/300/500/800 × nivel` según líneas simultáneas.
- Controles: `←/→` mover, `↓` soft drop, `↑` rotar (rotación simple, sin wall-kicks/SRS), todos con `preventDefault`.

**Out of scope (para specs futuras):**

- Táctil/mobile, sonido, hold piece, wall-kicks/SRS, ghost piece, pausa por tecla propia (usa botón PAUSA del shell), hard drop.
- Cambios a `lib/scores.ts`, `lib/supabase/*`, o a otros juegos ya integrados — no se tocan.

## Data model

No se crean tablas nuevas (`games`/`scores` ya existen, spec 05). Solo una fila nueva:

```sql
insert into games (id, title, short, long, cat, cover, color)
values (
  'tetris',
  'Tetris',
  'Encajá las piezas antes que se acumulen',
  'Clásico de bloques: rotá y acomodá tetrominós para completar líneas antes que el stack llegue al tope.',
  'PUZZLE',
  'cover-tetro',
  'magenta'
)
on conflict (id) do nothing;
```

Tipos: reusa `GameEngineState`/`GameEngineProps` de `components/games/engine-types.ts` sin modificar. Tipos internos del motor (pieza, tablero, tetrominó) quedan locales a `tetris-game.tsx`, no exportados.

Mapeo `GameEngineState` (interno del motor → contrato):

- `score`: acumulado clásico (100/300/500/800 × nivel por 1/2/3/4 líneas).
- `lives`: fijo `1`.
- `level`: `floor(líneas_completadas / 10) + 1`.

## Implementation plan

1. Migración `apply_migration` — insertar fila `tetris` (ver Data model).
2. Sin cambio en `app/globals.css` (reusa `.cover-tetro` existente).
3. `components/games/tetris-game.tsx`:
   - Un solo `useEffect` dueño del loop (`requestAnimationFrame`), estado mutable (tablero 10×20, pieza activa, next piece, score, líneas, nivel, timers de caída) en variables locales del effect, no `useState`.
   - Refs espejo para `paused`/`onStateChange`/`onGameOver`, sincronizados en effects separados con deps `[paused]` etc.
   - 7 tetrominós estándar (I,O,T,S,Z,J,L), rotación simple (sin wall-kicks, rotación se cancela si colisiona).
   - Gravedad: intervalo de caída decrece por nivel (velocidad clásica progresiva).
   - `emitStateIfChanged()` compara `{score, lives:1, level}` contra valores previos, emite solo si cambió.
   - Canvas único `600×450`: grid de juego (izquierda) + panel lateral con next-piece y HUD interno propio (score/líneas/nivel) dibujado en el mismo canvas — **excepción documentada** al patrón estándar (el motor sí dibuja su propio HUD, además del HUD superior de React).
   - Fin de partida: pieza nueva no entra en spawn (colisión inmediata) → `stopped = true`, emitir estado final, `onGameOverRef.current(score)`.
   - Listeners `keydown`/`keyup` en `window` para `←/→/↓/↑` con `preventDefault`; cleanup + `cancelAnimationFrame` en el return del effect.
   - `style={{maxWidth: "100%", height: "auto", display: "block"}}` para escalar dentro de `.crt-screen`.
4. `components/games/registry.ts` — agregar `tetris: TetrisGame`.
5. Verificación manual: `/games` muestra card Tetris (filtro PUZZLE y búsqueda la encuentran), `/juego/tetris` detalle + leaderboard vacío, `/juego/tetris/jugar` motor real jugable, HUD superior refleja `onStateChange` (vidas siempre 1), HUD interno del canvas muestra next-piece/score/líneas/nivel, PAUSA congela (draw sigue, update no), perder dispara modal de fin de partida, guardar puntuación aparece en `/juego/tetris` y `/salon`, `best`/`plays` en card de `/games` reflejan el score guardado.
6. Cerrar con `npm run build` y `npm run lint`.

## Acceptance criteria

- [ ] Fila `tetris` existe en `games` con `cat: PUZZLE`, `color: magenta`, `cover: cover-tetro`.
- [ ] `/games` muestra card Tetris, filtrable por PUZZLE y por búsqueda de texto.
- [ ] `/juego/tetris` muestra detalle real y leaderboard vacío antes de la primera partida.
- [ ] `/juego/tetris/jugar` renderiza el motor real dentro de `.crt-screen`, escalado sin desbordar.
- [ ] Controles `←/→/↓/↑` no scrollean la página (`preventDefault`).
- [ ] HUD superior (Jugador/Puntuación/Vidas/Nivel) refleja `onStateChange`; Vidas siempre `1`.
- [ ] HUD interno del canvas (score/líneas/nivel/next-piece) visible y actualizado en vivo.
- [ ] PAUSA congela el motor (draw sigue, update no); REANUDAR continúa sin salto.
- [ ] Al llenarse el stack (spawn imposible), dispara modal de fin de partida con score final correcto.
- [ ] Nivel sube cada 10 líneas completadas; velocidad de caída aumenta acorde.
- [ ] Puntaje sigue esquema `100/300/500/800 × nivel` según líneas simultáneas.
- [ ] Guardar puntuación hace INSERT real en `scores` (verificable en `/juego/tetris` o `execute_sql`).
- [ ] `/salon`, tab Tetris, muestra el score guardado.
- [ ] Card de `/games` refleja `best`/`plays` reales tras la partida.
- [ ] Salir/desmontar detiene el loop (`cancelAnimationFrame`, sin listeners colgados).
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisions

- **id/title**: `tetris` / `Tetris` — nombre estándar, sin ambigüedad.
- **cat: PUZZLE** — encaja género, sin discusión.
- **color: magenta** — usuario eligió estilo propio de botón (no default) en vez de cyan/green.
- **cover: cover-tetro (reuso)** — clase ya existente dibuja tetrominós de colores, coincide con el juego real, sin trabajo CSS extra.
- **Rotación simple, sin wall-kicks/SRS** — menos código, alcanza para el scope.
- **Next piece sí, hold no** — hold agrega complejidad de estado sin pedido explícito.
- **Vidas fijas en 1** — Tetris no tiene vidas; game over directo al perder simplifica el mapeo al HUD fijo de la plataforma.
- **Nivel cada 10 líneas** — estándar clásico, referencia conocida.
- **Puntaje clásico simplificado (100/300/500/800 × nivel)** — balance entre fidelidad y simplicidad de implementación.
- **Solo soft drop, sin hard drop** — decisión explícita del usuario, reduce superficie de controles.
- **Canvas 4:3 (600×450) con grid + panel lateral** — evita letterbox/recorte, aprovecha el ancho para next-piece.
- **HUD interno propio dentro del canvas (score/líneas/nivel/next-piece)** — override explícito del default de plataforma (que dice "el motor dibuja solo el campo de juego"); usuario pidió conservar el HUD de Tetris tal cual, conviviendo con el HUD superior de React que sigue alimentado vía `onStateChange` por contrato.

## Identified risks

- **HUD duplicado**: mostrar score/nivel tanto en el HUD superior de React como dentro del canvas puede generar la sensación de info repetida o, si algún cálculo diverge entre el dibujo interno y `onStateChange`, inconsistencia visual entre ambos. Mitigación: ambos HUDs deben leer del mismo estado interno del motor (una sola fuente de verdad), no recalcular por separado.
- **Rotación simple sin wall-kicks**: piezas cerca del borde o de otras piezas pueden no poder rotar en situaciones donde SRS sí lo permitiría — comportamiento esperado y aceptado, no bug.
