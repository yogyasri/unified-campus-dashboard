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
const PORT = process.env.PORT || 4003;

// ── SQLite Database Setup ───────────────────────────────────────────
const db = new Database(path.join(__dirname, "events.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    end_time TEXT,
    location TEXT,
    building TEXT,
    description TEXT,
    organizer TEXT,
    category TEXT,
    is_free INTEGER DEFAULT 1,
    registration_url TEXT,
    max_attendees INTEGER,
    current_attendees INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    rsvped_at TEXT DEFAULT (datetime('now')),
    UNIQUE(event_id, student_id)
  );
`);

const count = db.prepare("SELECT COUNT(*) as c FROM events").get();
if (count.c === 0) {
  const insert = db.prepare(`
    INSERT INTO events (title, date, time, end_time, location, building, description, organizer, category, is_free, max_attendees, current_attendees)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Generate events relative to current date
  const today = new Date();
  const d = (offset) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().split("T")[0];
  };

  const events = [
    ["Tech Talk: AI in Education", d(2), "14:00", "15:30", "Auditorium A", "Science Building", "Learn about the latest AI developments transforming education, featuring guest speakers from leading tech companies.", "Computer Science Department", "Technology", 1, 200, 142],
    ["Career Fair 2026", d(5), "10:00", "16:00", "Grand Hall", "Student Center", "Meet recruiters from 50+ top companies including Google, Microsoft, Amazon, and more. Bring your resume!", "Career Services", "Career", 1, 500, 387],
    ["Campus Concert: Acoustic Night", d(8), "19:00", "22:00", "Main Auditorium", "Arts Center", "Live acoustic performances by talented student bands and solo artists. Free entry for all students.", "Student Activities", "Entertainment", 1, 300, 210],
    ["Workshop: React & Next.js", d(3), "15:00", "17:00", "Lab B-201", "Tech Building", "Hands-on workshop building modern web apps with React 19 and Next.js. Bring your laptop!", "Tech Club", "Workshop", 1, 40, 35],
    ["Library Book Sale", d(6), "09:00", "17:00", "Library Lobby", "Main Library", "Huge sale on used textbooks and fiction. Prices start at $1. Great deals on last semester's materials.", "Library Department", "Sale", 1, null, 0],
    ["Hackathon: Green Campus", d(10), "09:00", "21:00", "Innovation Hub", "Tech Building", "24-hour hackathon focused on sustainable campus solutions. Teams of 3-5. Prizes worth $5000!", "Engineering Society", "Competition", 1, 100, 78],
    ["Guest Lecture: Quantum Computing", d(4), "11:00", "12:30", "Lecture Hall 1", "Science Building", "Prof. Elena Martinez from MIT discusses the future of quantum computing and its applications.", "Physics Department", "Academic", 1, 150, 98],
    ["Student Government Elections", d(7), "08:00", "20:00", "Student Center Atrium", "Student Center", "Vote for your student body president and representatives. Student ID required.", "Student Government", "Governance", 1, null, 0],
    ["Yoga & Meditation Session", d(1), "07:00", "08:00", "Campus Green", "Outdoor", "Start your day with guided yoga and meditation. Mats provided. All skill levels welcome.", "Wellness Center", "Health", 1, 50, 32],
    ["Film Screening: Documentary Night", d(9), "18:30", "21:00", "Cinema Room", "Arts Center", "Screening of award-winning documentary 'Connected' followed by Q&A with the director.", "Film Society", "Entertainment", 1, 80, 45],
    ["Research Symposium", d(12), "09:00", "17:00", "Conference Center", "Admin Building", "Annual undergraduate research symposium. 50+ poster presentations across all departments.", "Academic Affairs", "Academic", 1, 200, 120],
    ["Coding Competition", d(6), "13:00", "18:00", "Computer Lab A", "Tech Building", "Competitive programming contest with problems from easy to expert level. Individual participation.", "ACM Chapter", "Competition", 1, 60, 48],
    ["International Food Festival", d(11), "11:00", "15:00", "Campus Quad", "Outdoor", "Taste dishes from 20+ countries prepared by international student associations. $5 for unlimited tastings.", "International Students Association", "Cultural", 0, 400, 280],
    ["Photography Workshop", d(3), "16:00", "18:00", "Art Studio 2", "Arts Center", "Learn composition, lighting, and editing techniques. DSLR cameras provided if needed.", "Photography Club", "Workshop", 1, 25, 18],
    ["Basketball Tournament", d(14), "10:00", "18:00", "Sports Complex", "Athletics Building", "Annual inter-department basketball tournament. Teams of 5. Register by Friday.", "Athletics Department", "Sports", 1, 80, 64],
    ["Mental Health Awareness Week Kickoff", d(2), "10:00", "12:00", "Wellness Center", "Health Building", "Opening ceremony with keynote speaker Dr. Sarah Kim on student mental health strategies.", "Counseling Services", "Health", 1, 100, 67],
    ["Startup Pitch Night", d(8), "18:00", "20:30", "Innovation Hub", "Tech Building", "Watch student startups pitch to a panel of VCs and angel investors. Networking reception after.", "Entrepreneurship Club", "Career", 1, 120, 95],
    ["Open Mic Night", d(13), "20:00", "22:30", "Student Lounge", "Student Center", "Share your poetry, comedy, music, or spoken word. Sign up at the door. Refreshments provided.", "Creative Arts Society", "Entertainment", 1, 60, 0],
  ];

  const insertMany = db.transaction((events) => {
    for (const e of events) insert.run(...e);
  });
  insertMany(events);
  console.error(`Seeded ${events.length} events into events.db`);
}

// ── MCP Server ──────────────────────────────────────────────────────
const server = new Server(
  { name: "events-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_upcoming_events",
      description: "Get a list of upcoming campus events, sorted by date",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max events to return (default: 5)" },
        },
      },
    },
    {
      name: "search_events",
      description: "Search for events by title, description, or organizer",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_event_details",
      description: "Get detailed information about a specific event by ID",
      inputSchema: {
        type: "object",
        properties: {
          eventId: { type: "number", description: "Event ID" },
        },
        required: ["eventId"],
      },
    },
    {
      name: "get_events_by_category",
      description: "Get events filtered by category (Technology, Career, Entertainment, Workshop, Academic, Sports, Health, Cultural, Competition, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          category: { type: "string", description: "Event category" },
        },
        required: ["category"],
      },
    },
    {
      name: "get_events_today",
      description: "Get all events happening today",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "rsvp_event",
      description: "RSVP a student to an event, incrementing attendee count",
      inputSchema: {
        type: "object",
        properties: {
          eventId: { type: "number", description: "Event ID to RSVP to" },
          studentId: { type: "string", description: "Student ID" },
        },
        required: ["eventId"],
      },
    },
    {
      name: "get_student_rsvps",
      description: "Get a list of events the student has RSVP'd to",
      inputSchema: {
        type: "object",
        properties: {
          studentId: { type: "string", description: "Student ID" },
        },
        required: ["studentId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const today = new Date().toISOString().split("T")[0];

  switch (name) {
    case "get_upcoming_events": {
      const limit = args.limit || 5;
      const events = db.prepare("SELECT * FROM events WHERE date >= ? ORDER BY date, time LIMIT ?").all(today, limit);
      return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
    }

    case "search_events": {
      const query = `%${args.query.toLowerCase()}%`;
      const events = db.prepare(
        "SELECT * FROM events WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(organizer) LIKE ? ORDER BY date"
      ).all(query, query, query);
      return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
    }

    case "get_event_details": {
      const event = db.prepare("SELECT * FROM events WHERE id = ?").get(args.eventId);
      if (!event) return { content: [{ type: "text", text: "Event not found" }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(event, null, 2) }] };
    }

    case "get_events_by_category": {
      const events = db.prepare("SELECT * FROM events WHERE LOWER(category) = ? AND date >= ? ORDER BY date").all(args.category.toLowerCase(), today);
      return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
    }

    case "get_events_today": {
      const events = db.prepare("SELECT * FROM events WHERE date = ? ORDER BY time").all(today);
      return { content: [{ type: "text", text: JSON.stringify({ today, events }, null, 2) }] };
    }

    case "rsvp_event": {
      const eventId = args.eventId;
      const studentId = args.studentId || "STU001";
      const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
      if (!event) return { content: [{ type: "text", text: "Event not found" }], isError: true };
      if (event.max_attendees && event.current_attendees >= event.max_attendees) {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, reason: "Event is full" }) }] };
      }
      try {
        db.prepare("INSERT INTO rsvps (event_id, student_id) VALUES (?, ?)").run(eventId, studentId);
        db.prepare("UPDATE events SET current_attendees = current_attendees + 1 WHERE id = ?").run(eventId);
        const updated = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, event: updated }) }] };
      } catch {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, reason: "Already RSVPed" }) }] };
      }
    }

    case "get_student_rsvps": {
      const studentId = args.studentId || "STU001";
      const rows = db.prepare("SELECT event_id FROM rsvps WHERE student_id = ?").all(studentId);
      const rsvpEventIds = rows.map(r => r.event_id);
      
      if (rsvpEventIds.length === 0) {
        return { content: [{ type: "text", text: "[]" }] };
      }
      
      const placeholders = rsvpEventIds.map(() => "?").join(",");
      const events = db.prepare(`SELECT * FROM events WHERE id IN (${placeholders}) ORDER BY date, time`).all(...rsvpEventIds);
      return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
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
    } catch (e) { }
  }
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
  console.error("Client connected to Events MCP Server via SSE");
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
      case "get_upcoming_events": {
        const limit = params?.limit || 5;
        result = db.prepare("SELECT * FROM events WHERE date >= ? ORDER BY date, time LIMIT ?").all(today, limit);
        break;
      }
      case "search_events": {
        const query = `%${(params?.query || "").toLowerCase()}%`;
        result = db.prepare("SELECT * FROM events WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(organizer) LIKE ? ORDER BY date").all(query, query, query);
        break;
      }
      case "get_event_details": {
        result = db.prepare("SELECT * FROM events WHERE id = ?").get(params?.eventId);
        if (!result) return res.status(404).json({ error: "Event not found" });
        break;
      }
      case "get_events_by_category": {
        result = db.prepare("SELECT * FROM events WHERE LOWER(category) = ? AND date >= ? ORDER BY date").all((params?.category || "").toLowerCase(), today);
        break;
      }
      case "get_events_today": {
        result = { today, events: db.prepare("SELECT * FROM events WHERE date = ? ORDER BY time").all(today) };
        break;
      }
      case "rsvp_event": {
        const eventId = params?.eventId;
        const studentId = params?.studentId || "STU001";
        const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });
        if (event.max_attendees && event.current_attendees >= event.max_attendees) {
          result = { success: false, reason: "Event is full" };
          break;
        }
        try {
          db.prepare("INSERT INTO rsvps (event_id, student_id) VALUES (?, ?)").run(eventId, studentId);
          db.prepare("UPDATE events SET current_attendees = current_attendees + 1 WHERE id = ?").run(eventId);
          result = { success: true, event: db.prepare("SELECT * FROM events WHERE id = ?").get(eventId) };
        } catch {
          result = { success: false, reason: "Already RSVPed" };
        }
        break;
      }
      case "get_user_rsvps": {
        const studentId = params?.studentId || "STU001";
        const rows = db.prepare("SELECT event_id FROM rsvps WHERE student_id = ?").all(studentId);
        result = rows.map(r => r.event_id);
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
  res.json({ status: "ok", server: "events-mcp-server", port: PORT });
});

const httpServer = app.listen(PORT, "0.0.0.0", () => {
  console.error(`Events MCP Server running on http://127.0.0.1:${PORT}`);
});

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Events MCP Server failed: port ${PORT} is already in use.`);
  } else {
    console.error("Events MCP Server failed to start:", error);
  }
  process.exit(1);
});
