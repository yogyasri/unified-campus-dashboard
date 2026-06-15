import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const NOTIFICATIONS_URL = process.env.MCP_NOTIFICATIONS_URL || "http://127.0.0.1:4005";

export async function POST(req: NextRequest) {
  try {
    const { announcementId } = await req.json();
    const session = await getSession();
    const studentId = session?.studentId || "STU001";
    if (!announcementId) return NextResponse.json({ error: "announcementId required" }, { status: 400 });

    const res = await fetch(`${NOTIFICATIONS_URL}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "remove_bookmark", params: { announcementId, studentId }, id: 1 }),
    });
    if (!res.ok) throw new Error(`RPC error: ${res.status}`);
    const json = await res.json();
    return NextResponse.json(json.result);
  } catch (error: any) {
    console.error("Remove Bookmark API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
