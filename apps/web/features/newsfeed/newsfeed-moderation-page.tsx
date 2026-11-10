"use client";

import { RouteCallout, RouteEmptyState, RoutePanel } from "@/features/common";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { AlertCircle, Clock3, LoaderCircle, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { TNewsfeedReportDto } from "@repo/convex-client";

import { makeRequestId, requestJson } from "./newsfeed-page";

type TReportStatus = "open" | "reviewed" | "dismissed";

export function NewsfeedModerationPage() {
  const [status, setStatus] = useState<TReportStatus>("open");
  const [reports, setReports] = useState<TNewsfeedReportDto[]>([]);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      action: string;
      reason: string;
      createdAt: number;
      targetType: string;
      actor: { displayName: string };
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestJson<{ items: TNewsfeedReportDto[] }>(
        `/api/newsfeed/moderation/reports?status=${status}`,
      );
      setReports(result.items);
      const historyResult = await requestJson<{
        items: Array<{
          id: string;
          action: string;
          reason: string;
          createdAt: number;
          targetType: string;
          actor: { displayName: string };
        }>;
      }>("/api/newsfeed/moderation/actions");
      setHistory(historyResult.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Moderation queue could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const applyAction = async (
    report: TNewsfeedReportDto,
    action: "hide" | "restore" | "dismiss_report",
  ) => {
    if (!report.target) return;
    const reason = reasons[report.id]?.trim();
    if (!reason) {
      setError("Add a reason before applying a moderation action.");
      return;
    }
    setActionPending(report.id);
    setError(null);
    try {
      await requestJson("/api/newsfeed/moderation/actions", {
        method: "POST",
        body: JSON.stringify({
          requestId: makeRequestId(),
          targetType: report.target.type,
          targetId: report.target.id,
          action,
          reason,
          reportId: report.id,
        }),
      });
      await loadReports();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Moderation action failed.");
    } finally {
      setActionPending(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-1">
        <p className="hr-text-muted font-mono text-xs uppercase">Newsfeed controls</p>
        <h1 className="hr-text-primary flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5" />
          Moderation queue
        </h1>
        <p className="hr-text-secondary text-sm">
          Review member reports and record every effective visibility change.
        </p>
      </header>
      {error ? (
        <RouteCallout tone="danger" icon={<AlertCircle className="h-4 w-4" />}>
          {error}
        </RouteCallout>
      ) : null}
      <RoutePanel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="font-semibold">Reports</p>
            <p className="hr-text-muted text-xs">
              Target text is visible only to allowlisted moderators.
            </p>
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as TReportStatus)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
            aria-label="Report status"
          >
            <option value="open">Open</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
        {loading ? (
          <div className="flex justify-center px-5 py-10">
            <LoaderCircle className="animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {!loading && reports.length === 0 && !error ? (
          <div className="px-5 py-5">
            <RouteEmptyState
              title="Queue is clear"
              description={`No ${status} reports are waiting.`}
              icon={<Clock3 />}
            />
          </div>
        ) : null}
        <div className="divide-y">
          {reports.map((report) => {
            const pending = actionPending === report.id;
            const target = report.target;
            return (
              <article key={report.id} className="space-y-4 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">{report.reason.replaceAll("_", " ")}</span> ·
                      reported by {report.reporter.displayName}
                    </p>
                    <p className="hr-text-muted text-xs">
                      {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full border px-2 py-0.5 text-xs capitalize">
                    {report.status}
                  </span>
                </div>
                {report.explanation ? (
                  <p className="rounded-md bg-muted/30 px-3 py-2 text-sm">{report.explanation}</p>
                ) : null}
                {target ? (
                  <div className="rounded-md border bg-background p-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{target.author.displayName}</span>
                      <span className="hr-text-muted">{target.type}</span>
                      <span className="hr-text-muted">
                        {target.visibility.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 whitespace-pre-wrap">{target.text}</p>
                  </div>
                ) : (
                  <RouteCallout tone="warning">
                    The reported content is no longer available.
                  </RouteCallout>
                )}
                {target && report.status === "open" ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium">
                      Action reason
                      <input
                        value={reasons[report.id] ?? ""}
                        onChange={(event) =>
                          setReasons((current) => ({ ...current, [report.id]: event.target.value }))
                        }
                        className="mt-1 h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                        placeholder="Why is this action being taken?"
                      />
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <AppButton
                        variant="outline"
                        size="sm"
                        onClick={() => void applyAction(report, "dismiss_report")}
                        disabled={pending}
                      >
                        Dismiss report
                      </AppButton>
                      {target.visibility === "moderation_hidden" ? (
                        <AppButton
                          size="sm"
                          onClick={() => void applyAction(report, "restore")}
                          disabled={pending}
                        >
                          Restore content
                        </AppButton>
                      ) : (
                        <AppButton
                          variant="destructive"
                          size="sm"
                          onClick={() => void applyAction(report, "hide")}
                          disabled={pending}
                        >
                          {pending ? <LoaderCircle className="animate-spin" /> : null}Hide content
                        </AppButton>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </RoutePanel>
      <RoutePanel>
        <div className="border-b px-5 py-4">
          <p className="font-semibold">Moderation history</p>
          <p className="hr-text-muted text-xs">Append-only records of queue decisions.</p>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-5 text-sm text-muted-foreground">
            No moderation actions recorded yet.
          </p>
        ) : (
          <div className="divide-y">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
              >
                <span>
                  <span className="font-medium capitalize">{item.action.replaceAll("_", " ")}</span>{" "}
                  {item.targetType} · {item.actor.displayName}
                </span>
                <span className="hr-text-muted text-xs">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
                <span className="sr-only">Reason: {item.reason}</span>
              </div>
            ))}
          </div>
        )}
      </RoutePanel>
    </div>
  );
}
