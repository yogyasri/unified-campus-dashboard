import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const ACADEMICS_URL = process.env.MCP_ACADEMICS_URL || "http://127.0.0.1:4004";

async function callRpc(method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${ACADEMICS_URL}/rpc`, {
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

    const [courses, scheduleData] = await Promise.all([
      callRpc("get_student_courses", { studentId }),
      callRpc("get_student_schedule", { studentId }),
    ]);

    return NextResponse.json({
      courses: Array.isArray(courses) ? courses : [],
      schedule: scheduleData?.schedule || [],
      studentId,
    });
  } catch (error: any) {
    console.error("Academics API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
