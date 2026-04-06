import type { Session } from "../server/mockSessionStore";

export type SessionView = "HOME" | "LOBBY" | "PLAY" | "QUESTION" | "REFLECT";

export type ActionResult = {
  ok: boolean;
  error?: string;
  data?: Record<string, any>;
};

export type JoinSessionPayload = {
  sessionCode: string;
  playerName?: string;
  playerId?: string;
  playerToken?: string;
};

export type ResumeSessionPayload = {
  sessionCode: string;
  playerId?: string;
  playerToken?: string;
};

export type ConfirmSeatPayload = {
  sessionCode: string;
  playerId: string;
  playerName?: string;
};

export type StartGamePayload = {
  sessionCode: string;
};

export type StartQuestionPayload = {
  sessionCode: string;
};

export type SubmitAnswerPayload = {
  sessionCode: string;
  selectedIndices: number[];
};

export type BuzzInPayload = {
  sessionCode: string;
  playerId: string;
};

export type StartReflectionPayload = {
  sessionCode: string;
  playerId: string;
};

export type SubmitReflectionPayload = {
  sessionCode: string;
  playerId: string;
  answers: Record<string, number[]>;
  totalTime?: number;
};

export type SkipReflectionPayload = {
  sessionCode: string;
  playerId: string;
};

export type VoteEndPayload = {
  sessionCode: string;
  playerId: string;
};

export type ConfirmReflectionExitPayload = {
  sessionCode: string;
  playerId: string;
};

export type SimpleSessionPayload = {
  sessionCode: string;
};

export type SessionSnapshotPayload = {
  session: Session;
  view: SessionView;
  timestamp: number;
};

export type ConnectedPayload = {
  clientId: string;
};

export type HeartbeatPayload = {
  timestamp: number;
};

export type SessionExpiredPayload = {
  sessionCode: string;
  reason: "empty_timeout" | "inactive_timeout" | "invalid_resume" | "finished_cleanup";
};

export type ServerToClientEvents = {
  connected: (payload: ConnectedPayload) => void;
  session_snapshot: (payload: SessionSnapshotPayload) => void;
  heartbeat: (payload: HeartbeatPayload) => void;
  session_expired: (payload: SessionExpiredPayload) => void;
};

export type ClientToServerEvents = {
  resume_session: (payload: ResumeSessionPayload, ack: (result: ActionResult) => void) => void;
  join_session: (payload: JoinSessionPayload, ack: (result: ActionResult) => void) => void;
  confirm_seat: (payload: ConfirmSeatPayload, ack: (result: ActionResult) => void) => void;
  start_game: (payload: StartGamePayload, ack: (result: ActionResult) => void) => void;
  start_question: (payload: StartQuestionPayload, ack: (result: ActionResult) => void) => void;
  submit_answer: (payload: SubmitAnswerPayload, ack: (result: ActionResult) => void) => void;
  buzz_in: (payload: BuzzInPayload, ack: (result: ActionResult) => void) => void;
  start_reflection: (payload: StartReflectionPayload, ack: (result: ActionResult) => void) => void;
  skip_reflection: (payload: SkipReflectionPayload, ack: (result: ActionResult) => void) => void;
  submit_reflection: (payload: SubmitReflectionPayload, ack: (result: ActionResult) => void) => void;
  settle_reflection: (payload: SimpleSessionPayload, ack: (result: ActionResult) => void) => void;
  vote_end: (payload: VoteEndPayload, ack: (result: ActionResult) => void) => void;
  confirm_reflection_exit: (
    payload: ConfirmReflectionExitPayload,
    ack: (result: ActionResult) => void
  ) => void;
  forfeit_question: (payload: SimpleSessionPayload, ack: (result: ActionResult) => void) => void;
  advance_turn: (payload: SimpleSessionPayload, ack: (result: ActionResult) => void) => void;
};
