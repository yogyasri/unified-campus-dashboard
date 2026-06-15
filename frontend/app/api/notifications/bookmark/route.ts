import { NextRequest, NextResponse } from "next/server";

const NOTIFICATIONS_URL = process.env.MCP_NOTIFICATIONS_URL || "http://127.0.0.1:4005";

export async function POST(req: NextRequest) {
  try {
    const { announcementId, studentId } = await req.json();
    if (!announcementId) return NextResponse.json({ error: "announcementId required" }, { status: 400 });

    const res = await fetch(`${NOTIFICATIONS_URL}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "bookmark_announcement", params: { announcementId, studentId }, id: 1 }),
    });
    if (!res.ok) throw new Error(`RPC error: ${res.status}`);
    const json = await res.json();
    return NextResponse.json(json.result);
  } catch (error: any) {
    console.error("Bookmark API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
