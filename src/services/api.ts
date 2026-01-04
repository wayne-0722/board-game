import type { Session } from "../server/mockSessionStore";

const jsonFetch = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    throw new Error("Invalid server response");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data as T;
};

export const api = {
  joinSession: async (sessionCode: string, playerName?: string, playerId?: string) =>
    jsonFetch<{ session: Session; playerId: string }>(`/api/session/join`, {
      method: "POST",
      body: JSON.stringify({ sessionCode, playerName, playerId })
    }),
  confirmSeat: async (sessionCode: string, playerId: string, playerName?: string) =>
    jsonFetch<{ session: Session }>(`/api/session/confirm`, {
      method: "POST",
      body: JSON.stringify({ sessionCode, playerId, playerName })
    }),
  startGame: async (sessionCode: string) =>
    jsonFetch<{ session: Session }>(`/api/session/start`, {
      method: "POST",
      body: JSON.stringify({ sessionCode })
    }),
  advanceTurn: async (sessionCode: string) =>
    jsonFetch<{ session: Session }>(`/api/session/advance`, {
      method: "POST",
      body: JSON.stringify({ sessionCode })
    }),
  startQuestion: async (sessionCode: string) =>
    jsonFetch<{ session: Session }>(`/api/session/question/start`, {
      method: "POST",
      body: JSON.stringify({ sessionCode })
    }),
  submitAnswer: async (sessionCode: string, selectedIndices: number[]) =>
    jsonFetch<{ session: Session }>(`/api/session/question/answer`, {
      method: "POST",
      body: JSON.stringify({ sessionCode, selectedIndices })
    }),
  buzzIn: async (sessionCode: string, playerId: string) =>
    jsonFetch<{ session: Session }>(`/api/session/question/buzz`, {
      method: "POST",
      body: JSON.stringify({ sessionCode, playerId })
    }),
  startReflection: async (sessionCode: string, playerId: string) =>
    jsonFetch<{ session: Session }>(`/api/session/reflect/start`, {
      method: "POST",
      body: JSON.stringify({ sessionCode, playerId })
    }),
  submitReflection: async (
    sessionCode: string,
    playerId: string,
    answers: Record<string, number[]>,
    totalTime?: number
  ) =>
    jsonFetch<{ session: Session }>(`/api/session/reflect/submit`, {
      method: "POST",
      body: JSON.stringify({ sessionCode, playerId, answers, totalTime })
    }),
  settleReflection: async (sessionCode: string) =>
    jsonFetch<{ session: Session; leaderboard: any[] }>(`/api/session/reflect/settle`, {
      method: "POST",
      body: JSON.stringify({ sessionCode })
    }),
  voteEnd: async (sessionCode: string, playerId: string) =>
    jsonFetch<{ session: Session; endVotes: string[]; threshold: number }>(`/api/session/end`, {
      method: "POST",
      body: JSON.stringify({ sessionCode, playerId })
    }),
  forfeitQuestion: async (sessionCode: string) =>
    jsonFetch<{ session: Session }>(`/api/session/question/forfeit`, {
      method: "POST",
      body: JSON.stringify({ sessionCode })
    }),
  getState: async (sessionCode: string) =>
    jsonFetch<{ session: Session }>(`/api/session/state?sessionCode=${sessionCode}`)
};
