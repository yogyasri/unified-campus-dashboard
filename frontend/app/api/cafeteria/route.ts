import { NextResponse } from "next/server";

const CAFETERIA_URL = process.env.MCP_CAFETERIA_URL || "http://127.0.0.1:4002";

async function callRpc(method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${CAFETERIA_URL}/rpc`, {
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
    const menu = await callRpc("get_current_meal");
    return NextResponse.json(menu);
  } catch (error: any) {
    console.error("Cafeteria API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
