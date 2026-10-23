import { StatusText, type TStatusTone } from "@/features/common";
import React from "react";

const STATUS_TONES: Record<string, TStatusTone> = {
  pending: "warning",
  created: "warning",
  selected: "info",
  funded: "info",
  submitted: "info",
  open: "success",
  completed: "success",
  released: "success",
  disputed: "danger",
  cancelled: "neutral",
  not_selected: "neutral",
};

interface IStatusPillProps {
  readonly label: string;
}

function toStatusLabel(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StatusPill({ label }: IStatusPillProps) {
  const normalized = label.trim().toLowerCase();

  return (
    <StatusText tone={STATUS_TONES[normalized] ?? "neutral"}>
      {toStatusLabel(normalized)}
    </StatusText>
  );
}
