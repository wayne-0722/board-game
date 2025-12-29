import type { Session } from "../server/mockSessionStore";

const jsonFetch = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
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
  submitAnswer: async (sessionCode: string, selectedIndex: number) =>
    jsonFetch<{ session: Session }>(`/api/session/question/answer`, {
      method: "POST",
      body: JSON.stringify({ sessionCode, selectedIndex })
    }),
  getState: async (sessionCode: string) =>
    jsonFetch<{ session: Session }>(`/api/session/state?sessionCode=${sessionCode}`)
};
