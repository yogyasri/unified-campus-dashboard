import { NextRequest, NextResponse } from "next/server";

const EVENTS_URL = process.env.MCP_EVENTS_URL || "http://127.0.0.1:4003";

export async function POST(req: NextRequest) {
  try {
    const { eventId, studentId } = await req.json();
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const res = await fetch(`${EVENTS_URL}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "rsvp_event", params: { eventId, studentId }, id: 1 }),
    });
    if (!res.ok) throw new Error(`RPC error: ${res.status}`);
    const json = await res.json();
    return NextResponse.json(json.result);
  } catch (error: any) {
    console.error("RSVP API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
