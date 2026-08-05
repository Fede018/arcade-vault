"use client";

import { useEffect, useRef } from "react";
import type { GameEngineState, GameEngineProps } from "./engine-types";

const W = 800;
const H = 800;
const CELL = 20;
const COLS = W / CELL;
const ROWS = H / CELL;

const TICK_START_MS = 150;
const TICK_MIN_MS = 60;
const TICK_STEP_MS = 4;

type Dir = { x: number; y: number };
const UP: Dir = { x: 0, y: -1 };
const DOWN: Dir = { x: 0, y: 1 };
const LEFT: Dir = { x: -1, y: 0 };
const RIGHT: Dir = { x: 1, y: 0 };

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: UP,
  ArrowDown: DOWN,
  ArrowLeft: LEFT,
  ArrowRight: RIGHT,
  w: UP,
  W: UP,
  s: DOWN,
  S: DOWN,
  a: LEFT,
  A: LEFT,
  d: RIGHT,
  D: RIGHT,
};

type SpriteFrame = { x: number; y: number; w: number; h: number };
type SpriteAtlas = { fruits: Record<string, SpriteFrame> };

let spritesScriptPromise: Promise<void> | null = null;

function ensureSpritesScript(): Promise<void> {
  if (!spritesScriptPromise) {
    spritesScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "/games/snake/sprites.js";
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  }
  return spritesScriptPromise;
}

function loadFruitsImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "/games/snake/fruits.png";
  });
}

function loadSnakeAssets(
  onReady: (img: HTMLImageElement, atlas: SpriteAtlas) => void,
  isCancelled: () => boolean,
) {
  Promise.all([ensureSpritesScript(), loadFruitsImage()]).then(([, img]) => {
    if (isCancelled()) return;
    const w = window as unknown as { SPRITE_ATLAS?: SpriteAtlas };
    if (!w.SPRITE_ATLAS) return;
    onReady(img, w.SPRITE_ATLAS);
  });
}

export type SnakeState = GameEngineState;
export type SnakeGameProps = GameEngineProps;

export default function SnakeGame({
  paused,
  onStateChange,
  onGameOver,
}: SnakeGameProps) {
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

    const eatSound = new Audio("/games/snake/eat-sound.wav");
    const playEat = () =>
      void (eatSound.cloneNode(true) as HTMLAudioElement).play();

    let snake: { x: number; y: number }[] = [];
    let dir: Dir = RIGHT;
    let pendingDir: Dir = RIGHT;
    let fruit: { x: number; y: number; key: string } | null = null;
    let fruitKeys: string[] = [];
    let score = 0;
    let stopped = false;
    let tickMs = TICK_START_MS;
    let accMs = 0;
    let lastTime: number | null = null;
    let rafId = 0;

    let fruitsImg: HTMLImageElement | null = null;
    let atlas: SpriteAtlas | null = null;

    let prevScore = -1;
    let prevLives = -1;
    let prevLevel = -1;

    function emitStateIfChanged() {
      const lives = 1;
      const level = 1;
      if (score !== prevScore || lives !== prevLives || level !== prevLevel) {
        prevScore = score;
        prevLives = lives;
        prevLevel = level;
        onStateChangeRef.current({ score, lives, level });
      }
    }

    function occupied(x: number, y: number) {
      return snake.some((s) => s.x === x && s.y === y);
    }

    function spawnFruit() {
      let x = 0;
      let y = 0;
      do {
        x = Math.floor(Math.random() * COLS);
        y = Math.floor(Math.random() * ROWS);
      } while (occupied(x, y));
      const key = fruitKeys[Math.floor(Math.random() * fruitKeys.length)];
      fruit = { x, y, key };
    }

    function initGame() {
      const startX = Math.floor(COLS / 2);
      const startY = Math.floor(ROWS / 2);
      snake = [
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY },
        { x: startX - 3, y: startY },
      ];
      dir = RIGHT;
      pendingDir = RIGHT;
      score = 0;
      tickMs = TICK_START_MS;
      accMs = 0;
      stopped = false;
      spawnFruit();
    }

    function step() {
      if (stopped) return;

      if (!(pendingDir.x === -dir.x && pendingDir.y === -dir.y)) {
        dir = pendingDir;
      }

      const head = snake[0];
      const newHead = { x: head.x + dir.x, y: head.y + dir.y };

      if (
        newHead.x < 0 ||
        newHead.x >= COLS ||
        newHead.y < 0 ||
        newHead.y >= ROWS
      ) {
        stopped = true;
        emitStateIfChanged();
        onGameOverRef.current(score);
        return;
      }

      if (occupied(newHead.x, newHead.y)) {
        stopped = true;
        emitStateIfChanged();
        onGameOverRef.current(score);
        return;
      }

      snake.unshift(newHead);

      if (fruit && newHead.x === fruit.x && newHead.y === fruit.y) {
        score += 10;
        tickMs = Math.max(TICK_MIN_MS, tickMs - TICK_STEP_MS);
        playEat();
        spawnFruit();
      } else {
        snake.pop();
      }

      emitStateIfChanged();
    }

    function update(dt: number) {
      if (stopped) return;
      accMs += dt * 1000;
      while (accMs >= tickMs && !stopped) {
        accMs -= tickMs;
        step();
      }
    }

    function draw() {
      ctx.fillStyle = "#0a0a18";
      ctx.fillRect(0, 0, W, H);

      if (fruit && fruitsImg && atlas) {
        const frame = atlas.fruits[fruit.key];
        if (frame) {
          ctx.drawImage(
            fruitsImg,
            frame.x,
            frame.y,
            frame.w,
            frame.h,
            fruit.x * CELL,
            fruit.y * CELL,
            CELL,
            CELL,
          );
        }
      }

      snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? "#ff00ff" : "#c400c4";
        ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
      });
    }

    function loop(ts: number) {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      if (!pausedRef.current && !stopped) update(dt);
      draw();
      if (!stopped) rafId = requestAnimationFrame(loop);
    }

    function handleKeyDown(e: KeyboardEvent) {
      const newDir = KEY_TO_DIR[e.key];
      if (!newDir) return;
      e.preventDefault();
      pendingDir = newDir;
    }

    window.addEventListener("keydown", handleKeyDown);

    loadSnakeAssets(
      (img, loadedAtlas) => {
        fruitsImg = img;
        atlas = loadedAtlas;
        fruitKeys = Object.keys(loadedAtlas.fruits);
        initGame();
        emitStateIfChanged();
        rafId = requestAnimationFrame(loop);
      },
      () => cancelled,
    );

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
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
