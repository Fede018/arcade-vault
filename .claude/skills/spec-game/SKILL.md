---
name: spec-game
description: Diseña la spec de un juego nuevo para Arcade Vault — motor jugable + integración con catálogo y leaderboard de Supabase. Portea desde references/started-games o define uno de cero. Genera specs/NN-slug.md en estado Draft.
disable-model-invocation: true
argument-hint: "nombre del juego o carpeta de references/started-games (ej. 03-tetris)"
---

# /spec-game — Diseñador de spec para un juego nuevo

Variante de `/spec` especializada en el circuito completo de un juego en Arcade Vault: motor jugable + fila en el catálogo Supabase + leaderboard. **No escribís código ni tocás Supabase acá.** Tu trabajo es levantar la información técnica del motor (de referencia o de cero), hacer las preguntas de integración que este proyecto siempre necesita, y dejar una spec en `specs/NN-slug.md` lista para `/spec-impl`.

## Filosofía

Cada juego nuevo repite el mismo circuito de integración (fila en `games`, clase CSS de cover, componente motor con un contrato de props fijo, registro en el dispatcher). Este skill existe para que ese circuito no se re-descubra a mano cada vez ni se salteen decisiones (categoría, color, cómo mapear "vidas"/"nivel" si el juego original no los tiene). Igual que `/spec`: lento en la fase de definición, rápido al escribir.

Leé `template.md` (misma carpeta) para la estructura de salida. Leé `references/integration-map.md` y `references/porting-guide.md` (misma carpeta) — son la base factual de las preguntas de abajo, no las repitas de memoria ni las inventes.

## Comando

Seguí las cuatro fases en orden. No las saltees. Tus respuestas van en el idioma del prompt inicial del usuario.

### Fase 1 — Contexto

1. Leer `CLAUDE.md` / `AGENTS.md` del proyecto (advertencia de Next 16 breaking changes — relevante si el motor toca APIs de Next, normalmente no).
2. Listar `specs/` para determinar el próximo número secuencial.
3. Leer `references/integration-map.md` y `references/porting-guide.md` de este skill.
4. Si `$ARGUMENTS` nombra una carpeta de `references/started-games/` (ej. `03-tetris`, `04-arkanoid`): leer su `index.html`, `game.js`, y `CLAUDE.md`/`README.md` si existen. Extraé de ahí, sin preguntar: tamaño de canvas, si el HUD/overlay original vive en DOM o en canvas, qué controles de teclado usa, qué assets externos carga (sprites/sonidos) y si el loop arranca sync o detrás de una carga async. Estos datos alimentan las preguntas de la Fase 2 — no se le preguntan al usuario si ya están en el código.
5. Si el juego no viene de una referencia (`$ARGUMENTS` vacío o describe algo de cero), todo el árbol de decisión sale de las preguntas de Fase 2.

### Fase 2 — Preguntas en bloques de 3 a 5

Igual que `/spec`: bloques, no una por una, esperar respuesta antes de seguir. Usá estas siete categorías, en este orden. Saltéalas solo si ya las respondió el código de referencia leído en Fase 1 (decilo explícito: "esto lo tomo de `game.js`: X" en vez de preguntarlo).

1. **Identidad y catálogo** — va como fila en la tabla `games` (ver `integration-map.md`):
   - `id` (slug, minúsculas, sin espacios — es la PK y el nombre del componente/ruta).
   - `title`, `short`, `long`.
   - `cat`: uno de `ARCADE | PUZZLE | SHOOTER | VERSUS` (CHECK constraint en la tabla, no hay quinta opción).
   - `color`: uno de `cyan | magenta | yellow | green`. Advertí: `.btn` en `globals.css` solo tiene variantes `.magenta` y `.yellow` — si se elige `cyan`/`green`, el botón "JUGAR" de la card cae al estilo default. Preguntar si eso es aceptable o si prefieren `magenta`/`yellow`.
   - `cover`: ¿reusa una de las 8 clases `.cover-*` existentes (`bricks, tetro, snake, glot, invaders, rocas, rana, duelo`) o necesita una `.cover-<slug>` nueva en `app/globals.css`?

2. **Origen del motor** — carpeta de `references/started-games/` o de cero. Si es de referencia: qué se portea tal cual (reglas de juego, física, colisiones) y qué se descarta explícitamente (theme toggle, controles de mouse hit-testeados en canvas, audio, etc. — ver risks típicos en `porting-guide.md`).

3. **Mapeo al HUD fijo de la plataforma** — el HUD de `game-player-client.tsx` siempre muestra Jugador / Puntuación / Vidas / Nivel, alimentado por `onStateChange({score, lives, level})`. Si el original no tiene "vidas" (ej. Tetris) o no tiene "nivel" en el mismo sentido: decidir qué valor se reporta (fijo, `0`, o mapeado a otra métrica del juego — ej. líneas completadas como "nivel"). Esta decisión es obligatoria y va en la spec tal cual se acuerde, no se asume.

4. **HUD/overlay propios del original** — confirmar dónde vive hoy (DOM aparte, o dibujado en el mismo canvas) y que se elimina del motor porteado: el HUD lo dibuja React (arriba), pausa/game over los overlays existentes de `game-player-client.tsx` (`.crt-content`, `.modal-bd`). El motor porteado dibuja **solo el campo de juego**.

5. **Canvas y aspecto** — `.crt-screen` tiene `aspect-ratio: 4/3` y `overflow: hidden`. Si el canvas original no es 4:3 (ej. Tetris 300×600 portrait), decidir: reescalar el campo de juego a 4:3, dejar que letterboxee, o ajustar el layout. Sin esta decisión el juego puede recortarse.

6. **Assets y controles** — sprites/sonidos externos: ¿se copian a `public/games/<slug>/`? ¿Qué pasa si tardan o fallan en cargar (gate antes de arrancar el loop, como hace Arkanoid con `loadSpritesheet`)? Qué teclas captura el juego (para `preventDefault` y no scrollear la página).

7. **Cierre de scope** — qué queda explícitamente fuera (táctil/mobile, niveles adicionales, sonido, animaciones extra) y qué decisiones ya están cerradas y no se reabren.

**Cuando falte info:** preguntá concreto, no abierto. Si ofrecés opciones, marcá cuál recomendás y por qué.

**Cuándo parar de preguntar:** cuando puedas responder sin asumir: qué archivos van a aparecer o cambiar, cuál es el primer y el último paso ejecutable, y cómo se verifica que el juego quedó integrado.

### Fase 3 — Desarrollar la spec sección por sección

No generar todo de una. Usar `template.md` como esqueleto y completar cada sección, mostrarla, y preguntar "¿Esta sección queda así o la ajustamos?" antes de pasar a la siguiente. Orden:

1. Header (Estado: `Draft`, Depende de, Fecha, Objetivo en una frase).
2. Scope (In / Out).
3. Data model (fila de `games`, reuso de `GameEngineState`/`GameEngineProps` de `components/games/engine-types.ts` — no redefinir tipos).
4. Implementation plan (partir del esqueleto de `template.md`, ajustar pasos al juego concreto).
5. Acceptance criteria (checklist verificable, partir del esqueleto).
6. Decisions (con la justificación de cada Sí/No, especialmente las de los bloques 3 y 5 de preguntas).
7. Identified risks (solo si aplican).

### Fase 4 — Guardar

1. Determinar el próximo número secuencial de `specs/`.
2. Slug corto derivado del `id` del juego.
3. Confirmar el nombre de archivo con el usuario antes de escribir.
4. Crear `specs/NN-slug.md` en estado `Draft`.
5. Seedear `specs/.spec-config.yml` si no existe, igual que hace `/spec` (no pisarlo si ya existe).
6. Confirmar ruta creada, recordar que sigue en `Draft` hasta que el usuario la revise y la pase a `Approved`, y que el siguiente paso es `/spec-impl NN-slug`.
7. **Parar ahí.** No proponer implementar, no escribir código, no tocar Supabase.

## Reglas duras

- Nunca escribir código ni correr `apply_migration` durante este comando — eso es trabajo de `/spec-impl`, la spec solo lo describe.
- Nunca asumir `cat`/`color`/`cover`/mapeo de HUD — son decisiones explícitas del usuario, siempre.
- Nunca generar la spec completa en una sola respuesta — sección por sección, con confirmación.
- Si `$ARGUMENTS` no matchea ninguna carpeta de `references/started-games/`, tratarlo como nombre/descripción del juego de cero, no como error.
