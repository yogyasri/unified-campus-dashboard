import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";

const CAFETERIA_URL = process.env.MCP_CAFETERIA_URL || "http://127.0.0.1:4002";

export async function POST(req: NextRequest) {
  try {
    const { itemId } = await req.json();
    const session = await getSession();
    const studentId = session?.studentId || "STU001";
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

    const res = await fetch(`${CAFETERIA_URL}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "mark_favorite", params: { itemId, studentId }, id: 1 }),
    });
    if (!res.ok) throw new Error(`RPC error: ${res.status}`);
    const json = await res.json();
    return NextResponse.json(json.result);
  } catch (error: any) {
    console.error("Favorite API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
