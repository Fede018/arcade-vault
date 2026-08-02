# SPEC 04 — Juego Asteroids jugable

> **Estado:** Aprobado
> **Depende de:** 03-supabase-integration
> **Fecha:** 2026-08-02
> **Objetivo:** Integrar el juego Asteroids de `references/started-games/02-asteroids` como juego real jugable ("ASTEROIDS") en `/juego/asteroids/jugar`, reemplazando el mock de partida por el motor real en canvas, sincronizado con el HUD y el guardado de puntuación existentes.

## Scope

**In:**

- `lib/data.ts`: agregar nueva entrada a `GAMES` con `id: "asteroids"`, `title: "ASTEROIDS"`, `cat: "SHOOTER"`, `cover: "cover-rocas"` (reutiliza el CSS existente sin renombrar clases), más `short`/`long`/`color`/`best`/`plays` propios. La entrada `rocas` existente **no se toca**.
- Nuevo componente `components/games/asteroids-game.tsx` (client component): puerto a React/TS del motor de `references/started-games/02-asteroids/game.js` (clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, loop `requestAnimationFrame`, wrap toroidal, colisiones). El canvas dibuja **solo el campo de juego** (nave, asteroides, balas, partículas, power-up) — sin HUD ni overlay de game over propios (esos se quitan del `draw()` original).
- El componente expone props: `paused: boolean`, `onStateChange(state: { score, lives, level })` (llamado cuando cambia alguno de esos valores) y `onGameOver(finalScore: number)` (llamado cuando `lives` llega a 0).
- `app/juego/[id]/jugar/page.tsx`: cuando `id === "asteroids"`, renderiza `AsteroidsGame` dentro de `crt-screen` en vez de los `div` mock (`grid-floor`/`enemy`/`player-ship`), conecta `paused` al estado existente del botón PAUSA, `onStateChange` actualiza `score`/`level`/`lives` reales (reemplazando el `setInterval` falso que solo corre para los demás juegos), y `onGameOver` dispara el mismo flujo de fin de partida que ya existe (`over = true`, modal con input de iniciales y `saveScore`). El botón FIN fuerza el fin de partida con el score actual (mismo camino que `onGameOver`). Para el resto de los juegos (`id !== "asteroids"`) el comportamiento mock actual queda intacto.
- Controles de teclado (flechas + espacio) capturados solo mientras el componente está montado (listeners agregados/removidos en `useEffect`), con `preventDefault()` para evitar scroll de la página.

**Out of scope (para specs futuras):**

- Controles táctiles/mobile (el juego solo es jugable con teclado por ahora).
- Leaderboard real: `/juego/asteroids` sigue mostrando `seededScores` (fake). No se lee `av_scores` de localStorage para mostrar el leaderboard.
- Persistencia de scores en Supabase (sigue en `localStorage` vía `saveScore`, sin cambios).
- Cualquier otro juego del listado (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`, `rocas`) — quedan con su mock actual, sin tocar.
- Balanceo/gameplay distinto al original (dificultad, power-ups, puntajes) — se porta tal cual está en `game.js`.

## Data model

No se crean tablas ni persistencia nueva. Se agrega una entrada al array existente `GAMES` (`lib/data.ts`) y se definen tipos locales al componente del juego.

```ts
// lib/data.ts — nueva entrada en GAMES
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Pulveriza asteroides en gravedad cero.",
  long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Recoge el power-up de disparo triple antes de que expire.",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "yellow",
  best: 41200,
  plays: "15.6K",
}
```

```ts
// components/games/asteroids-game.tsx — tipos locales
type AsteroidsState = {
  score: number;
  lives: number;
  level: number;
};

type AsteroidsGameProps = {
  paused: boolean;
  onStateChange: (state: AsteroidsState) => void;
  onGameOver: (finalScore: number) => void;
};
```

`app/juego/[id]/jugar/page.tsx` reutiliza sus estados existentes (`score`, `level`, `over`, `saved`, etc. — ya tipados como `number`/`boolean`) sin agregar tipos nuevos; solo cambia su fuente (real vs. mock) según `id === "asteroids"`.

## Implementation plan

1. `lib/data.ts`: agregar la entrada `asteroids` a `GAMES` (ver Data model). Verificar que `/games` muestra la nueva card y `/juego/asteroids` renderiza detalle + leaderboard fake sin errores.
2. Crear `components/games/asteroids-game.tsx`: portar `references/started-games/02-asteroids/game.js` a un componente cliente TS.
   - Clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` y constantes (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD`) se portan igual, tipadas.
   - `W`/`H` fijos en 800×600, canvas con `max-width: 100%; height: auto` para escalar dentro de `crt-screen`.
   - `draw()` deja de llamar `drawHUD()`/`drawOverlay()`; solo dibuja partículas, asteroides, power-ups, balas y nave.
   - `update(dt)` se mantiene igual, pero cada vez que cambian `score`/`lives`/`level` se invoca `onStateChange({ score, lives, level })`.
   - `killShip()`: cuando `lives <= 0`, en vez de setear `state = 'gameover'` interno con overlay propio, invoca `onGameOver(score)` y detiene el loop (no reinicia con `initGame()` automáticamente — eso lo controla el padre vía remount o botón "JUGAR DE NUEVO").
   - Prop `paused`: el loop de `requestAnimationFrame` sigue pidiendo frames, pero si `paused` es `true` no llama `update(dt)` (congela nave/asteroides/balas; `draw()` sigue corriendo para no perder el último frame).
   - Listeners de teclado (`keydown`/`keyup`) se agregan en `useEffect` al montar y se remueven al desmontar; cada handler llama `e.preventDefault()` para `ArrowLeft/ArrowRight/ArrowUp/Space` y evitar scroll de página.
   - Cleanup: `cancelAnimationFrame` al desmontar.
3. `app/juego/[id]/jugar/page.tsx`:
   - Si `game.id === "asteroids"`: renderizar `<AsteroidsGame paused={paused} onStateChange={...} onGameOver={...} />` dentro de `.game-arena` en vez de los `div` mock (`grid-floor`/`enemy`/`player-ship`).
   - `onStateChange` actualiza `score`/`level` (y un nuevo state `lives` real, reemplazando el `useState(3)` fijo actual) vía `setScore`/`setLevel`/`setLives`.
   - `onGameOver(finalScore)` llama `endGame()` (ya existente) asegurando que `score` quede en `finalScore` antes de abrir el modal.
   - El `useEffect` del `setInterval` falso (incremento aleatorio de score) y el `useEffect` de subir nivel por score (`score % 2500`) se condicionan a `game.id !== "asteroids"` — para `asteroids` esos valores vienen de `onStateChange`.
   - Botón FIN (`endGame`): para `asteroids`, además de `setOver(true)`, debe detener el loop del juego (vía prop `paused` forzado a `true` al abrir el modal, o un prop adicional `stopped`).
4. Verificar manualmente: abrir `/juego/asteroids/jugar`, jugar con teclado (rotar, empujar, disparar), confirmar HUD superior (Jugador/Puntuación/Vidas/Nivel) refleja el estado real del juego en vivo, botón PAUSA congela el juego y REANUDAR lo retoma sin saltos, perder las 3 vidas abre el modal con el score final correcto, guardar con iniciales persiste en `localStorage` (`av_scores`) con `game: "asteroids"`, botón "JUGAR DE NUEVO" reinicia una partida nueva desde cero, botón SALIR/VOLVER AL VAULT no deja el loop corriendo en segundo plano (sin errores de canvas tras desmontar). Confirmar que los demás juegos (mock) siguen funcionando igual que antes.
5. Cerrar con `npm run build` y `npm run lint`.

## Acceptance criteria

- [ ] `GAMES` en `lib/data.ts` incluye la entrada `asteroids` (id/title/cat/cover/etc.); `rocas` sigue existiendo sin cambios.
- [ ] `/games` muestra la card "ASTEROIDS" junto a las demás, filtrable por categoría SHOOTER y por búsqueda de texto.
- [ ] `/juego/asteroids` muestra detalle del juego y leaderboard fake (`seededScores`), sin errores de consola.
- [ ] `/juego/asteroids/jugar` renderiza el canvas del juego real (nave, asteroides, controles) dentro de `crt-screen`, escalado sin desbordar el layout.
- [ ] Teclado (`←` `→` `↑` `Espacio`) controla la nave; no hace scroll de la página al presionar esas teclas.
- [ ] HUD superior (Jugador/Puntuación/Vidas/Nivel) refleja en tiempo real el score, vidas y nivel del juego real (no valores mock).
- [ ] Botón PAUSA congela el juego (nave/asteroides/balas quedan quietos); REANUDAR continúa sin salto brusco de posición.
- [ ] Perder las 3 vidas dispara automáticamente el modal de fin de partida con el score final correcto.
- [ ] Botón FIN también dispara el modal de fin de partida con el score actual y detiene el juego.
- [ ] Guardar puntuación en el modal persiste en `localStorage` bajo `av_scores` con `game: "asteroids"`, score y nombre correctos.
- [ ] Botón "JUGAR DE NUEVO" reinicia una partida nueva (score/vidas/nivel en cero, asteroides reposicionados).
- [ ] Navegar a "VOLVER AL VAULT" o "SALIR" detiene el loop del juego (no quedan `requestAnimationFrame` corriendo tras desmontar el componente).
- [ ] Los demás juegos del listado (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`, `rocas`) siguen mostrando el comportamiento mock actual sin cambios.
- [ ] `npm run build` y `npm run lint` pasan sin errores.

## Decisions

- **Sí:** Nueva entrada `asteroids` en `GAMES`, dejando `rocas` intacto. Decisión explícita del usuario — son juegos distintos, no un reemplazo.
- **Sí:** `id`/`title` en inglés (`asteroids` / `ASTEROIDS`), aunque el resto del catálogo está en español. Decisión explícita del usuario.
- **Sí:** Reutilizar `lib/data.ts` (no crear `app/data/games.ts`). Evita romper imports existentes (`games/page.tsx`, `game-card.tsx`, `juego/[id]/page.tsx`, `juego/[id]/jugar/page.tsx`) sin beneficio claro.
- **Sí:** Reutilizar la clase CSS `cover-rocas` para la card de `asteroids` en vez de crear una nueva. Mismo estilo temático (asteroides), evita duplicar CSS.
- **Sí:** Canvas dibuja solo el campo de juego; el HUD en vivo lo maneja React vía `onStateChange`. Decisión explícita del usuario — mantiene consistencia visual con el resto de la plataforma en vez de mezclar dos HUDs.
- **Sí:** `onGameOver` como único puente hacia el modal de fin de partida existente, reutilizando el flujo de guardado de score (`saveScore`) tal cual está. No se duplica lógica de persistencia.
- **Sí:** Pausa real detiene el `update(dt)` del loop (nave/asteroides/balas congelados), no solo oculta la UI. Decisión explícita del usuario.
- **No:** Controles táctiles/mobile. Fuera de scope — decisión explícita del usuario, se evalúa en spec futura.
- **No:** Leaderboard real leyendo `localStorage`. `/juego/asteroids` sigue con `seededScores` fake — cambiarlo implica decidir cómo mezclar/ordenar puntajes reales vs. fake, fuera de esta spec.
- **No:** Persistencia en Supabase. La spec 03 dejó explícito que las tablas de juegos/puntajes son trabajo futuro; esta spec no las toca.
- **No:** Modificar el mock de los demás juegos. Cambiarlo sería scope creep — cada juego se porta en su propia spec cuando corresponda.

## Identified risks

- **Next 16 breaking changes:** el patrón `requestAnimationFrame` + listeners de teclado en `useEffect` es estándar de React, pero conviene chequear `node_modules/next/dist/docs/01-app` por si hay convenciones nuevas sobre client components pesados en canvas (hydration, `use client` boundaries) antes de portar el motor.
- **Fuga de loop entre partidas:** si `AsteroidsGame` no limpia bien `cancelAnimationFrame` y listeners al desmontar (navegación a "SALIR"/"VOLVER AL VAULT" o cambiar de juego), puede quedar el loop corriendo en segundo plano o listeners duplicados si se vuelve a montar. Mitigación: cleanup explícito en el `useEffect` y verificación manual en el paso 4 del plan.
- **Desincronización de `onStateChange`:** si se llama en cada frame (60/s) en vez de solo cuando cambia el valor, puede generar renders de más en el HUD. Mitigación: comparar contra el valor previo antes de invocar el callback.
- **Reinicio de partida (`initGame()`):** el motor original reinicia solo con `Space` en `state === 'gameover'`; al mover ese control a React (botón "JUGAR DE NUEVO"), hay que asegurar que el componente vuelva a un estado limpio (remount con `key` distinta, o método expuesto para reiniciar) sin arrastrar asteroides/balas de la partida anterior.
