"use client";

import { useEffect, useRef } from "react";
import type { GameEngineState, GameEngineProps } from "./engine-types";

const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const EXPLOSION_DURATION = 150;

type Paddle = { x: number; y: number; w: number; h: number };
type Ball = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
};
type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
};
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
};
type Level = {
  speed: number;
  blocks: { col: number; row: number; color: string }[];
};

const LEVELS: Level[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: Level["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: Level["blocks"] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: Level["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: Level["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: Level["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

type SpriteFrame = { sx: number; sy: number; sw: number; sh: number };

// EXPLOSION_FRAMES vive como `const` de scope global en spritesheet.js: en un
// <script> clásico eso no queda expuesto en `window`, así que se duplica acá
// (misma tabla que el original) para poder consumirla desde React.
const EXPLOSION_FRAMES: Record<string, SpriteFrame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

type SpritesheetGlobals = {
  loadSpritesheet: (cb: () => void) => void;
  drawSprite: (
    ctx: CanvasRenderingContext2D,
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void;
  drawFrame: (
    ctx: CanvasRenderingContext2D,
    frame: SpriteFrame,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void;
};

let spritesheetScriptPromise: Promise<void> | null = null;

function ensureSpritesheetScript(): Promise<void> {
  if (!spritesheetScriptPromise) {
    spritesheetScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "/games/arkanoid/spritesheet.js";
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  }
  return spritesheetScriptPromise;
}

function loadArkanoidSpritesheet(
  onReady: () => void,
  isCancelled: () => boolean,
) {
  ensureSpritesheetScript().then(() => {
    const w = window as unknown as Partial<SpritesheetGlobals>;
    w.loadSpritesheet?.(() => {
      if (!isCancelled()) onReady();
    });
  });
}

const CAPTURED_CODES: Record<string, boolean> = {
  ArrowLeft: true,
  ArrowRight: true,
};

export type ArkanoidState = GameEngineState;
export type ArkanoidGameProps = GameEngineProps;

export default function ArkanoidGame({
  paused,
  onStateChange,
  onGameOver,
}: ArkanoidGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const onStateChangeRef = useRef(onStateChange);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d");
    if (!canvas || !ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    let cancelled = false;

    const bounceSound = new Audio("/games/arkanoid/ball-bounce.mp3");
    const breakSound = new Audio("/games/arkanoid/break-sound.mp3");
    const playBounce = () =>
      void (bounceSound.cloneNode(true) as HTMLAudioElement).play();
    const playBreak = () =>
      void (breakSound.cloneNode(true) as HTMLAudioElement).play();

    const keys: Record<string, boolean> = {
      ArrowLeft: false,
      ArrowRight: false,
    };

    const paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
    const ball: Ball = {
      x: 0,
      y: 0,
      w: 16,
      h: 16,
      vx: BASE_BALL_VX,
      vy: BASE_BALL_VY,
    };
    let blocks: Block[] = [];
    let explosions: Explosion[] = [];
    let score = 0;
    let lives = 3;
    let currentLevel = 1;
    let stopped = false;
    let lastTime: number | null = null;
    let rafId = 0;

    let prevScore = -1;
    let prevLives = -1;
    let prevLevel = -1;

    function emitStateIfChanged() {
      if (
        score !== prevScore ||
        lives !== prevLives ||
        currentLevel !== prevLevel
      ) {
        prevScore = score;
        prevLives = lives;
        prevLevel = currentLevel;
        onStateChangeRef.current({ score, lives, level: currentLevel });
      }
    }

    function initPaddle() {
      paddle.x = (W - paddle.w) / 2;
    }

    function loadLevel(n: number) {
      currentLevel = n;
      const level = LEVELS[n - 1];
      blocks = level.blocks.map((b) => ({
        x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
        y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
        w: BLOCK_W,
        h: BLOCK_H,
        color: b.color,
        alive: true,
      }));
      explosions = [];
      ball.x = paddle.x + (paddle.w - ball.w) / 2;
      ball.y = paddle.y - ball.h;
      ball.vx = BASE_BALL_VX * level.speed;
      ball.vy = BASE_BALL_VY * level.speed;
    }

    function collideAABB(block: Block) {
      return (
        ball.x < block.x + block.w &&
        ball.x + ball.w > block.x &&
        ball.y < block.y + block.h &&
        ball.y + ball.h > block.y
      );
    }

    function update(dt: number) {
      if (stopped) return;

      if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
      if (keys.ArrowRight)
        paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x <= 0) {
        ball.x = 0;
        ball.vx = Math.abs(ball.vx);
        playBounce();
      }
      if (ball.x + ball.w >= W) {
        ball.x = W - ball.w;
        ball.vx = -Math.abs(ball.vx);
        playBounce();
      }
      if (ball.y <= 0) {
        ball.y = 0;
        ball.vy = Math.abs(ball.vy);
        playBounce();
      }

      if (
        ball.vy > 0 &&
        ball.x + ball.w > paddle.x &&
        ball.x < paddle.x + paddle.w &&
        ball.y + ball.h >= paddle.y &&
        ball.y + ball.h <= paddle.y + paddle.h + 8
      ) {
        ball.y = paddle.y - ball.h;
        ball.vy = -Math.abs(ball.vy);
        playBounce();
      }

      for (const block of blocks) {
        if (!block.alive) continue;
        if (collideAABB(block)) {
          block.alive = false;
          explosions.push({
            x: block.x,
            y: block.y,
            w: block.w,
            h: block.h,
            color: block.color,
            elapsed: 0,
          });
          score += 10;
          ball.vy = -ball.vy;
          playBreak();
          if (blocks.every((b) => !b.alive)) {
            if (currentLevel < 5) {
              loadLevel(currentLevel + 1);
            } else {
              stopped = true;
              emitStateIfChanged();
              onGameOverRef.current(score);
            }
          }
          break;
        }
      }

      for (const exp of explosions) exp.elapsed += dt * 1000;
      explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

      if (ball.y > H) {
        lives--;
        if (lives <= 0) {
          lives = 0;
          stopped = true;
          emitStateIfChanged();
          onGameOverRef.current(score);
        } else {
          ball.x = paddle.x + (paddle.w - ball.w) / 2;
          ball.y = paddle.y - ball.h;
          const speed = LEVELS[currentLevel - 1].speed;
          ball.vx = BASE_BALL_VX * speed;
          ball.vy = BASE_BALL_VY * speed;
        }
      }

      emitStateIfChanged();
    }

    function draw() {
      const w = window as unknown as Partial<SpritesheetGlobals>;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      if (!w.drawSprite || !w.drawFrame) return;

      for (const block of blocks) {
        if (block.alive)
          w.drawSprite(
            ctx,
            "block_" + block.color,
            block.x,
            block.y,
            block.w,
            block.h,
          );
      }

      for (const exp of explosions) {
        const frameIndex = Math.min(
          Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
          3,
        );
        w.drawFrame(
          ctx,
          EXPLOSION_FRAMES[exp.color][frameIndex],
          exp.x,
          exp.y,
          exp.w,
          exp.h,
        );
      }

      w.drawSprite(ctx, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
      w.drawSprite(ctx, "ball", ball.x, ball.y, ball.w, ball.h);
    }

    function loop(ts: number) {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      if (!pausedRef.current && !stopped) update(dt);
      draw();
      if (!stopped) rafId = requestAnimationFrame(loop);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!CAPTURED_CODES[e.key]) return;
      e.preventDefault();
      keys[e.key] = true;
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (!CAPTURED_CODES[e.key]) return;
      e.preventDefault();
      keys[e.key] = false;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    loadArkanoidSpritesheet(
      () => {
        initPaddle();
        loadLevel(1);
        emitStateIfChanged();
        rafId = requestAnimationFrame(loop);
      },
      () => cancelled,
    );

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
    />
  );
}
