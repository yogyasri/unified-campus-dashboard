import { NextResponse } from "next/server";

const LIBRARY_URL = process.env.MCP_LIBRARY_URL || "http://127.0.0.1:4001";

async function callRpc(method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${LIBRARY_URL}/rpc`, {
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
    const [stats, recentArrivals, allBooks] = await Promise.all([
      callRpc("get_library_stats"),
      callRpc("get_recent_arrivals", { limit: 5 }),
      callRpc("search_books", { query: "a" }).catch(() => []), // broad search to get all books
    ]);

    // Find books that are fully checked out (available = 0) for Hold buttons
    const books = Array.isArray(allBooks) ? allBooks : [];
    const unavailableBooks = books.filter((b: { available: number }) => b.available === 0).slice(0, 4);

    return NextResponse.json({
      stats,
      recentArrivals: Array.isArray(recentArrivals) ? recentArrivals.slice(0, 5) : [],
      unavailableBooks,
    });
  } catch (error: any) {
    console.error("Library API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
