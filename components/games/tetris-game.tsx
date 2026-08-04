"use client";

import { useEffect, useRef } from "react";
import type { GameEngineState, GameEngineProps } from "./engine-types";

const W = 600;
const H = 450;

const COLS = 10;
const ROWS = 20;
const CELL = 20;
const BOARD_X = 20;
const BOARD_Y = 25;

const PANEL_X = 260;

type Matrix = number[][];
type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

const SHAPES: Record<PieceType, Matrix> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const COLORS: Record<PieceType, string> = {
  I: "#0ff",
  O: "#ff0",
  T: "#f0f",
  S: "#0f0",
  Z: "#f33",
  J: "#39f",
  L: "#fa3",
};

const TYPES: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];
const LINE_SCORES = [0, 100, 300, 500, 800];

function cloneMatrix(m: Matrix): Matrix {
  return m.map((row) => row.slice());
}

function rotateMatrix(m: Matrix): Matrix {
  const n = m.length;
  const result = cloneMatrix(m);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      result[x][n - 1 - y] = m[y][x];
    }
  }
  return result;
}

type Piece = {
  type: PieceType;
  matrix: Matrix;
  color: string;
  x: number;
  y: number;
};

function randomType(): PieceType {
  return TYPES[Math.floor(Math.random() * TYPES.length)];
}

function spawnPiece(type: PieceType): Piece {
  const matrix = cloneMatrix(SHAPES[type]);
  const n = matrix.length;
  return {
    type,
    matrix,
    color: COLORS[type],
    x: Math.floor((COLS - n) / 2),
    y: 0,
  };
}

type Board = (string | null)[][];

function createBoard(): Board {
  return Array.from({ length: ROWS }, () =>
    Array<string | null>(COLS).fill(null),
  );
}

function collides(
  matrix: Matrix,
  offX: number,
  offY: number,
  board: Board,
): boolean {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const bx = offX + x;
      const by = offY + y;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

const CAPTURED_CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

const DAS_DELAY = 0.17;
const DAS_REPEAT = 0.05;

export type TetrisState = GameEngineState;
export type TetrisGameProps = GameEngineProps;

export default function TetrisGame({
  paused,
  onStateChange,
  onGameOver,
}: TetrisGameProps) {
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
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const keys: Record<string, boolean> = {};
    const justPressed: Record<string, boolean> = {};

    function pressed(code: string) {
      const val = justPressed[code];
      justPressed[code] = false;
      return val;
    }

    let board: Board;
    let current: Piece;
    let nextType: PieceType;
    let score = 0;
    let lines = 0;
    let level = 1;
    let stopped = false;
    let fallTimer = 0;
    let dasTimer: Record<string, number> = {};
    let lastTime: number | null = null;
    let rafId = 0;

    let prevScore = 0;
    let prevLevel = 1;

    function emitStateIfChanged() {
      if (score !== prevScore || level !== prevLevel) {
        prevScore = score;
        prevLevel = level;
        onStateChangeRef.current({ score, lives: 1, level });
      }
    }

    function dropInterval() {
      return Math.max(100, 800 - (level - 1) * 70);
    }

    function trySpawnNext() {
      current = spawnPiece(nextType);
      nextType = randomType();
      if (collides(current.matrix, current.x, current.y, board)) {
        stopped = true;
        emitStateIfChanged();
        onGameOverRef.current(score);
      }
    }

    function lockPiece() {
      for (let y = 0; y < current.matrix.length; y++) {
        for (let x = 0; x < current.matrix[y].length; x++) {
          if (!current.matrix[y][x]) continue;
          const by = current.y + y;
          const bx = current.x + x;
          if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
            board[by][bx] = current.color;
          }
        }
      }
      clearLines();
      trySpawnNext();
    }

    function clearLines() {
      let cleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every((cell) => cell !== null)) {
          board.splice(y, 1);
          board.unshift(Array<string | null>(COLS).fill(null));
          cleared++;
          y++;
        }
      }
      if (cleared > 0) {
        score += LINE_SCORES[cleared] * level;
        lines += cleared;
        level = Math.floor(lines / 10) + 1;
      }
    }

    function initGame() {
      board = createBoard();
      score = 0;
      lines = 0;
      level = 1;
      stopped = false;
      fallTimer = 0;
      dasTimer = {};
      nextType = randomType();
      trySpawnNext();
    }

    function tryMove(dx: number) {
      if (!collides(current.matrix, current.x + dx, current.y, board)) {
        current.x += dx;
      }
    }

    function tryRotate() {
      const rotated = rotateMatrix(current.matrix);
      if (!collides(rotated, current.x, current.y, board)) {
        current.matrix = rotated;
      }
    }

    function handleHorizontalDAS(dt: number) {
      for (const code of ["ArrowLeft", "ArrowRight"]) {
        if (!keys[code]) {
          dasTimer[code] = 0;
          continue;
        }
        dasTimer[code] = (dasTimer[code] ?? 0) + dt;
      }
      if (pressed("ArrowLeft")) tryMove(-1);
      if (pressed("ArrowRight")) tryMove(1);
      if (keys["ArrowLeft"] && dasTimer["ArrowLeft"] > DAS_DELAY) {
        dasTimer["ArrowLeft"] -= DAS_REPEAT;
        tryMove(-1);
      }
      if (keys["ArrowRight"] && dasTimer["ArrowRight"] > DAS_DELAY) {
        dasTimer["ArrowRight"] -= DAS_REPEAT;
        tryMove(1);
      }
    }

    function update(dt: number) {
      if (pressed("ArrowUp")) tryRotate();
      handleHorizontalDAS(dt);

      const interval = keys["ArrowDown"]
        ? Math.min(dropInterval(), 50)
        : dropInterval();
      fallTimer += dt * 1000;
      if (fallTimer >= interval) {
        fallTimer = 0;
        if (!collides(current.matrix, current.x, current.y + 1, board)) {
          current.y += 1;
        } else {
          lockPiece();
        }
      }

      emitStateIfChanged();
    }

    function drawBoard() {
      ctx!.strokeStyle = "rgba(255,255,255,0.15)";
      ctx!.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        ctx!.beginPath();
        ctx!.moveTo(BOARD_X + x * CELL, BOARD_Y);
        ctx!.lineTo(BOARD_X + x * CELL, BOARD_Y + ROWS * CELL);
        ctx!.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx!.beginPath();
        ctx!.moveTo(BOARD_X, BOARD_Y + y * CELL);
        ctx!.lineTo(BOARD_X + COLS * CELL, BOARD_Y + y * CELL);
        ctx!.stroke();
      }

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const color = board[y][x];
          if (color) drawCell(BOARD_X + x * CELL, BOARD_Y + y * CELL, color);
        }
      }

      ctx!.strokeStyle = "#fff";
      ctx!.lineWidth = 2;
      ctx!.strokeRect(BOARD_X, BOARD_Y, COLS * CELL, ROWS * CELL);
    }

    function drawCell(px: number, py: number, color: string) {
      ctx!.fillStyle = color;
      ctx!.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    }

    function drawPiece() {
      for (let y = 0; y < current.matrix.length; y++) {
        for (let x = 0; x < current.matrix[y].length; x++) {
          if (!current.matrix[y][x]) continue;
          const by = current.y + y;
          const bx = current.x + x;
          if (by < 0) continue;
          drawCell(BOARD_X + bx * CELL, BOARD_Y + by * CELL, current.color);
        }
      }
    }

    function drawNext() {
      ctx!.fillStyle = "#fff";
      ctx!.font = "bold 13px monospace";
      ctx!.textAlign = "left";
      ctx!.textBaseline = "alphabetic";
      ctx!.fillText("SIGUIENTE", PANEL_X, 45);

      const matrix = SHAPES[nextType];
      const color = COLORS[nextType];
      const boxX = PANEL_X;
      const boxY = 55;
      ctx!.strokeStyle = "rgba(255,255,255,0.3)";
      ctx!.strokeRect(boxX, boxY, 4 * CELL, 4 * CELL);
      const offset = Math.floor((4 - matrix.length) / 2);
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (!matrix[y][x]) continue;
          drawCell(
            boxX + (x + offset) * CELL,
            boxY + (y + offset) * CELL,
            color,
          );
        }
      }
    }

    function drawHUD() {
      ctx!.fillStyle = "#0ff";
      ctx!.font = "bold 13px monospace";
      ctx!.textAlign = "left";

      ctx!.fillText("PUNTUACIÓN", PANEL_X, 170);
      ctx!.fillStyle = "#fff";
      ctx!.font = "bold 20px monospace";
      ctx!.fillText(String(score), PANEL_X, 195);

      ctx!.fillStyle = "#0ff";
      ctx!.font = "bold 13px monospace";
      ctx!.fillText("LÍNEAS", PANEL_X, 235);
      ctx!.fillStyle = "#fff";
      ctx!.font = "bold 20px monospace";
      ctx!.fillText(String(lines), PANEL_X, 260);

      ctx!.fillStyle = "#0ff";
      ctx!.font = "bold 13px monospace";
      ctx!.fillText("NIVEL", PANEL_X, 300);
      ctx!.fillStyle = "#fff";
      ctx!.font = "bold 20px monospace";
      ctx!.fillText(String(level), PANEL_X, 325);
    }

    function draw() {
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, W, H);
      drawBoard();
      drawPiece();
      drawNext();
      drawHUD();
    }

    function loop(ts: number) {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      if (!pausedRef.current && !stopped) update(dt);
      draw();
      if (!stopped) rafId = requestAnimationFrame(loop);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (CAPTURED_CODES.has(e.code)) e.preventDefault();
      if (!keys[e.code]) justPressed[e.code] = true;
      keys[e.code] = true;
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (CAPTURED_CODES.has(e.code)) e.preventDefault();
      keys[e.code] = false;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    initGame();
    rafId = requestAnimationFrame(loop);

    return () => {
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
