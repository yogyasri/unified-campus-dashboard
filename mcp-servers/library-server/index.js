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
const PORT = process.env.PORT || 4001;

// ── SQLite Database Setup ───────────────────────────────────────────
const db = new Database(path.join(__dirname, "library.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    genre TEXT,
    available INTEGER DEFAULT 1,
    total_copies INTEGER DEFAULT 1,
    location TEXT,
    published_year INTEGER,
    description TEXT,
    added_date TEXT DEFAULT (date('now'))
  );
  CREATE TABLE IF NOT EXISTS holds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    placed_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending'
  );
  CREATE TABLE IF NOT EXISTS borrowals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    borrowed_at TEXT DEFAULT (datetime('now')),
    due_date TEXT DEFAULT (date('now', '+14 days')),
    returned INTEGER DEFAULT 0
  );
`);

// Seed data if table is empty
const count = db.prepare("SELECT COUNT(*) as c FROM books").get();
if (count.c === 0) {
  const insert = db.prepare(`
    INSERT INTO books (title, author, isbn, genre, available, total_copies, location, published_year, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const books = [
    ["Introduction to Computer Science", "John Smith", "978-0134670942", "Computer Science", 3, 5, "A-101", 2022, "A comprehensive introduction to CS fundamentals including programming, data structures, and algorithms."],
    ["Data Structures and Algorithms", "Jane Doe", "978-0262033848", "Computer Science", 1, 3, "A-205", 2021, "Master the art of algorithm design and analysis with practical examples."],
    ["Machine Learning Basics", "Robert Johnson", "978-1492032649", "AI & ML", 5, 7, "B-110", 2023, "A gentle introduction to machine learning concepts and practical applications."],
    ["Web Development with React", "Emily Chen", "978-1491954621", "Web Development", 2, 4, "C-005", 2024, "Build modern web applications with React, Next.js, and TypeScript."],
    ["Database Systems", "Michael Brown", "978-0073523323", "Databases", 0, 2, "A-301", 2020, "Comprehensive coverage of database design, SQL, and NoSQL systems."],
    ["Operating Systems Concepts", "Sarah Wilson", "978-1118063330", "Computer Science", 4, 6, "A-102", 2021, "Understand the core concepts behind modern operating systems."],
    ["Computer Networks", "David Lee", "978-0132126953", "Networking", 2, 3, "B-201", 2022, "Top-down approach to understanding computer networking protocols."],
    ["Artificial Intelligence: A Modern Approach", "Peter Norvig", "978-0134610993", "AI & ML", 1, 4, "B-112", 2020, "The definitive textbook on artificial intelligence theory and practice."],
    ["Clean Code", "Robert C. Martin", "978-0132350884", "Software Engineering", 6, 8, "C-010", 2019, "A handbook of agile software craftsmanship and best practices."],
    ["Design Patterns", "Gang of Four", "978-0201633610", "Software Engineering", 3, 5, "C-011", 2018, "Classic guide to reusable object-oriented software design patterns."],
    ["The Pragmatic Programmer", "David Thomas", "978-0135957059", "Software Engineering", 4, 5, "C-012", 2019, "Your journey to mastery in software development."],
    ["Linear Algebra Done Right", "Sheldon Axler", "978-3319110790", "Mathematics", 2, 4, "D-101", 2023, "Elegant approach to linear algebra emphasizing understanding over computation."],
    ["Calculus: Early Transcendentals", "James Stewart", "978-1285741550", "Mathematics", 5, 10, "D-102", 2021, "The most widely used calculus textbook with clear explanations."],
    ["Discrete Mathematics", "Kenneth Rosen", "978-0073383095", "Mathematics", 3, 6, "D-103", 2019, "Essential mathematical foundations for computer science students."],
    ["Physics for Scientists", "Raymond Serway", "978-1133947271", "Physics", 7, 10, "E-201", 2022, "Calculus-based physics covering mechanics, thermodynamics, and waves."],
    ["Introduction to Psychology", "James Kalat", "978-1337565691", "Psychology", 4, 6, "F-101", 2023, "Engaging introduction to the science of mind and behavior."],
    ["Cybersecurity Essentials", "Charles Brooks", "978-1119362395", "Cybersecurity", 2, 3, "B-310", 2024, "Comprehensive guide to cybersecurity principles and practices."],
    ["Cloud Computing Concepts", "Thomas Erl", "978-0133387520", "Cloud", 1, 2, "B-311", 2023, "Understanding cloud architecture, platforms, and deployment models."],
  ];

  const insertMany = db.transaction((books) => {
    for (const b of books) insert.run(...b);
  });
  insertMany(books);
  console.error(`Seeded ${books.length} books into library.db`);
}

// Ensure some books are checked out for realistic Hold button demo
// (Idempotent: only sets available=0 for books that aren't already 0)
{
  const checkedOutBooks = [
    "Introduction to Algorithms",
    "Data Structures and Algorithms",
    "Database Systems",
  ];
  for (const title of checkedOutBooks) {
    const book = db.prepare("SELECT * FROM books WHERE LOWER(title) LIKE ? AND available > 0").get(`%${title.toLowerCase()}%`);
    if (book) {
      db.prepare("UPDATE books SET available = 0 WHERE id = ?").run(book.id);
      console.error(`[Library] Marked "${book.title}" as checked out`);
    }
  }
}

// ── MCP Server ──────────────────────────────────────────────────────
const server = new Server(
  { name: "library-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_books",
      description: "Search for books in the campus library by title, author, or genre",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (title, author, or genre)" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_available_books",
      description: "Get a list of all currently available books in the library",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_book_details",
      description: "Get detailed information about a specific book by ID",
      inputSchema: {
        type: "object",
        properties: {
          bookId: { type: "number", description: "ID of the book" },
        },
        required: ["bookId"],
      },
    },
    {
      name: "get_library_stats",
      description: "Get library statistics: total books, available count, genres",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_recent_arrivals",
      description: "Get the most recently added books to the library",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of books to return (default: 5)" },
        },
      },
    },
    {
      name: "place_hold",
      description: "Place a hold request on a book for a student",
      inputSchema: {
        type: "object",
        properties: {
          bookId: { type: "number", description: "ID of the book to hold" },
          studentId: { type: "string", description: "Student ID" },
        },
        required: ["bookId"],
      },
    },
    {
      name: "get_all_books",
      description: "Get all books in the library with full availability info",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "borrow_book",
      description: "Borrow a book, decreasing available count by 1",
      inputSchema: {
        type: "object",
        properties: {
          bookId: { type: "number", description: "ID of the book to borrow" },
          studentId: { type: "string", description: "Student ID" },
        },
        required: ["bookId"],
      },
    },
    {
      name: "get_user_borrowals",
      description: "Get list of book IDs currently borrowed by a student",
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

  switch (name) {
    case "search_books": {
      const query = `%${args.query.toLowerCase()}%`;
      const results = db.prepare(
        `SELECT * FROM books WHERE LOWER(title) LIKE ? OR LOWER(author) LIKE ? OR LOWER(genre) LIKE ?`
      ).all(query, query, query);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    case "get_available_books": {
      const books = db.prepare("SELECT * FROM books WHERE available > 0").all();
      return { content: [{ type: "text", text: JSON.stringify(books, null, 2) }] };
    }

    case "get_book_details": {
      const book = db.prepare("SELECT * FROM books WHERE id = ?").get(args.bookId);
      if (!book) {
        return { content: [{ type: "text", text: "Book not found" }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(book, null, 2) }] };
    }

    case "get_library_stats": {
      const stats = {
        totalBooks: db.prepare("SELECT COUNT(*) as c FROM books").get().c,
        totalCopies: db.prepare("SELECT SUM(total_copies) as c FROM books").get().c,
        availableCopies: db.prepare("SELECT SUM(available) as c FROM books").get().c,
        genres: db.prepare("SELECT DISTINCT genre FROM books ORDER BY genre").all().map(r => r.genre),
        unavailableBooks: db.prepare("SELECT COUNT(*) as c FROM books WHERE available = 0").get().c,
      };
      return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
    }

    case "get_recent_arrivals": {
      const limit = args.limit || 5;
      const books = db.prepare("SELECT * FROM books ORDER BY id DESC LIMIT ?").all(limit);
      return { content: [{ type: "text", text: JSON.stringify(books, null, 2) }] };
    }

    case "place_hold": {
      const bookId = args.bookId;
      const studentId = args.studentId || "STU001";
      const book = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId);
      if (!book) return { content: [{ type: "text", text: "Book not found" }], isError: true };
      const hold = db.prepare("INSERT INTO holds (book_id, student_id) VALUES (?, ?)").run(bookId, studentId);
      return { content: [{ type: "text", text: JSON.stringify({ success: true, holdId: hold.lastInsertRowid, book: book.title, message: `Hold placed for "${book.title}" — you'll be notified when it's available.` }) }] };
    }

    case "get_all_books": {
      const books = db.prepare("SELECT *, (total_copies - available) as borrowed FROM books ORDER BY genre, title").all();
      return { content: [{ type: "text", text: JSON.stringify(books, null, 2) }] };
    }

    case "borrow_book": {
      const bookId = args.bookId;
      const studentId = args.studentId || "STU001";
      const book = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId);
      if (!book) return { content: [{ type: "text", text: "Book not found" }], isError: true };
      if (book.available <= 0) return { content: [{ type: "text", text: JSON.stringify({ success: false, reason: "No copies available" }) }] };
      db.prepare("UPDATE books SET available = available - 1 WHERE id = ?").run(bookId);
      db.prepare("INSERT INTO borrowals (book_id, student_id) VALUES (?, ?)").run(bookId, studentId);
      const updated = db.prepare("SELECT *, (total_copies - available) as borrowed FROM books WHERE id = ?").get(bookId);
      return { content: [{ type: "text", text: JSON.stringify({ success: true, book: updated, message: `"${book.title}" borrowed! Due back in 14 days.` }) }] };
    }

    case "get_user_borrowals": {
      const studentId = args.studentId || "STU001";
      const rows = db.prepare("SELECT book_id FROM borrowals WHERE student_id = ? AND returned = 0").all(studentId);
      return { content: [{ type: "text", text: JSON.stringify(rows.map(r => r.book_id)) }] };
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
  console.error("Client connected to Library MCP Server via SSE");
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

  try {
    let result;
    switch (method) {
      case "query_books":
      case "search_books": {
        const query = `%${(params.query || "").toLowerCase()}%`;
        result = db.prepare(
          `SELECT * FROM books WHERE LOWER(title) LIKE ? OR LOWER(author) LIKE ? OR LOWER(genre) LIKE ?`
        ).all(query, query, query);
        break;
      }
      case "get_available_books": {
        result = db.prepare("SELECT * FROM books WHERE available > 0").all();
        break;
      }
      case "get_book_details": {
        result = db.prepare("SELECT * FROM books WHERE id = ?").get(params.bookId);
        if (!result) return res.status(404).json({ error: "Book not found" });
        break;
      }
      case "get_library_stats": {
        result = {
          totalBooks: db.prepare("SELECT COUNT(*) as c FROM books").get().c,
          totalCopies: db.prepare("SELECT SUM(total_copies) as c FROM books").get().c,
          availableCopies: db.prepare("SELECT SUM(available) as c FROM books").get().c,
          genres: db.prepare("SELECT DISTINCT genre FROM books ORDER BY genre").all().map(r => r.genre),
          unavailableBooks: db.prepare("SELECT COUNT(*) as c FROM books WHERE available = 0").get().c,
        };
        break;
      }
      case "get_recent_arrivals": {
        const limit = params?.limit || 5;
        result = db.prepare("SELECT * FROM books ORDER BY id DESC LIMIT ?").all(limit);
        break;
      }
      case "place_hold": {
        const bookId = params?.bookId;
        const studentId = params?.studentId || "STU001";
        const book = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId);
        if (!book) return res.status(404).json({ error: "Book not found" });
        const hold = db.prepare("INSERT INTO holds (book_id, student_id) VALUES (?, ?)").run(bookId, studentId);
        result = { success: true, holdId: hold.lastInsertRowid, book: book.title, message: `Hold placed for "${book.title}"` };
        break;
      }
      case "get_all_books": {
        result = db.prepare("SELECT *, (total_copies - available) as borrowed FROM books ORDER BY genre, title").all();
        break;
      }
      case "borrow_book": {
        const bookId = params?.bookId;
        const studentId = params?.studentId || "STU001";
        const book = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId);
        if (!book) return res.status(404).json({ error: "Book not found" });
        if (book.available <= 0) { result = { success: false, reason: "No copies available" }; break; }
        db.prepare("UPDATE books SET available = available - 1 WHERE id = ?").run(bookId);
        db.prepare("INSERT INTO borrowals (book_id, student_id) VALUES (?, ?)").run(bookId, studentId);
        result = { success: true, book: db.prepare("SELECT *, (total_copies - available) as borrowed FROM books WHERE id = ?").get(bookId), message: `"${book.title}" borrowed! Due back in 14 days.` };
        break;
      }
      case "get_user_borrowals": {
        const studentId = params?.studentId || "STU001";
        const rows = db.prepare("SELECT book_id FROM borrowals WHERE student_id = ? AND returned = 0").all(studentId);
        result = rows.map(r => r.book_id);
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
  res.json({ status: "ok", server: "library-mcp-server", port: PORT });
});

const httpServer = app.listen(PORT, "0.0.0.0", () => {
  console.error(`Library MCP Server running on http://127.0.0.1:${PORT}`);
});

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Library MCP Server failed: port ${PORT} is already in use.`);
  } else {
    console.error("Library MCP Server failed to start:", error);
  }
  process.exit(1);
});
