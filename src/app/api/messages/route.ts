import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { missionRef, requireUser } from "@/lib/server-auth";
import { messageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Messages are private records in the authenticated user's simulation workspace.
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const snapshot = await missionRef(uid).collection("messages").orderBy("sentAt", "desc").limit(100).get();
    const data = snapshot.docs.map((doc) => {
      const record = doc.data() as Record<string, unknown>;
      return {
        ...record,
        id: doc.id,
        sentAt: typeof record.sentAt === "string" ? record.sentAt : "",
      };
    });
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load mission messages", 503);
  }
}

// This stores a simulator message; it does not transmit over a radio link.
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = messageSchema.parse(await request.json());
    const ref = missionRef(uid).collection("messages").doc();
    const now = new Date().toISOString();
    const data = {
      senderCallsign: body.senderCallsign,
      recipient: "MARS MAIN STATION",
      direction: "ASTRONAUT_TO_STATION",
      subject: body.subject,
      messageBody: body.messageBody,
      priority: body.priority,
      marsSol: body.marsSol,
      transport: "FIRESTORE_SIMULATION",
      deliveryStatus: "QUEUED_SIMULATION",
      transmissionNote: "Stored in Cloud Firestore for the Marsline communications simulator. Not transmitted over a spacecraft radio link.",
      sentAt: now,
      createdAt: now,
    };

    await ref.set(data);
    return NextResponse.json({ data: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save mission message");
  }
}
