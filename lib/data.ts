export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
}

export interface GameWithStats extends Game {
  best: number;
  plays: number;
}

export const CATS: (GameCategory | "TODOS")[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}
