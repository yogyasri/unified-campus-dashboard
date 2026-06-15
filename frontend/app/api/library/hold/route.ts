import { NextRequest, NextResponse } from "next/server";

const LIBRARY_URL = process.env.MCP_LIBRARY_URL || "http://127.0.0.1:4001";

export async function POST(req: NextRequest) {
  try {
    const { bookId, studentId } = await req.json();
    if (!bookId) return NextResponse.json({ error: "bookId required" }, { status: 400 });

    const res = await fetch(`${LIBRARY_URL}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "place_hold", params: { bookId, studentId }, id: 1 }),
    });
    if (!res.ok) throw new Error(`RPC error: ${res.status}`);
    const json = await res.json();
    return NextResponse.json(json.result);
  } catch (error: any) {
    console.error("Hold API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
