import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationError, RateLimitError } from "@/lib/server-auth";

export function apiErrorResponse(error: unknown, fallback: string, fallbackStatus = 500) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof RateLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Request validation failed." }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  console.error(`[api] ${fallback}`, error);
  return NextResponse.json({ error: fallback }, { status: fallbackStatus });
}
