export type GameEngineState = {
  score: number;
  lives: number;
  level: number;
};

export type GameEngineProps = {
  paused: boolean;
  onStateChange: (state: GameEngineState) => void;
  onGameOver: (finalScore: number) => void;
};
