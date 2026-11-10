import { authorizePhotoRead } from "@/features/newsfeed/photo-server";

import type { NextRequest } from "next/server";
export const POST = (request: NextRequest) => authorizePhotoRead(request, true);
