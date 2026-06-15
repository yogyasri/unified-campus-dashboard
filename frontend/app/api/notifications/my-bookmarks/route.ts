import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const NOTIFICATIONS_URL = process.env.MCP_NOTIFICATIONS_URL || "http://127.0.0.1:4005";

async function callRpc(method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${NOTIFICATIONS_URL}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  if (!res.ok) throw new Error(`RPC error: ${res.status}`);
  const json = await res.json();
  return json.result;
}

export async function GET() {
  try {
    const session = await getSession();
    const studentId = session?.studentId || "STU001";
    const bookmarks = await callRpc("get_user_bookmarks", { studentId });
    return NextResponse.json({ bookmarks: Array.isArray(bookmarks) ? bookmarks : [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
