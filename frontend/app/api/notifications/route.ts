import { NextResponse } from "next/server";

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
    const [announcements, deadlines] = await Promise.all([
      callRpc("get_pinned_alerts"),
      callRpc("get_deadlines", { days_ahead: 7 }),
    ]);

    return NextResponse.json({ announcements, deadlines });
  } catch (error: any) {
    console.error("Notifications API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
