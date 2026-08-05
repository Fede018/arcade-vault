# SPEC 07 — Arkanoid

> **Estado:** Implementado
> **Depende de:** 05-games-and-leaderboard
> **Fecha:** 2026-08-04
> **Objetivo:** Agregar Arkanoid al catálogo — motor porteado de `references/started-games/04-arkanoid`, jugable en `/juego/arkanoid/jugar` con leaderboard funcional.

## Scope

**In:**

- Fila en `games` (`id: arkanoid`, `cat: ARCADE`, `color: yellow`, `cover: cover-bricks`) vía `apply_migration`.
- Componente `components/games/arkanoid-game.tsx`, motor porteado de `references/started-games/04-arkanoid/game.js` + `levels.js`, contrato `GameEngineProps`.
- Registro en `components/games/registry.ts`: `arkanoid: ArkanoidGame`.
- Assets copiados a `public/games/arkanoid/`: `spritesheet-breakout.png`, `spritesheet.js`, `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3`. Carga async vía `loadSpritesheet(cb)` antes de arrancar el loop, con flag `cancelled` para desmonte durante la carga.
- Sonidos de rebote y rotura de bloque, vía `Audio()` (`cloneNode().play()` por instancia, igual que el original).
- Canvas 800×600 (ya 4:3, sin reescalar ni letterbox).
- Los 5 niveles de `levels.js` portados tal cual (bloques + velocidad progresiva ×1.0 a ×1.46).
- Controles: solo teclado (←→), con `preventDefault`.
- Vidas y nivel mapean directo al HUD (`lives` inicia en 3, `level` = `currentLevel`, sin transformación).
- Completar los 5 niveles dispara `onGameOver(score)` — mismo camino que perder todas las vidas.

**Out of scope (para specs futuras):**

- Control por mouse del paddle.
- Overlay de pausa propio con selector de nivel (botones dibujados/hit-testeados en canvas).
- Overlay de victoria distinto de game over ("¡Completaste el juego!").
- Táctil/mobile.
- Cambios a `lib/scores.ts`, `lib/supabase/*`, u otros juegos ya integrados.

## Data model

No se crean tablas nuevas (`games`/`scores` ya existen, spec 05). Solo una fila nueva:

```sql
insert into games (id, title, short, long, cat, cover, color)
values (
  'arkanoid',
  'Arkanoid',
  'Rompé bloques con paleta y pelota a través de 5 niveles.',
  'Clásico breakout: movés la paleta con las flechas para rebotar la pelota y destruir bloques. 3 vidas, 5 niveles con patrones distintos y velocidad creciente. Perder todas las vidas o completar el nivel 5 termina la partida.',
  'ARCADE',
  'cover-bricks',
  'yellow'
)
on conflict (id) do nothing;
```

Tipos: reusa `GameEngineState` / `GameEngineProps` de `components/games/engine-types.ts`. Sin tipos exportados nuevos. Estructuras internas del motor (`Paddle`, `Ball`, `Block`, `Explosion`, `Level`) quedan locales a `arkanoid-game.tsx`, no exportadas.

## Implementation plan

1. Migración `apply_migration` — insertar fila `arkanoid` en `games` (ver Data model).
2. Copiar `references/started-games/04-arkanoid/assets/spritesheet-breakout.png`, `spritesheet.js` y `assets/sounds/{ball-bounce,break-sound}.mp3` a `public/games/arkanoid/`.
3. `components/games/arkanoid-game.tsx` — portar el motor:
   - Un solo `useEffect(() => {...}, [])` dueño del loop; estado mutable (paddle, ball, blocks, explosions, score, lives, currentLevel) en variables locales del effect, no `useState`.
   - Refs espejo para `paused`, `onStateChange`, `onGameOver`.
   - `emitStateIfChanged()` compara contra `{score, lives, level}` previo, emite solo en cambios.
   - Adaptar `levels.js` (5 niveles) como constante local o import dentro del mismo archivo.
   - `loadSpritesheet(cb)` desde `/games/arkanoid/spritesheet.js` (ajustar rutas de assets dentro de `spritesheet.js` a `/games/arkanoid/spritesheet-breakout.png`), con flag `cancelled` chequeado en el callback.
   - Listener `keydown`/`keyup` solo para `ArrowLeft`/`ArrowRight`, `preventDefault()`. Sin mouse, sin `P`/`Escape`.
   - Sonido: `new Audio('/games/arkanoid/ball-bounce.mp3')` / `break-sound.mp3`, `cloneNode().play()` en cada rebote/rotura (permite solapar instancias como el original).
   - `draw()` sin HUD propio (sin score/vidas/nivel dibujados en canvas) y sin overlays de pausa/gameover/win — solo campo de juego (bloques, paddle, pelota, explosiones).
   - Fin de partida: `lives <= 0` **o** completar nivel 5 → `stopped = true`, emitir estado final, `onGameOverRef.current(score)`.
   - Canvas `width={800} height={600}` como atributos, `style={{maxWidth: "100%", height: "auto", display: "block"}}`.
   - Cleanup: remover listeners + `cancelAnimationFrame(rafId)`.
4. `components/games/registry.ts` — agregar `arkanoid: ArkanoidGame`.
5. Verificación manual: `/games` muestra la card (categoría ARCADE, filtro y búsqueda la encuentran), `/juego/arkanoid` muestra detalle + leaderboard vacío, `/juego/arkanoid/jugar` renderiza el motor real jugable solo con ←→, HUD en vivo refleja `onStateChange` (score/vidas/nivel), PAUSA congela (`draw()` sigue, `update()` no), perder 3 vidas o completar nivel 5 dispara el modal de fin de partida, guardar puntuación aparece en `/juego/arkanoid` y en `/salon`, `best`/`plays` en la card de `/games` reflejan el score guardado.
6. Cerrar con `npm run build` y `npm run lint`.

## Acceptance criteria

- [x] Fila `arkanoid` existe en `games` con `cat: ARCADE`, `color: yellow`, `cover: cover-bricks`.
- [x] `/games` muestra la card de Arkanoid, filtrable por categoría ARCADE y por búsqueda de texto.
- [x] `/juego/arkanoid` muestra detalle real y leaderboard vacío antes de la primera partida.
- [x] `/juego/arkanoid/jugar` renderiza el motor real dentro de `.crt-screen`, canvas 800×600 sin desbordar ni letterbox.
- [x] Solo `←`/`→` mueven la paleta; ninguna otra tecla del juego interfiere con la página (`preventDefault`).
- [x] Sprites (paddle, pelota, bloques, explosiones) se ven correctamente — assets cargan desde `public/games/arkanoid/`.
- [x] HUD superior (Jugador/Puntuación/Vidas/Nivel) refleja en tiempo real `onStateChange`; vidas inicia en 3, nivel en 1.
- [x] Bloques destruidos suman 10 pts y disparan animación de explosión.
- [x] Rebote de pelota y rotura de bloque reproducen sonido.
- [x] Completar todos los bloques de un nivel carga el siguiente (velocidad de pelota progresiva por nivel).
- [x] PAUSA congela el motor (paddle/pelota/bloques no se mueven); REANUDAR continúa sin salto.
- [x] Perder la 3ª vida dispara el modal de fin de partida con el score final correcto.
- [x] Completar el nivel 5 dispara el modal de fin de partida (mismo camino que game over).
- [x] Guardar puntuación hace INSERT real en `scores` (verificable recargando `/juego/arkanoid` o con `execute_sql`).
- [x] `/salon`, tab de Arkanoid, muestra el score guardado.
- [x] Card de `/games` refleja `best`/`plays` reales tras la partida.
- [x] Salir/desmontar detiene el loop (`cancelAnimationFrame`, sin listeners colgados).
- [x] `npm run build` y `npm run lint` pasan sin errores.

## Decisions

- **color: yellow** — `.btn` solo tiene variantes `.magenta`/`.yellow`; `cyan`/`green` caen al botón default sin estilo propio. Elegido `yellow` para tener botón "JUGAR" con estilo propio.
- **cover: cover-bricks (reuso)** — clase ya existe, semántica de bloques coincide con Arkanoid, sin CSS nuevo.
- **Canvas 800×600 sin reescalar** — ya es 4:3 (800/600 = 1.333), calza directo en `.crt-screen` sin letterbox ni ajuste de layout.
- **Vidas y nivel sin mapeo especial** — a diferencia de Tetris, el original ya tiene `lives` (inicia en 3) y `currentLevel` con semántica idéntica al HUD de la plataforma. Se pasan directo en `onStateChange`.
- **Solo teclado (←→), sin mouse** — consistencia con el resto del catálogo (Asteroids, Tetris no usan mouse); evita listener propio de `mousemove`/`getBoundingClientRect` y mantiene el port más simple.
- **Se descarta overlay de pausa propio con selector de nivel** — el shell ya tiene su botón PAUSA; el contrato `GameEngineProps` no tiene lugar para hit-test de botones en canvas. Saltar de nivel queda fuera de scope.
- **Se portean los sonidos** — rebote y rotura de bloque copiados a `public/games/arkanoid/`, reproducidos con `Audio()`/`cloneNode().play()`. Primer motor del catálogo con audio.
- **Se portea el spritesheet original** — mantiene el look and feel del juego de referencia; requiere copiar `assets/spritesheet-breakout.png` + `spritesheet.js` y gatear el loop detrás de `loadSpritesheet(cb)`.
- **Los 5 niveles completos** — `levels.js` se copia tal cual, sin recortar a MVP de un nivel.
- **Completar nivel 5 → `onGameOver` igual que derrota** — el contrato no distingue victoria de derrota; no se agrega un overlay de "victoria" distinto, el modal de fin de partida del shell cubre ambos casos.

## Identified risks

- **Rutas de assets en `spritesheet.js`**: el archivo original referencia `assets/spritesheet-breakout.png` con ruta relativa a `index.html`. Al copiar a `public/games/arkanoid/`, hay que ajustar esa ruta interna (o servir ambos archivos desde la misma carpeta y usar ruta relativa `spritesheet-breakout.png` si `spritesheet.js` la resuelve así). Verificar en el paso 3 antes de dar por cerrada la carga de assets.
- **Carga async antes del loop**: si el componente se desmonta mientras `loadSpritesheet` está en curso (usuario sale rápido de `/jugar`), el callback no debe arrancar `requestAnimationFrame` — cubierto por flag `cancelled`, pero es el punto más fácil de olvidar al portear.
