# Guía de porteo — de `game.js` vanilla al contrato de la plataforma

Patrón extraído de `components/games/asteroids-game.tsx` (motor real ya integrado). Seguir esta estructura porta consistentemente cualquier juego canvas + `requestAnimationFrame`.

## Estructura del componente

- Un solo `useEffect(() => { ... }, [])` es dueño de todo el loop. Estado mutable del juego (nave, asteroides, score, lives, level, timers) vive en variables locales de ese effect — **no** en `useState` (evitaría re-renders de React en cada frame).
- Props (`paused`, `onStateChange`, `onGameOver`) se espejan en refs (`pausedRef`, `onStateChangeRef`, `onGameOverRef`), sincronizados en `useEffect`s separados con deps `[paused]` etc. Así el effect principal mantiene deps `[]` y no se re-crea el loop en cada render.
- `emitStateIfChanged()`: compara el nuevo `{score, lives, level}` contra el valor previo guardado (`prevScore`, `prevLives`, `prevLevel`) y solo llama `onStateChangeRef.current(...)` si cambió algo. Nunca emitir en cada frame — serían 60 llamadas/segundo.
- `loop(ts)`:
  ```
  dt = min((ts - lastTime) / 1000, 0.05)
  if (!pausedRef.current && !stopped) update(dt)
  draw()
  if (!stopped) rafId = requestAnimationFrame(loop)
  ```
  `draw()` sigue corriendo en pausa (para no perder el último frame en pantalla); `update(dt)` no.
- Fin de partida: cuando la condición de derrota del juego se cumple, setear `stopped = true`, emitir el estado final, y llamar `onGameOverRef.current(score)`. El motor **no reinicia solo** — el padre (`game-player-client.tsx`) remonta el componente con un `key` distinto (botón "JUGAR DE NUEVO").
- Listeners de teclado en `window` (`keydown`/`keyup`), con `e.preventDefault()` sobre el set de códigos que el juego captura (para no scrollear la página). Cleanup explícito: remover listeners + `cancelAnimationFrame(rafId)` en el return del effect.
- Canvas: `width`/`height` fijos como atributos (no CSS) — definen la resolución interna del campo de juego. `style={{maxWidth: "100%", height: "auto", display: "block"}}` para que escale dentro de `.crt-screen` sin desbordar.

## Qué se descarta del original al portear

Estos juegos de referencia (`references/started-games/`) suelen traer cosas que ya resuelve el shell de la plataforma — no se portean:

- **HUD propio** (DOM aparte como en Tetris, o dibujado en el mismo canvas como en Arkanoid) — React lo dibuja arriba vía `onStateChange`.
- **Overlays de pausa/game over** (DOM o canvas) — los pone `game-player-client.tsx` (`.crt-content`, `.modal-bd`).
- **Botones o controles dibujados en el canvas** (ej. Arkanoid dibuja botones de "saltar de nivel" y los hit-testea con coordenadas de mouse en pausa) — no hay lugar para eso en el contrato; si el juego los necesita, es una decisión de spec explícita, no un default.
- **Persistencia/tema propios** (ej. Tetris guarda tema claro/oscuro en `localStorage`) — fuera del contrato, la plataforma ya tiene su propio localStorage (`av_player_name`).
- **Reinicio automático por tecla** (ej. `Space` en `state === 'gameover'`) — el reinicio lo dispara el botón "JUGAR DE NUEVO" del padre vía remount.

## Casos especiales a resolver en la spec, no en el código

- **Sin "vidas" en el original** (ej. Tetris no tiene vidas, termina cuando el stack se llena): decidir qué reporta `onStateChange.lives` — típicamente un valor fijo (ej. `1`, y `onGameOver` se dispara directo al perder) o se omite del HUD visualmente (no es posible sin tocar el HUD compartido, así que el valor fijo es la salida más simple).
- **Assets externos con carga async** (ej. Arkanoid: `loadSpritesheet(cb)` antes de arrancar `requestAnimationFrame`): el `useEffect` debe cubrir el caso de desmontar antes de que la carga termine (flag `cancelled` chequeado en el callback antes de arrancar el loop).
- **Aspect ratio distinto a 4:3** (ej. Tetris 300×600 portrait vs. `.crt-screen` `aspect-ratio: 4/3`): decidir en la spec si se reescala el campo de juego, se acepta letterbox, o se ajusta el layout — no asumir.
- **Controles con mouse** (ej. Arkanoid mueve la paleta con el mouse): siguen funcionando si el `canvasRef` tiene su propio `mousemove` listener con `getBoundingClientRect()` para escalar coordenadas — pero confirmar en la spec si se mantiene o se reemplaza por teclado para consistencia con el resto del catálogo.
