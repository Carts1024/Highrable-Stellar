"use client";

import "quill/dist/quill.snow.css";
import { useEffect, useId, useRef } from "react";

import type QuillNamespace from "quill";

import { cn } from "../../lib/utils";

const TOOLBAR_ID_PREFIX = "rich-text-toolbar";
const EMPTY_DELTA = JSON.stringify({ ops: [{ insert: "\n" }] });

const ALLOWED_FORMATS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "link",
  "blockquote",
  "list",
  "header",
] as const;

interface IRichTextEditorProps {
  id?: string;
  value:
    | {
        delta: string;
        html: string;
        text: string;
      }
    | undefined;
  onChange: (value: { delta: string; html: string; text: string } | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  "aria-label"?: string;
  className?: string;
  editorClassName?: string;
}

function normalizePlainText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

function enforcePlainTextMaxLength(quill: QuillNamespace, maxLength: number): void {
  const text = normalizePlainText(quill.getText());
  if (text.length <= maxLength) {
    return;
  }

  const selection = quill.getSelection();
  quill.deleteText(maxLength, quill.getLength(), "silent");

  if (selection) {
    quill.setSelection(Math.min(selection.index, maxLength), 0, "silent");
  }
}

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  maxLength,
  className,
  editorClassName,
  "aria-label": ariaLabel = "Rich text editor",
}: IRichTextEditorProps) {
  const toolbarId = `${TOOLBAR_ID_PREFIX}-${useId().replace(/:/g, "")}`;
  const editorElementRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<QuillNamespace | null>(null);
  const isApplyingExternalValueRef = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let isMounted = true;

    async function setupEditor() {
      if (!editorElementRef.current || quillRef.current) {
        return;
      }

      const { default: Quill } = await import("quill");
      if (!isMounted || !editorElementRef.current) {
        return;
      }

      const quill = new Quill(editorElementRef.current, {
        theme: "snow",
        placeholder,
        readOnly: disabled,
        bounds: editorElementRef.current.parentElement ?? undefined,
        formats: [...ALLOWED_FORMATS],
        modules: {
          toolbar: {
            container: `#${toolbarId}`,
          },
          history: {
            delay: 300,
            maxStack: 100,
            userOnly: true,
          },
        },
      });

      quillRef.current = quill;

      const initialDelta = value?.delta ?? EMPTY_DELTA;
      try {
        isApplyingExternalValueRef.current = true;
        quill.setContents(JSON.parse(initialDelta), "silent");
      } finally {
        isApplyingExternalValueRef.current = false;
      }

      quill.on("text-change", () => {
        if (isApplyingExternalValueRef.current) {
          return;
        }

        if (typeof maxLength === "number") {
          enforcePlainTextMaxLength(quill, maxLength);
        }

        const text = normalizePlainText(quill.getText());
        if (!text) {
          onChangeRef.current(undefined);
          return;
        }

        onChangeRef.current({
          delta: JSON.stringify(quill.getContents()),
          html: quill.getSemanticHTML(),
          text,
        });
      });
    }

    void setupEditor();

    return () => {
      isMounted = false;
      quillRef.current = null;
    };
  }, [disabled, maxLength, placeholder, toolbarId]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) {
      return;
    }

    quill.enable(!disabled);
  }, [disabled]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) {
      return;
    }

    const nextDelta = value?.delta ?? EMPTY_DELTA;
    const currentDelta = JSON.stringify(quill.getContents());

    if (currentDelta === nextDelta) {
      return;
    }

    try {
      isApplyingExternalValueRef.current = true;
      quill.setContents(JSON.parse(nextDelta), "silent");
    } finally {
      isApplyingExternalValueRef.current = false;
    }
  }, [value]);

  return (
    <div className={cn("rounded-xl border border-border bg-background", className)}>
      <div
        id={toolbarId}
        className="rich-text-toolbar flex flex-wrap items-center gap-1 border-b border-[#f3f4f6] px-2 py-2"
      >
        <span className="ql-formats flex items-center gap-1">
          <button type="button" className="ql-bold" aria-label="Bold" />
          <button type="button" className="ql-italic" aria-label="Italic" />
          <button type="button" className="ql-underline" aria-label="Underline" />
          <button type="button" className="ql-strike" aria-label="Strikethrough" />
        </span>
        <span className="ql-formats flex items-center gap-1">
          <button type="button" className="ql-blockquote" aria-label="Block quote" />
          <button type="button" className="ql-list" value="ordered" aria-label="Ordered list" />
          <button type="button" className="ql-list" value="bullet" aria-label="Bullet list" />
        </span>
        <span className="ql-formats flex items-center gap-1">
          <select className="ql-header" defaultValue="" aria-label="Heading level">
            <option value="">Body</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
          </select>
          <button type="button" className="ql-link" aria-label="Insert link" />
        </span>
      </div>

      <div
        className={cn(
          "rich-text-editor min-h-32 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-32 [&_.ql-editor]:px-3 [&_.ql-editor]:py-2.5 [&_.ql-editor]:text-sm [&_.ql-editor]:leading-6 [&_.ql-editor.ql-blank::before]:right-3 [&_.ql-editor.ql-blank::before]:left-3 [&_.ql-editor.ql-blank::before]:text-[#9ca3af]",
          disabled && "bg-muted opacity-80",
          editorClassName,
        )}
      >
        <div id={id} ref={editorElementRef} aria-label={ariaLabel} />
      </div>
    </div>
  );
}
