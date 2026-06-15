#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 4005;

// ── SQLite Database Setup ───────────────────────────────────────────
const db = new Database(path.join(__dirname, "notifications.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'urgent')),
    created_date TEXT DEFAULT (datetime('now')),
    expiry_date TEXT,
    author TEXT,
    is_pinned INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS deadlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT NOT NULL,
    course_code TEXT,
    category TEXT DEFAULT 'assignment'
  );
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    announcement_id INTEGER NOT NULL,
    bookmarked_at TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, announcement_id)
  );
`);

const count = db.prepare("SELECT COUNT(*) as c FROM announcements").get();
if (count.c === 0) {
  const today = new Date();
  const d = (offset) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().split("T")[0];
  };
  const dt = (offset) => {
    const dtt = new Date(today);
    dtt.setDate(dtt.getDate() + offset);
    return dtt.toISOString().replace("T", " ").slice(0, 19);
  };

  const insertAnn = db.prepare(`
    INSERT INTO announcements (title, message, category, severity, created_date, expiry_date, author, is_pinned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const announcements = [
    ["Campus Wi-Fi Maintenance", "Wi-Fi will be intermittently unavailable in the Tech Building on Saturday from 2 AM to 6 AM for infrastructure upgrades.", "maintenance", "warning", dt(-1), d(3), "IT Services", 1],
    ["Library Extended Hours", "Starting this week, the Main Library will be open until midnight Sunday through Thursday for finals preparation.", "academic", "info", dt(-2), d(14), "Library Services", 1],
    ["New Student Portal Launch", "The new student portal is now live at portal.campus.edu. Please update your profile information by end of month.", "general", "info", dt(-3), d(30), "Registrar's Office", 0],
    ["Parking Lot B Closure", "Parking Lot B will be closed from June 15-20 for resurfacing. Please use Lot C or the campus shuttle.", "maintenance", "warning", dt(0), d(10), "Facilities Management", 1],
    ["Emergency Alert System Test", "An emergency alert system test will be conducted on Wednesday at 12:00 PM. You will receive a test notification on your phone.", "safety", "urgent", dt(0), d(2), "Campus Safety", 1],
    ["Summer Registration Open", "Summer 2026 course registration is now open. Priority registration ends this Friday.", "academic", "info", dt(-5), d(5), "Academic Affairs", 0],
    ["Health Center: Flu Vaccines Available", "Free flu vaccines are available at the Health Center. Walk-ins welcome Mon-Fri, 9 AM - 4 PM.", "health", "info", dt(-7), d(21), "Health Services", 0],
    ["Cafeteria Menu Update", "New vegan and gluten-free options have been added to the daily menu. Check the cafeteria section for details.", "general", "info", dt(-1), d(30), "Dining Services", 0],
    ["Campus Shuttle Route Change", "Route 3 (Science Building loop) has been temporarily rerouted due to construction. See updated map at transport.campus.edu.", "maintenance", "warning", dt(-2), d(7), "Transportation", 0],
    ["Scholarship Applications Due", "Applications for the 2026-27 Merit Scholarship are due in 5 days. Apply through the financial aid portal.", "academic", "urgent", dt(-10), d(5), "Financial Aid", 1],
  ];

  for (const a of announcements) insertAnn.run(...a);

  const insertDeadline = db.prepare(`
    INSERT INTO deadlines (title, description, due_date, course_code, category)
    VALUES (?, ?, ?, ?, ?)
  `);

  const deadlines = [
    ["CS301 Final Project", "Machine learning model submission with report", d(7), "CS301", "project"],
    ["MATH201 Problem Set 8", "Chapters 12-13 exercises", d(3), "MATH201", "assignment"],
    ["CS401 Code Review", "Peer code review for the e-commerce project", d(5), "CS401", "assignment"],
    ["Summer Registration Deadline", "Last day to register for summer courses", d(5), null, "administrative"],
    ["Library Book Returns", "All spring semester borrowed books must be returned", d(10), null, "administrative"],
    ["CS450 Lab Report", "Cybersecurity penetration testing lab report", d(4), "CS450", "lab"],
    ["Scholarship Application", "Merit scholarship application deadline", d(5), null, "financial"],
    ["PHY101 Midterm Exam", "Chapters 1-7 comprehensive exam", d(6), "PHY101", "exam"],
  ];

  for (const dl of deadlines) insertDeadline.run(...dl);
  console.error(`Seeded ${announcements.length} announcements + ${deadlines.length} deadlines into notifications.db`);
}

// ── MCP Server ──────────────────────────────────────────────────────
const server = new Server(
  { name: "notifications-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_announcements",
      description: "Get active campus announcements and notices",
      inputSchema: {
        type: "object",
        properties: {
          severity: { type: "string", description: "Filter by severity: info, warning, or urgent" },
          limit: { type: "number", description: "Max announcements (default: 10)" },
        },
      },
    },
    {
      name: "get_pinned_alerts",
      description: "Get the most important pinned announcements",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_deadlines",
      description: "Get upcoming assignment deadlines and important dates",
      inputSchema: {
        type: "object",
        properties: {
          studentId: { type: "string", description: "Student ID for personalized deadlines (optional)" },
          days_ahead: { type: "number", description: "Number of days to look ahead (default: 14)" },
        },
      },
    },
    {
      name: "search_announcements",
      description: "Search announcements by keyword",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword" },
        },
        required: ["query"],
      },
    },
    {
      name: "bookmark_announcement",
      description: "Bookmark an announcement for a student for later reference",
      inputSchema: {
        type: "object",
        properties: {
          announcementId: { type: "number", description: "Announcement ID to bookmark" },
          studentId: { type: "string", description: "Student ID" },
        },
        required: ["announcementId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const today = new Date().toISOString().split("T")[0];

  switch (name) {
    case "get_announcements": {
      let sql = "SELECT * FROM announcements WHERE (expiry_date IS NULL OR expiry_date >= ?)";
      const params = [today];
      if (args.severity) {
        sql += " AND severity = ?";
        params.push(args.severity);
      }
      sql += " ORDER BY is_pinned DESC, created_date DESC LIMIT ?";
      params.push(args.limit || 10);
      const anns = db.prepare(sql).all(...params);
      return { content: [{ type: "text", text: JSON.stringify(anns, null, 2) }] };
    }

    case "get_pinned_alerts": {
      const alerts = db.prepare(
        "SELECT * FROM announcements WHERE is_pinned = 1 AND (expiry_date IS NULL OR expiry_date >= ?) ORDER BY severity DESC, created_date DESC"
      ).all(today);
      return { content: [{ type: "text", text: JSON.stringify(alerts, null, 2) }] };
    }

    case "get_deadlines": {
      const daysAhead = args.days_ahead || 14;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      const futureStr = futureDate.toISOString().split("T")[0];

      let sql = "SELECT * FROM deadlines WHERE due_date >= ? AND due_date <= ?";
      const params = [today, futureStr];

      if (args.studentId) {
        // Filter to deadlines for courses the student is enrolled in, plus general deadlines
        sql = `SELECT d.* FROM deadlines d WHERE d.due_date >= ? AND d.due_date <= ?
               AND (d.course_code IS NULL OR d.course_code IN (
                 SELECT e.course_code FROM enrollments e WHERE e.student_id = ?
               ))`;
        params.push(args.studentId);
      }

      sql += " ORDER BY due_date ASC";
      // Note: We need to connect to academics DB for student enrollments.
      // For now, return all deadlines.
      const deadlines = db.prepare("SELECT * FROM deadlines WHERE due_date >= ? AND due_date <= ? ORDER BY due_date ASC").all(today, futureStr);
      return { content: [{ type: "text", text: JSON.stringify(deadlines, null, 2) }] };
    }

    case "search_announcements": {
      const query = `%${args.query.toLowerCase()}%`;
      const results = db.prepare(
        "SELECT * FROM announcements WHERE LOWER(title) LIKE ? OR LOWER(message) LIKE ? ORDER BY created_date DESC"
      ).all(query, query);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    case "bookmark_announcement": {
      const announcementId = args.announcementId;
      const studentId = args.studentId || "STU001";
      const ann = db.prepare("SELECT * FROM announcements WHERE id = ?").get(announcementId);
      if (!ann) return { content: [{ type: "text", text: "Announcement not found" }], isError: true };
      try {
        db.prepare("INSERT INTO bookmarks (student_id, announcement_id) VALUES (?, ?)").run(studentId, announcementId);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `"${ann.title}" has been bookmarked.` }) }] };
      } catch {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, reason: "Already bookmarked" }) }] };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ── HTTP/SSE Transport ──────────────────────────────────────────────
const app = express();
app.use(cors());

let transport;

app.get("/sse", async (req, res) => {
  if (transport) {
    try {
      await server.close();
    } catch (e) {}
  }
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
  console.error("Client connected to Notifications MCP Server via SSE");
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: "No active SSE connection" });
  }
});

app.post("/rpc", express.json(), (req, res) => {
  const { jsonrpc, method, params, id } = req.body;
  const today = new Date().toISOString().split("T")[0];

  try {
    let result;
    switch (method) {
      case "get_announcements": {
        let sql = "SELECT * FROM announcements WHERE (expiry_date IS NULL OR expiry_date >= ?)";
        const sqlParams = [today];
        if (params?.severity) {
          sql += " AND severity = ?";
          sqlParams.push(params.severity);
        }
        sql += " ORDER BY is_pinned DESC, created_date DESC LIMIT ?";
        sqlParams.push(params?.limit || 10);
        result = db.prepare(sql).all(...sqlParams);
        break;
      }
      case "get_pinned_alerts": {
        result = db.prepare(
          "SELECT * FROM announcements WHERE is_pinned = 1 AND (expiry_date IS NULL OR expiry_date >= ?) ORDER BY severity DESC, created_date DESC"
        ).all(today);
        break;
      }
      case "get_deadlines": {
        const daysAhead = params?.days_ahead || 14;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);
        const futureStr = futureDate.toISOString().split("T")[0];
        result = db.prepare("SELECT * FROM deadlines WHERE due_date >= ? AND due_date <= ? ORDER BY due_date ASC").all(today, futureStr);
        break;
      }
      case "search_announcements": {
        const query = `%${(params?.query || "").toLowerCase()}%`;
        result = db.prepare(
          "SELECT * FROM announcements WHERE LOWER(title) LIKE ? OR LOWER(message) LIKE ? ORDER BY created_date DESC"
        ).all(query, query);
        break;
      }
      case "bookmark_announcement": {
        const announcementId = params?.announcementId;
        const studentId = params?.studentId || "STU001";
        const ann = db.prepare("SELECT * FROM announcements WHERE id = ?").get(announcementId);
        if (!ann) return res.status(404).json({ error: "Announcement not found" });
        try {
          db.prepare("INSERT INTO bookmarks (student_id, announcement_id) VALUES (?, ?)").run(studentId, announcementId);
          result = { success: true, message: `"${ann.title}" has been bookmarked.` };
        } catch {
          result = { success: false, reason: "Already bookmarked" };
        }
        break;
      }
      case "get_user_bookmarks": {
        const studentId = params?.studentId || "STU001";
        result = db.prepare(
          "SELECT a.* FROM announcements a INNER JOIN bookmarks b ON a.id = b.announcement_id WHERE b.student_id = ? ORDER BY b.id DESC"
        ).all(studentId);
        break;
      }
      case "remove_bookmark": {
        const announcementId = params?.announcementId;
        const studentId = params?.studentId || "STU001";
        db.prepare("DELETE FROM bookmarks WHERE student_id = ? AND announcement_id = ?").run(studentId, announcementId);
        result = { success: true };
        break;
      }
      case "get_announcement_bookmarks": {
        const studentId = params?.studentId || "STU001";
        const rows = db.prepare("SELECT announcement_id FROM bookmarks WHERE student_id = ?").all(studentId);
        result = rows.map(r => r.announcement_id);
        break;
      }
      default:
        return res.status(404).json({ error: `Unknown method: ${method}` });
    }
    res.json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", server: "notifications-mcp-server", port: PORT });
});

const httpServer = app.listen(PORT, "0.0.0.0", () => {
  console.error(`Notifications MCP Server running on http://127.0.0.1:${PORT}`);
});

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Notifications MCP Server failed: port ${PORT} is already in use.`);
  } else {
    console.error("Notifications MCP Server failed to start:", error);
  }
  process.exit(1);
});
