import { useCallback, useRef, useState } from "react";

import type { TDraftAttachment } from "@/features/attachments/types";
import type { Dispatch, SetStateAction } from "react";

export type TParticipantActionKind = "evidence" | "response";

export type TParticipantActionDraft = {
  message: string;
  attachments: TDraftAttachment[];
  isSubmitting: boolean;
  error: string | null;
};

export type TParticipantActionCompletion =
  | { succeeded: true }
  | { error: string; succeeded: false };

export type TParticipantComposerSession = {
  state: TParticipantActionDraft;
  onMessageChange: (message: string) => void;
  onAttachmentsChange: Dispatch<SetStateAction<TDraftAttachment[]>>;
  onErrorChange: (error: string | null) => void;
  beginSubmission: () => boolean;
  completeSubmission: (completion: TParticipantActionCompletion) => void;
};

export type TParticipantActionSession = {
  evidence: TParticipantComposerSession;
  response: TParticipantComposerSession;
};

function createDraft(): TParticipantActionDraft {
  return {
    message: "",
    attachments: [],
    isSubmitting: false,
    error: null,
  };
}

function createSession(): Record<TParticipantActionKind, TParticipantActionDraft> {
  return {
    evidence: createDraft(),
    response: createDraft(),
  };
}

export function useParticipantActionSession(): TParticipantActionSession {
  const [drafts, setDrafts] = useState(createSession);
  const submissionLocks = useRef<Record<TParticipantActionKind, boolean>>({
    evidence: false,
    response: false,
  });

  const updateDraft = useCallback(
    <T extends TParticipantActionKind>(
      kind: T,
      update: (draft: TParticipantActionDraft) => TParticipantActionDraft,
    ) => {
      setDrafts((current) => ({ ...current, [kind]: update(current[kind]) }));
    },
    [],
  );

  const createComposerSession = (kind: TParticipantActionKind): TParticipantComposerSession => ({
    state: drafts[kind],
    onMessageChange: (message) => {
      updateDraft(kind, (draft) => ({ ...draft, message, error: null }));
    },
    onAttachmentsChange: (update) => {
      updateDraft(kind, (draft) => ({
        ...draft,
        attachments: typeof update === "function" ? update(draft.attachments) : update,
        error: null,
      }));
    },
    onErrorChange: (error) => {
      updateDraft(kind, (draft) => ({ ...draft, error }));
    },
    beginSubmission: () => {
      if (submissionLocks.current[kind]) return false;
      submissionLocks.current[kind] = true;
      updateDraft(kind, (draft) => ({ ...draft, isSubmitting: true, error: null }));
      return true;
    },
    completeSubmission: (completion) => {
      submissionLocks.current[kind] = false;
      updateDraft(kind, (draft) =>
        completion.succeeded
          ? createDraft()
          : { ...draft, isSubmitting: false, error: completion.error },
      );
    },
  });

  return {
    evidence: createComposerSession("evidence"),
    response: createComposerSession("response"),
  };
}
