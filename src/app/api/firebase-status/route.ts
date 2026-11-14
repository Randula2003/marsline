import { NextResponse } from "next/server";
import { getFirebaseStatus } from "@/lib/firebase-status";
export const dynamic = "force-dynamic";
// Public, read-only: reports which settings exist (never their values) so the setup screen can show what is missing.
export async function GET() { return NextResponse.json(getFirebaseStatus()); }
