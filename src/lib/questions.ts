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
  easy: "\u7c21\u55ae",
  low_medium: "\u4e2d\u4f4e",
  medium: "\u4e2d\u7b49",
  medium_high: "\u4e2d\u9ad8",
  high: "\u9ad8",
  hard: "\u56f0\u96e3",
  mediumlow: "\u4e2d\u4f4e",
  mediumhigh: "\u4e2d\u9ad8",
  "\u7c21\u55ae": "\u7c21\u55ae",
  "\u4e2d\u4f4e": "\u4e2d\u4f4e",
  "\u4e2d\u7b49": "\u4e2d\u7b49",
  "\u4e2d\u9ad8": "\u4e2d\u9ad8",
  "\u9ad8": "\u9ad8",
  "\u56f0\u96e3": "\u56f0\u96e3"
};

const difficultyStakes: Record<string, number> = {
  easy: 100000,
  low_medium: 300000,
  medium: 500000,
  medium_high: 600000,
  high: 600000,
  hard: 700000,
  mediumlow: 300000,
  mediumhigh: 600000,
  "\u7c21\u55ae": 100000,
  "\u4e2d\u4f4e": 300000,
  "\u4e2d\u7b49": 500000,
  "\u4e2d\u9ad8": 600000,
  "\u9ad8": 600000,
  "\u56f0\u96e3": 700000
};

const normalizeDifficulty = (value: string) => {
  const trimmed = value.trim();
  return difficultyLabels[trimmed] ?? difficultyLabels[trimmed.toLowerCase()] ?? trimmed;
};

const resolveStake = (difficulty: string, fallback?: number) => {
  const trimmed = difficulty.trim();
  return (
    fallback ??
    difficultyStakes[trimmed] ??
    difficultyStakes[trimmed.toLowerCase()] ??
    100000
  );
};

export const mockQuestions: Question[] = (rawQuestions as RawQuestion[]).map((question) => ({
  ...question,
  difficulty: normalizeDifficulty(question.difficulty),
  stake: resolveStake(question.difficulty, question.stake),
  penalty: resolveStake(question.difficulty, question.penalty ?? question.stake)
}));
