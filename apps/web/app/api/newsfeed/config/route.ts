import { env } from "@/core/config/env";
import { noStore } from "@/core/member/server-api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(): NextResponse {
  return noStore(
    NextResponse.json(
      {
        enabled: env.NEWSFEED_ENABLED === true,
        textEnabled: env.NEWSFEED_ENABLED === true && env.NEWSFEED_TEXT_ENABLED === true,
      },
      { status: 200 },
    ),
  );
}
