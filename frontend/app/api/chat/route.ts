import { NextRequest, NextResponse } from "next/server";
import { queryAI } from "@/lib/ai-providers";
import { getAllTools, callMcp, getServerDescriptions } from "@/lib/mcp-bridge";
import { getSession } from "@/lib/auth";

type ToolCallArgs = Record<string, unknown>;

// ── Response cache (saves AI credits on repeated queries) ───────────
const queryCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 1000; // Temporarily disabled for testing (was 2 * 60 * 1000)

// ── Server-side conversation history per student ────────────────────
// Keeps last N turns in memory for multi-turn context
const conversationStore = new Map<string, Array<{ role: string; content: string }>>();
const MAX_HISTORY_TURNS = 10; // keep last 10 exchanges (20 messages)

function getConversationHistory(studentKey: string): Array<{ role: string; content: string }> {
  return conversationStore.get(studentKey) || [];
}

function appendToHistory(studentKey: string, role: string, content: string) {
  if (!conversationStore.has(studentKey)) {
    conversationStore.set(studentKey, []);
  }
  const history = conversationStore.get(studentKey)!;
  history.push({ role, content });
  // Trim to last MAX_HISTORY_TURNS * 2 messages (user + assistant per turn)
  while (history.length > MAX_HISTORY_TURNS * 2) {
    history.shift();
  }
}

// ── Smart keyword scoring for fallback ──────────────────────────────
const KEYWORD_SCORES: Record<string, string[]> = {
  library: ["book", "library", "available", "borrow", "shelf", "isbn", "hold", "copy", "checkout", "return", "reading", "author"],
  cafeteria: ["menu", "food", "lunch", "dinner", "breakfast", "meal", "eat", "cafeteria", "vegan", "vegetarian", "price", "calorie", "snack", "drink"],
  events: ["event", "fest", "workshop", "club", "happening", "rsvp", "concert", "hackathon", "competition", "sports", "activity", "register", "attend"],
  academics: ["course", "class", "exam", "syllabus", "credit", "professor", "grade", "schedule", "timetable", "enrollment", "lecture", "assignment", "homework", "instructor"],
  notifications: ["alert", "notification", "announce", "deadline", "urgent", "news", "reminder", "update", "notice", "bookmark", "warning"],
};

function scoreQuery(query: string): Record<string, number> {
  const lower = query.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [server, keywords] of Object.entries(KEYWORD_SCORES)) {
    scores[server] = keywords.filter((k) => lower.includes(k)).length;
  }
  return scores;
}

function getBestServer(query: string): { server: string; score: number } {
  const scores = scoreQuery(query);
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return { server: sorted[0][0], score: sorted[0][1] };
}

// ── Rich formatters for fallback responses ──────────────────────────
function formatCourses(data: any[]): string {
  if (!Array.isArray(data) || data.length === 0) return "No courses found.";
  let md = "📚 **Your Enrolled Courses:**\n\n";
  for (const c of data) {
    const gradeStr = c.grade ? ` — Grade: **${c.grade}**` : " — _In Progress_";
    md += `**${c.code}: ${c.name}**${gradeStr}\n`;
    md += `- 👨‍🏫 ${c.instructor} | 🕐 ${c.schedule}\n`;
    md += `- 📍 ${c.location}, ${c.building} | Credits: ${c.credits}\n\n`;
  }
  return md;
}

function formatSchedule(data: any): string {
  const courses = data?.schedule || data;
  if (!Array.isArray(courses) || courses.length === 0) return "No schedule found.";
  let md = "🗓️ **Your Weekly Schedule:**\n\n";
  for (const c of courses) {
    md += `- **${c.code} — ${c.name}**: ${c.schedule} at ${c.location} (${c.building})\n`;
  }
  return md;
}

function formatBooks(data: any[]): string {
  if (!Array.isArray(data) || data.length === 0) return "📚 No books matched your search. Try a different keyword!";
  let md = "📖 **Library Search Results:**\n\n";
  for (const b of data.slice(0, 8)) {
    const avail = b.available ?? b.available_copies;
    const total = b.total_copies || "?";
    const status = avail > 0 ? `✅ ${avail}/${total} available` : `❌ All ${total} copies checked out`;
    const loc = b.location ? ` | 📍 ${b.location}` : "";
    md += `**${b.title}** by _${b.author}_\n`;
    md += `- Genre: ${b.genre} | ${status}${loc}\n`;
    if (b.description) md += `- _${b.description.substring(0, 80)}..._\n`;
    md += "\n";
  }
  return md;
}

function formatMeal(data: any): string {
  if (!data) return "🍽️ No meal information available right now.";
  const items = data.items || [];
  const mealName = (data.currentMeal || "").charAt(0).toUpperCase() + (data.currentMeal || "").slice(1);
  let md = `🍽️ **Currently Serving: ${mealName}** (${data.day || "today"})\n\n`;
  if (items.length === 0) {
    md += "_No items on the menu right now._\n";
  } else {
    for (const item of items) {
      const tags = [];
      if (item.is_vegetarian) tags.push("🌿");
      if (item.is_vegan) tags.push("🌱");
      const price = `₹${(item.price * 84).toFixed(0)}`;
      md += `- **${item.item_name}** (${item.category}) — ${price} | ${item.calories} cal`;
      if (tags.length > 0) md += ` ${tags.join(" ")}`;
      md += `\n`;
    }
  }
  if (data.time) md += `\n_Menu as of ${data.time}_`;
  return md;
}

function formatEvents(data: any[]): string {
  if (!Array.isArray(data) || data.length === 0) return "🎉 No upcoming events found.";
  let md = "🎉 **Upcoming Campus Events:**\n\n";
  for (const e of data) {
    const dateStr = new Date(e.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const spots = e.max_attendees
      ? (e.max_attendees - e.current_attendees > 0 ? `${e.max_attendees - e.current_attendees} spots left` : "Full")
      : "No limit";
    const attendees = e.current_attendees || 0;
    const free = e.is_free ? "🆓 Free" : "💰 Paid";
    md += `**${e.title}**\n`;
    md += `- 📅 ${dateStr}, ${e.time}–${e.end_time} | 📍 ${e.location}, ${e.building}\n`;
    md += `- ${free} | ${attendees} registered • ${spots} | By: ${e.organizer}\n`;
    md += `- _${e.description}_\n\n`;
  }
  return md;
}

function formatAlerts(data: any[]): string {
  if (!Array.isArray(data) || data.length === 0) return "✅ No active alerts right now.";
  const severityEmoji: Record<string, string> = { urgent: "🔴", warning: "🟡", info: "🔵" };
  let md = "📢 **Campus Alerts & Announcements:**\n\n";
  for (const a of data) {
    const emoji = severityEmoji[a.severity] || "ℹ️";
    md += `${emoji} **${a.title}**\n`;
    md += `- ${a.message}\n`;
    md += `- _By ${a.author}${a.expiry_date ? ` • Expires: ${a.expiry_date}` : ""}_\n\n`;
  }
  return md;
}

// ── RPC helpers ─────────────────────────────────────────────────────
const RPC_URLS: Record<string, string> = {
  library: process.env.MCP_LIBRARY_URL || "http://127.0.0.1:4001",
  cafeteria: process.env.MCP_CAFETERIA_URL || "http://127.0.0.1:4002",
  events: process.env.MCP_EVENTS_URL || "http://127.0.0.1:4003",
  academics: process.env.MCP_ACADEMICS_URL || "http://127.0.0.1:4004",
  notifications: process.env.MCP_NOTIFICATIONS_URL || "http://127.0.0.1:4005",
};

async function callRpc(server: string, method: string, params: Record<string, unknown> = {}): Promise<any> {
  const url = RPC_URLS[server];
  if (!url) throw new Error(`Unknown server: ${server}`);
  const res = await fetch(`${url}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  if (!res.ok) throw new Error(`RPC call to ${server}/${method} failed: ${res.status}`);
  const json = await res.json();
  return json.result;
}

// ── Smart fallback — score-based keyword matching + rich formatting ──
async function queryCampusData(query: string, studentId?: string) {
  const q = query.toLowerCase();
  const { server: bestServer, score: bestScore } = getBestServer(query);

  try {
    // If no keywords matched at all, try to give a helpful overview
    if (bestScore === 0) {
      const [alerts, events, meal] = await Promise.all([
        callRpc("notifications", "get_pinned_alerts", {}).catch(() => []),
        callRpc("events", "get_upcoming_events", { limit: 2 }).catch(() => []),
        callRpc("cafeteria", "get_current_meal", {}).catch(() => null),
      ]);

      const parts: string[] = ["👋 **Hey there! Here's what's happening on campus:**\n"];
      if (Array.isArray(alerts) && alerts.length > 0) parts.push(`🔔 **Campus Alert:** ${alerts[0].title} — ${alerts[0].message}`);
      if (meal) parts.push(`🍽️ **Today's ${meal.currentMeal}:** ${(meal.items || []).slice(0, 2).map((i: any) => i.item_name).join(", ")}`);
      if (Array.isArray(events) && events.length > 0) parts.push(`🎉 **Upcoming:** ${events[0].title} on ${events[0].date} at ${events[0].time}`);
      parts.push("\n_Try asking about the **library**, **cafeteria menu**, **upcoming events**, **your courses**, or **campus alerts**!_");
      return { answer: parts.join("\n"), sources: ["notifications", "cafeteria", "events"] };
    }

    // Route to the best-scoring server with rich formatting
    switch (bestServer) {
      case "library": {
        // Extract a search term from the query
        const searchTerm = q.match(/["']([^"']+)["']|(?:book|find|search|borrow)\s+(.+)/i)?.[1]
          || q.replace(/is|the|available|find|search|book|library|can|i|a|an|in/g, "").trim()
          || "a";
        const data = await callRpc("library", "search_books", { query: searchTerm });
        return { answer: formatBooks(Array.isArray(data) ? data : []), sources: ["library"] };
      }

      case "academics": {
        // Check for specific course code
        const courseMatch = q.match(/\b([a-z]{2,4}\d{3})\b/i);
        if (courseMatch) {
          const data = await callRpc("academics", "get_course_details", { courseCode: courseMatch[1].toUpperCase() });
          const course = data as any;
          if (course && !course.error) {
            return {
              answer: `📚 **${course.code} — ${course.name}**\n\n👨‍🏫 Instructor: ${course.instructor}\n📍 Location: ${course.location}, ${course.building}\n⏰ Schedule: ${course.schedule}\n💡 ${course.description}\n\n📋 **Spots remaining:** ${course.spotsRemaining} of ${course.max_enrollment}`,
              sources: ["academics"],
            };
          }
        }
        // Check for schedule-related keywords
        if (q.includes("schedule") || q.includes("timetable") || q.includes("time")) {
          const data = await callRpc("academics", "get_student_schedule", { studentId: studentId || "STU001" });
          return { answer: formatSchedule(data), sources: ["academics"] };
        }
        // Default: show enrolled courses
        const data = await callRpc("academics", "get_student_courses", { studentId: studentId || "STU001" });
        return { answer: formatCourses(Array.isArray(data) ? data : []), sources: ["academics"] };
      }

      case "cafeteria": {
        const data = await callRpc("cafeteria", "get_current_meal", {});
        return { answer: formatMeal(data), sources: ["cafeteria"] };
      }

      case "events": {
        const data = await callRpc("events", "get_upcoming_events", { limit: 6 });
        return { answer: formatEvents(Array.isArray(data) ? data : []), sources: ["events"] };
      }

      case "notifications": {
        const [alerts, deadlines] = await Promise.all([
          callRpc("notifications", "get_pinned_alerts", {}),
          callRpc("notifications", "get_deadlines", { days_ahead: 14 }).catch(() => []),
        ]);
        const alertText = formatAlerts(Array.isArray(alerts) ? alerts : []);
        const dlText = Array.isArray(deadlines) && deadlines.length > 0
          ? `\n\n📅 **Upcoming Deadlines:**\n${deadlines.slice(0, 4).map((d: any) => `• **${d.title}** — Due ${d.due_date}${d.course_code ? ` (${d.course_code})` : ""}`).join("\n")}`
          : "";
        return { answer: alertText + dlText, sources: ["notifications"] };
      }
    }

    // Shouldn't reach here but just in case
    return { answer: "I couldn't find relevant information for that question.", sources: [] };
  } catch (error: any) {
    console.error("queryCampusData RPC error:", error.message);
    return {
      answer: "⚠️ Sorry, I couldn't connect to the campus servers right now. Please make sure the MCP servers are running (`node start.js --dev`).",
      sources: [],
    };
  }
}

// ── System prompt ───────────────────────────────────────────────────
function buildSystemPrompt(studentContext: string): string {
  return `You are a helpful, friendly, and concise AI assistant for Campus Hub — a unified student portal.
You have access to real-time data from five campus services via tools (MCP servers):

IMPORTANT: WHEN A STUDENT ASKS ABOUT "CURRENT", "TODAY", OR ANYTHING TIME-SENSITIVE (eg. "what should i do now", "what's happening today", "is anything open"), YOU MUST ALWAYS call the events server's get_upcoming_events tool or the cafeteria server's get_current_meal tool to get live data.
NEVER rely on static time strings or assume what time it is. Always fetch current info from the servers.

NEVER make up campus-specific information. If a student asks for something you don't have data for, respond with: "I don't have that information right now. Try asking about [related topics]."

If a student asks for something that requires multiple tools, you should:
1. Call the first tool
2. Wait for the response
3. Call the next tool with the information from the previous response
4. Repeat until you have all the information needed to answer the question

You must **not** use the word "schedule" when referring to library book availability. Instead, use phrases like "Available copies: X of Y".
**Understand intent**: Parse the student's question and determine which data source(s) to query.
**Use tools**: Always use the provided tools to fetch real data. 
   - If a student asks "What events did I register for?" or mentions "my RSVPs", you MUST invoke the \`events__get_student_rsvps\` tool using their Student ID context.
**NEVER make up campus-specific information**...;
${getServerDescriptions()}
${studentContext}

## Your Responsibilities
1. **Understand intent**: Parse the student's question and determine which data source(s) to query.
2. **Use tools**: Always use the provided tools to fetch real data. NEVER make up campus-specific information like book availability, menu items, event dates, or course details.
3. **Multi-source queries**: If a question spans multiple services (e.g., "What should I do today?"), query all relevant servers and combine the answer.
4. **Format clearly**: Use markdown — bullet points, bold text, and emojis — to make answers scannable and friendly.
5. **Be actionable**: Include specifics like locations, times, availability counts, and prices when available.
6. **Stay scoped**: If a question is unrelated to campus life, politely redirect — "I specialize in campus info! Try asking about your courses, library books, today's menu, events, or alerts."
7. **Conversation context**: You may receive conversation history. Use it to understand follow-up questions like "Can I borrow the second one?" or "What about tomorrow?"

## Formatting Guidelines
- Use ₹ (Rupees) for cafeteria prices (multiply USD price by 84)
- Show availability as "X/Y available" for library books
- For events, mention registration count and whether spots are limited
- Keep responses concise — 2-4 paragraphs max unless listing many items`;
}

// ── Action derivation ───────────────────────────────────────────────
type ActionType = "rsvp" | "hold" | "favorite" | "bookmark" | "add_to_calendar" | "set_dietary_alert";
interface ChatAction {
  type: ActionType;
  label: string;
  payload?: Record<string, unknown>;
}

function deriveActions(sources: string[], query: string, payload: Record<string, any> = {}): ChatAction[] {
  const actions: ChatAction[] = [];
  const q = query.toLowerCase();

  if (sources.includes("events")) {
    actions.push({ type: "rsvp", label: "✅ RSVP to Event", payload: { eventId: payload.eventId } });
    actions.push({ type: "add_to_calendar", label: "📅 Add to Calendar", payload: {} });
  }
  if (sources.includes("library")) {
    actions.push({ type: "hold", label: "📚 Place a Hold", payload: { bookId: payload.bookId } });
  }
  if (sources.includes("cafeteria")) {
    actions.push({ type: "favorite", label: "❤️ Mark Favorite", payload: { itemId: payload.itemId } });
    if (q.includes("diet") || q.includes("vegan") || q.includes("allerg") || q.includes("vegetar")) {
      actions.push({ type: "set_dietary_alert", label: "🔔 Set Dietary Alert", payload: {} });
    }
  }
  if (sources.includes("notifications") || sources.includes("academics")) {
    actions.push({ type: "bookmark", label: "🔖 Bookmark", payload: { announcementId: payload.announcementId } });
  }

  return actions;
}

// ── Main POST handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { query, history } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Get student context for personalization
    const session = await getSession();
    const studentKey = session?.studentId || "anonymous";
    const studentContext = session
      ? `\nThe current student is: ${session.name} (ID: ${session.studentId}, Major: ${session.major}, Year: ${session.year}). When they ask about "my courses" or "my schedule", use their student ID.`
      : "";

    // Build conversation history: merge frontend history with server-side store
    // Frontend sends recent messages; we also maintain server-side for cache scenarios
    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (Array.isArray(history) && history.length > 0) {
      // Use frontend-provided history (most accurate)
      conversationHistory = history.slice(-MAX_HISTORY_TURNS * 2);
    } else {
      // Fall back to server-side history
      conversationHistory = getConversationHistory(studentKey);
    }

    // Check cache (use query + last 2 history messages as key for context-aware caching)
    const historyContext = conversationHistory.slice(-2).map((m) => `${m.role}:${m.content}`).join("|");
    const cacheKey = `${studentKey}_${query.toLowerCase().trim()}_${historyContext}`;
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[Chat Cache] Serving cached response for: "${query}"`);
      return NextResponse.json(cached.result);
    }

    const systemPrompt = buildSystemPrompt(studentContext);
    const tools = await getAllTools();

    const callToolWrapper = async (server: string, toolName: string, args: ToolCallArgs) => {
      const result = await callMcp(server, toolName, args);
      let rawData;
      if (Array.isArray(result) && result.length > 0 && result[0].type === "text") {
        rawData = result[0].text;
      } else {
        rawData = JSON.stringify(result);
      }
      return `Here is the raw data found from the ${server} server: ${rawData}. Synthesize this into a natural, friendly answer for the student.`;
    };

    // Try AI providers (with retry + backoff built in)
    const response = await queryAI(systemPrompt, query, tools, callToolWrapper, conversationHistory);

    let mode: "ai" | "fallback" = "ai";

    // If AI providers all failed, use smart keyword fallback
    if (response.toolCalls.length === 0 && response.answer.includes("Both AI providers are unavailable")) {
      console.log(`[Chat] AI unavailable — using smart keyword fallback for: "${query}"`);
      const fallback = await queryCampusData(query, session?.studentId);
      mode = "fallback";

      // Store in conversation history
      appendToHistory(studentKey, "user", query);
      appendToHistory(studentKey, "assistant", fallback.answer);

      const result = { ...fallback, actions: deriveActions(fallback.sources || [], query), mode };
      queryCache.set(cacheKey, { result, timestamp: Date.now() });
      return NextResponse.json(result);
    }

    const sources = [...new Set(response.toolCalls.map((tc) => tc.server))];

    // Extract entity IDs from tool call arguments for action payloads
    const actionPayloads: Record<string, any> = {};
    for (const tc of response.toolCalls) {
      if (tc.server === "events" && tc.args?.eventId) actionPayloads.eventId = tc.args.eventId;
      if (tc.server === "library" && tc.args?.bookId) actionPayloads.bookId = tc.args.bookId;
      if (tc.server === "cafeteria" && tc.args?.itemId) actionPayloads.itemId = tc.args.itemId;
      if (tc.server === "notifications" && tc.args?.announcementId) actionPayloads.announcementId = tc.args.announcementId;
    }

    const resultData = {
      answer: response.answer,
      sources,
      actions: deriveActions(sources, query, actionPayloads),
      mode,
    };

    // Store in conversation history
    appendToHistory(studentKey, "user", query);
    appendToHistory(studentKey, "assistant", response.answer);

    queryCache.set(cacheKey, { result: resultData, timestamp: Date.now() });

    return NextResponse.json(resultData);
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to process query", message },
      { status: 500 }
    );
  }
}
