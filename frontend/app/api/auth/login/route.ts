import { NextRequest, NextResponse } from "next/server";
import { callMcpJson } from "@/lib/mcp-bridge";
import { signToken, comparePassword, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Verify credentials via academics MCP server
    const result = await callMcpJson("academics", "verify_student_login", { email, password });

    if (!result.success) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const student = result.student;

    // Verify password with bcrypt
    const isValid = await comparePassword(password, student.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Create JWT
    const token = signToken({
      studentId: student.student_id,
      name: student.name,
      email: student.email,
      major: student.major,
      year: student.year,
    });

    // Set cookie
    const response = NextResponse.json({
      success: true,
      student: {
        studentId: student.student_id,
        name: student.name,
        email: student.email,
        major: student.major,
        year: student.year,
        gpa: student.gpa,
      },
    });

    const isHttps =
      req.nextUrl.protocol === "https:" ||
      req.headers.get("x-forwarded-proto") === "https";

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Login error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Login failed: " + message }, { status: 500 });
  }
}
