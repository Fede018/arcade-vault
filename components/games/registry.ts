import type { ComponentType } from "react";
import AsteroidsGame from "./asteroids-game";
import type { GameEngineProps } from "./engine-types";

/**
 * Motores de juego reales, por `game.id`. Un juego sin entrada acá
 * cae al mock (ver `game-player-client.tsx`).
 */
export const GAME_ENGINES: Record<string, ComponentType<GameEngineProps>> = {
  asteroids: AsteroidsGame,
};
