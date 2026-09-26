import type { NextRequest } from "next/server";

export class RequestBodyError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestBodyError";
    this.status = status;
  }
}

export async function readBoundedJson(request: NextRequest, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength > maxBytes) {
      throw new RequestBodyError("Request body is too large.", 413);
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new RequestBodyError("Request body is required.");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;

    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new RequestBodyError("Request body is too large.", 413);
    }

    chunks.push(chunk.value);
  }

  const payload = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(payload)) as unknown;
  } catch {
    throw new RequestBodyError("Request body must be valid JSON.");
  }
}
