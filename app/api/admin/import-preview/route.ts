import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { previewImport } from "@/lib/tournament/importer";

export async function POST(request: Request) {
  await requireAdmin();

  const body = (await request.json()) as { content?: string };
  const content = body.content ?? "";

  const preview = previewImport(content);

  return NextResponse.json(preview);
}
