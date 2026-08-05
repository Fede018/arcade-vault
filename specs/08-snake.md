# SPEC 08 — Snake

> **Estado:** Implementado
> **Depende de:** 05-games-and-leaderboard
> **Fecha:** 2026-08-04
> **Objetivo:** Agregar Snake al catálogo — motor construido de cero (sin código de referencia), sprites de frutas propios, jugable en `/juego/snake/jugar` con leaderboard funcional.

## Scope

**In:**

- Fila en tabla `games` (`id: snake`, `title: Snake`, `short: Comé frutas, no choques`, `long: <descripción más extensa>`, `cat: ARCADE`, `color: magenta`, `cover: cover-snake` — reusa clase existente) vía `apply_migration`.
- Componente `components/games/snake-game.tsx`, motor construido de cero (sin referencia) siguiendo contrato `GameEngineProps`.
- Registro en `components/games/registry.ts`: `snake: SnakeGame`.
- Assets copiados a `public/games/snake/`: `fruits.png`, `sprites.js` (atlas `SPRITE_ATLAS.fruits`, 21 frutas).
- Carga async del atlas antes de arrancar el loop (gate, flag `cancelled` en desmonte), mismo patrón que Arkanoid.
- Canvas 800×800 (cuadrado), grilla de celdas fija dentro, letterboxeado dentro de `.crt-screen` (4:3) — bandas laterales aceptadas.
- Movimiento por grilla (tick discreto), controles: flechas + WASD, `preventDefault`.
- Choque contra pared o contra el propio cuerpo = game over.
- Fruta comida: +10 puntos (igual para las 21 variantes, elegida random en cada spawn), serpiente crece un segmento, velocidad del tick sube ligeramente (curva de dificultad progresiva).
- Sonido básico al comer fruta (`Audio()`, mismo patrón `cloneNode().play()` que Arkanoid) — asset a definir/generar en implementación.
- HUD: `lives` fijo en `1` (game over directo al chocar), `level` fijo en `1` (sin progresión de nivel, la dificultad sube por velocidad de tick, no por `level`).

**Out of scope (para specs futuras):**

- Táctil/mobile.
- Wrap-around de bordes (pared siempre mata).
- Puntaje diferenciado por tipo de fruta.
- Niveles/progresión reportada en HUD `level`.
- Cambios a `lib/scores.ts`, `lib/supabase/*`, u otros juegos ya integrados.

## Data model

No se crean tablas nuevas (`games`/`scores` ya existen, spec 05). Solo una fila nueva:

```sql
insert into games (id, title, short, long, cat, cover, color)
values (
  'snake',
  'Snake',
  'Comé frutas, no choques.',
  'Guiá la serpiente por el tablero, comé frutas para crecer y sumar puntos. Cada fruta acelera un poco el ritmo del juego. Chocar contra la pared o contra tu propio cuerpo termina la partida.',
  'ARCADE',
  'cover-snake',
  'magenta'
)
on conflict (id) do nothing;
```

Tipos: reusa `GameEngineState` / `GameEngineProps` de `components/games/engine-types.ts`, sin tipos nuevos exportados. Tipos internos del motor (posición de segmentos, dirección, fruta activa) quedan locales a `snake-game.tsx`.

## Implementation plan

1. Migración `apply_migration` — insertar la fila del juego (ver Data model).
2. `app/globals.css` — confirmar reuso de `.cover-snake` existente (sin cambios de CSS acá).
3. Copiar assets a `public/games/snake/`: `fruits.png`, `sprites.js`.
4. `components/games/snake-game.tsx` — motor de cero siguiendo `references/porting-guide.md`:
   - Un solo `useEffect` dueño del loop; estado mutable (grilla, serpiente, dirección, fruta activa, score, velocidad de tick) en variables locales del effect, no `useState`.
   - Refs espejo para `paused`/`onStateChange`/`onGameOver`.
   - Movimiento por tick discreto (no `dt` continuo): intervalo de tick decrece con cada fruta comida (curva de velocidad).
   - Carga async del atlas (`sprites.js` + `fruits.png`) antes de arrancar el loop, con flag `cancelled` para desmonte durante la carga — mismo patrón `loadSpritesheet` de Arkanoid.
   - Selección random de una de las 21 frutas del atlas en cada spawn.
   - Colisión con pared o cuerpo propio → `stopped = true`, emitir estado final, `onGameOverRef.current(score)`.
   - `emitStateIfChanged()`: `lives` y `level` fijos en `1`, solo `score` cambia.
   - Listeners `keydown` en `window` para flechas + WASD, `preventDefault`, cleanup en el return del effect junto a `cancelAnimationFrame`.
   - Guard de dirección: ignorar un cambio de dirección directamente opuesto a la actual dentro del mismo tick (evita auto-colisión inintuitiva por doble tecla).
   - Canvas 800×800 fijo como atributos, `style={{maxWidth: "100%", height: "auto", display: "block"}}`.
   - Sonido de comer fruta vía `Audio()` + `cloneNode().play()`.
5. `components/games/registry.ts` — agregar `snake: SnakeGame`.
6. Verificación manual: `/games` muestra la card nueva (filtro por categoría ARCADE y búsqueda la encuentran), `/juego/snake` muestra detalle + leaderboard vacío ("SIN PUNTUACIONES AÚN"), `/juego/snake/jugar` renderiza el motor real y es jugable con teclado (flechas y WASD), HUD en vivo refleja `onStateChange`, PAUSA congela, chocar dispara el modal de fin de partida, guardar puntuación aparece en `/juego/snake` y en `/salon`, `best`/`plays` en la card de `/games` reflejan el score guardado.
7. Cerrar con `npm run build` y `npm run lint`.

## Acceptance criteria

- [x] Fila `snake` existe en `games` con `cat: ARCADE`, `color: magenta`, `cover: cover-snake`.
- [x] `/games` muestra la card del juego, filtrable por categoría ARCADE y por búsqueda de texto.
- [x] `/juego/snake` muestra detalle real y leaderboard vacío antes de la primera partida.
- [x] `/juego/snake/jugar` renderiza el motor real dentro de `.crt-screen`, canvas 800×800 escalado/letterboxeado sin desbordar el layout.
- [x] Atlas de frutas (`fruits.png`/`sprites.js`) carga antes de arrancar el loop; desmontar durante la carga no rompe nada.
- [x] Controles de teclado (flechas + WASD) mueven la serpiente y no scrollean la página (`preventDefault`).
- [x] Comer fruta: crece la serpiente, suma 10 puntos, sube la velocidad de tick, dispara sonido.
- [x] Frutas mostradas son variedad random entre las 21 del atlas.
- [x] Chocar contra pared o contra el propio cuerpo dispara game over.
- [x] HUD superior (Jugador/Puntuación/Vidas/Nivel) refleja `onStateChange` en tiempo real; Vidas y Nivel se muestran fijos en 1.
- [x] PAUSA congela el motor; REANUDAR continúa sin salto ni pérdida de dirección.
- [x] Fin de partida (choque, o botón FIN) dispara el modal con el score final correcto.
- [x] Guardar puntuación hace INSERT real en `scores` (verificable recargando `/juego/snake` o con `execute_sql`).
- [x] `/salon`, tab del juego, muestra el score guardado.
- [x] Card de `/games` refleja `best`/`plays` reales tras la partida.
- [x] Salir/desmontar detiene el loop (`cancelAnimationFrame`, listeners y `Audio` sin colgar).
- [x] `npm run build` y `npm run lint` pasan sin errores.

## Decisions

- **Sin código de referencia:** motor construido de cero, no hay `references/started-games/` para Snake. Único insumo externo son los sprites de frutas (`fruits.png` + `sprites.js`).
- **cat: ARCADE** — Snake es arcade clásico, no encaja en PUZZLE/SHOOTER/VERSUS.
- **color: magenta** — `cyan`/`green` (más temáticos para Snake) caen al botón `.btn` default sin estilo propio; se prioriza consistencia visual sobre temática de color.
- **cover: cover-snake (reuso)** — ya existe en `globals.css`, pure-CSS, sin necesidad de clase nueva.
- **lives fijo en 1:** Snake clásico no tiene vidas: chocar termina la partida directo. Reportar `1` fijo es la salida más simple sin tocar el HUD compartido (mismo criterio que Tetris según `porting-guide.md`).
- **level fijo en 1:** sin progresión de nivel en el sentido del HUD; la dificultad se expresa como velocidad de tick creciente, no como `level`. Evita inventar una métrica de nivel artificial.
- **Canvas 800×800 con letterbox:** decisión explícita del usuario — grilla cuadrada con celdas más grandes, aceptando bandas laterales dentro de `.crt-screen` (4:3) en vez de reescalar a rectángulo o forzar una grilla no cuadrada.
- **Pared mata (sin wrap-around):** Snake arcade clásico, consistente con "chocar = game over" del resto del catálogo.
- **Frutas random entre 21, mismo puntaje (10):** variedad visual del atlas completo sin la complejidad de tabla de valores por fruta.
- **Velocidad progresiva:** cada fruta comida acelera el tick — curva de dificultad clásica de Snake, evita partidas indefinidamente lentas.
- **Sonido básico al comer:** único sonido agregado al scope, mismo patrón `Audio()`/`cloneNode().play()` que Arkanoid; asset de audio queda por definir en implementación (no bloquea la spec).
- **Controles: flechas + WASD:** cobertura estándar, consistente con otros motores del catálogo.

## Identified risks

- **Aspect ratio 800×800 en `.crt-screen` 4:3:** letterbox lateral aceptado, pero verificar visualmente que no queda desproporcionado ni corta HUD/controles en pantallas chicas.
- **Input buffer de dirección:** si el usuario apreta dos teclas de dirección opuestas en el mismo tick (ej. derecha luego izquierda antes del próximo tick), puede causar auto-colisión inmediata inintuitiva — implementar guard que ignore un cambio de dirección directamente opuesto a la actual dentro del mismo tick.
- **Asset de audio inexistente:** no hay sonido de "comer fruta" provisto (solo `fruits.png`/`sprites.js`); hay que generar o conseguir un asset corto en implementación, o el criterio de aceptación de sonido queda bloqueado.
- **Carga async del atlas:** si `fruits.png` falla en cargar, el loop no debe arrancar en estado roto — replicar gate + manejo de error de Arkanoid (`loadSpritesheet(cb)` con flag `cancelled`).
