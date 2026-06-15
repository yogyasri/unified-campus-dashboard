import { NextResponse } from "next/server";

const EVENTS_URL = process.env.MCP_EVENTS_URL || "http://127.0.0.1:4003";

async function callRpc(method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${EVENTS_URL}/rpc`, {
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
    const events = await callRpc("get_upcoming_events", { limit: 5 });
    return NextResponse.json({ events });
  } catch (error: any) {
    console.error("Events API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
