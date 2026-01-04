import rawQuestions from "../../mockQuestions_with_penalty.json";

export type Question = {
  id: string;
  category: string;
  type: "single" | "multi" | "boolean";
  difficulty: string;
  text: string;
  options: string[];
  answerIndices: number[];
  explanation: string;
  tip: string;
  stake?: number;
  penalty?: number;
};

type RawQuestion = {
  id: string;
  category: string;
  type: "single" | "multi" | "boolean";
  difficulty: string;
  text: string;
  options: string[];
  answerIndices: number[];
  explanation: string;
  tip: string;
  stake?: number;
  penalty?: number;
};

const difficultyLabels: Record<string, string> = {
  easy: "易",
  low_medium: "中低",
  medium: "中",
  medium_high: "中高",
  high: "中高",
  hard: "難",
  易: "易",
  中低: "中低",
  中: "中",
  中高: "中高",
  難: "難"
};

const difficultyStakes: Record<string, number> = {
  easy: 100000,
  low_medium: 300000,
  medium: 500000,
  medium_high: 600000,
  high: 600000,
  hard: 700000,
  易: 100000,
  中低: 300000,
  中: 500000,
  中高: 600000,
  難: 700000
};

const normalizeDifficulty = (value: string) => {
  const trimmed = value.trim();
  return difficultyLabels[trimmed] ?? trimmed;
};

const resolveStake = (value: string, fallback?: number) => {
  const trimmed = value.trim();
  return (
    difficultyStakes[trimmed] ??
    difficultyStakes[trimmed.toLowerCase()] ??
    fallback ??
    100000
  );
};

export const mockQuestions: Question[] = (rawQuestions as RawQuestion[]).map((q) => ({
  ...q,
  difficulty: normalizeDifficulty(q.difficulty),
  stake: resolveStake(q.difficulty, q.stake),
  penalty: resolveStake(q.difficulty, q.penalty ?? q.stake)
}));
