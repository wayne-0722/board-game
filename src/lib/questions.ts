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
  mediumlow: "中低",
  mediumhigh: "中高",
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
  mediumlow: 300000,
  mediumhigh: 600000,
  易: 100000,
  中低: 300000,
  中: 500000,
  中高: 600000,
  難: 700000
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
