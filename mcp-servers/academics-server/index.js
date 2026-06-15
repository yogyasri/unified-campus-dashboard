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
const PORT = process.env.PORT || 4004;

// ── SQLite Database Setup ───────────────────────────────────────────
const db = new Database(path.join(__dirname, "academics.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    instructor TEXT NOT NULL,
    credits INTEGER DEFAULT 3,
    schedule TEXT,
    location TEXT,
    building TEXT,
    department TEXT,
    semester TEXT DEFAULT 'Fall 2026',
    max_enrollment INTEGER DEFAULT 40,
    current_enrollment INTEGER DEFAULT 0,
    description TEXT
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    major TEXT,
    year INTEGER DEFAULT 1,
    gpa REAL DEFAULT 0.0,
    avatar_url TEXT
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    course_code TEXT NOT NULL,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (course_code) REFERENCES courses(code),
    UNIQUE(student_id, course_code)
  );
`);

const count = db.prepare("SELECT COUNT(*) as c FROM courses").get();
if (count.c === 0) {
  const insertCourse = db.prepare(`
    INSERT INTO courses (code, name, instructor, credits, schedule, location, building, department, max_enrollment, current_enrollment, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const courses = [
    ["CS101", "Introduction to Computer Science", "Prof. John Smith", 3, "Mon/Wed/Fri 10:00-11:00", "Room A-101", "Science Building", "Computer Science", 60, 52, "Foundational course covering programming basics, computational thinking, and problem solving with Python."],
    ["CS201", "Data Structures & Algorithms", "Prof. Jane Doe", 4, "Tue/Thu 11:00-12:30", "Room B-205", "Tech Building", "Computer Science", 45, 40, "In-depth study of arrays, linked lists, trees, graphs, sorting, and algorithmic complexity analysis."],
    ["CS301", "Machine Learning", "Prof. Robert Johnson", 3, "Mon/Wed 2:00-3:30", "Lab C-301", "Tech Building", "Computer Science", 35, 33, "Introduction to supervised and unsupervised learning, neural networks, and practical ML applications."],
    ["CS401", "Web Development", "Prof. Emily Chen", 3, "Tue/Thu 9:00-10:30", "Room D-105", "Tech Building", "Computer Science", 40, 38, "Full-stack web development with React, Node.js, databases, and deployment."],
    ["CS350", "Operating Systems", "Prof. David Kim", 4, "Mon/Wed/Fri 1:00-2:00", "Room A-103", "Science Building", "Computer Science", 40, 36, "Process management, memory allocation, file systems, and concurrent programming."],
    ["CS450", "Cybersecurity", "Prof. Lisa Park", 3, "Tue/Thu 2:00-3:30", "Lab B-310", "Tech Building", "Computer Science", 30, 28, "Network security, cryptography, ethical hacking, and security policy design."],
    ["MATH201", "Calculus II", "Prof. Michael Brown", 4, "Mon/Wed/Fri 11:00-12:00", "Room E-201", "Math Building", "Mathematics", 50, 45, "Integration techniques, sequences, series, and multivariable calculus introduction."],
    ["MATH301", "Linear Algebra", "Prof. Sarah White", 3, "Tue/Thu 10:00-11:30", "Room E-202", "Math Building", "Mathematics", 40, 34, "Vectors, matrices, eigenvalues, linear transformations, and applications."],
    ["MATH350", "Discrete Mathematics", "Prof. Alan Garcia", 3, "Mon/Wed 3:00-4:30", "Room E-205", "Math Building", "Mathematics", 40, 37, "Logic, set theory, combinatorics, graph theory, and number theory for CS students."],
    ["PHY101", "Physics I: Mechanics", "Prof. Raymond Hall", 4, "Mon/Wed/Fri 9:00-10:00", "Room F-101", "Science Building", "Physics", 55, 48, "Newtonian mechanics, energy, momentum, rotational dynamics, and oscillations."],
    ["PHY201", "Physics II: E&M", "Prof. Maria Santos", 4, "Tue/Thu 1:00-2:30", "Room F-102", "Science Building", "Physics", 45, 38, "Electricity, magnetism, circuits, electromagnetic waves, and optics."],
    ["ENG101", "Technical Writing", "Prof. Karen Miller", 3, "Mon/Wed 4:00-5:30", "Room G-101", "Humanities Building", "English", 35, 30, "Professional writing skills for technical reports, documentation, and proposals."],
    ["BUS201", "Entrepreneurship", "Prof. James Wilson", 3, "Tue/Thu 3:00-4:30", "Room H-201", "Business Building", "Business", 50, 42, "Startup fundamentals, business plans, funding strategies, and lean methodology."],
    ["PSY101", "Intro to Psychology", "Prof. Anna Taylor", 3, "Mon/Wed/Fri 2:00-3:00", "Room G-201", "Humanities Building", "Psychology", 60, 55, "Scientific study of behavior and mental processes, covering perception, learning, and cognition."],
    ["ART150", "Digital Design Fundamentals", "Prof. Thomas Rivera", 3, "Tue/Thu 4:00-5:30", "Art Studio 1", "Arts Center", "Art & Design", 25, 22, "UI/UX principles, typography, color theory, and design tools (Figma, Adobe)."],
  ];

  const insertMany = db.transaction((courses) => {
    for (const c of courses) insertCourse.run(...c);
  });
  insertMany(courses);

  // Seed demo students (bcrypt hash of "password123")
  const insertStudent = db.prepare(`
    INSERT INTO students (student_id, name, email, password_hash, major, year, gpa)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  // Hash for "password123" - will be verified with bcryptjs
  const hash = "$2a$10$oalt2/oXDXlNJc8BClu0mOdX42a1MqMD1odYVvI4jPjSE9dtjSZze";
  insertStudent.run("STU001", "Alice Chen", "alice@campus.edu", hash, "Computer Science", 3, 3.8);
  insertStudent.run("STU002", "Bob Martinez", "bob@campus.edu", hash, "Mathematics", 2, 3.5);
  insertStudent.run("STU003", "Carol Johnson", "carol@campus.edu", hash, "Engineering", 4, 3.9);

  // Seed enrollments
  const insertEnrollment = db.prepare("INSERT INTO enrollments (student_id, course_code, grade) VALUES (?, ?, ?)");
  // Alice (CS major)
  insertEnrollment.run("STU001", "CS301", "A");
  insertEnrollment.run("STU001", "CS401", "A-");
  insertEnrollment.run("STU001", "CS450", null);
  insertEnrollment.run("STU001", "MATH301", "B+");
  insertEnrollment.run("STU001", "ENG101", "A");
  // Bob (Math major)
  insertEnrollment.run("STU002", "MATH201", "A");
  insertEnrollment.run("STU002", "MATH301", "A-");
  insertEnrollment.run("STU002", "MATH350", null);
  insertEnrollment.run("STU002", "CS101", "B+");
  insertEnrollment.run("STU002", "PHY101", "B");
  // Carol (Engineering)
  insertEnrollment.run("STU003", "CS201", "A");
  insertEnrollment.run("STU003", "CS350", "A-");
  insertEnrollment.run("STU003", "PHY201", null);
  insertEnrollment.run("STU003", "MATH201", "A");
  insertEnrollment.run("STU003", "BUS201", "A-");

  console.error("Seeded courses, students, and enrollments into academics.db");
}

// ── MCP Server ──────────────────────────────────────────────────────
const server = new Server(
  { name: "academics-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_courses",
      description: "List all available courses with enrollment info",
      inputSchema: {
        type: "object",
        properties: {
          department: { type: "string", description: "Filter by department (optional)" },
        },
      },
    },
    {
      name: "search_courses",
      description: "Search courses by code, name, or instructor",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_course_details",
      description: "Get detailed information about a specific course",
      inputSchema: {
        type: "object",
        properties: {
          courseCode: { type: "string", description: "Course code (e.g., CS101)" },
        },
        required: ["courseCode"],
      },
    },
    {
      name: "get_student_courses",
      description: "Get the courses a specific student is enrolled in",
      inputSchema: {
        type: "object",
        properties: {
          studentId: { type: "string", description: "Student ID (e.g., STU001)" },
        },
        required: ["studentId"],
      },
    },
    {
      name: "get_student_schedule",
      description: "Get the weekly class schedule for a student",
      inputSchema: {
        type: "object",
        properties: {
          studentId: { type: "string", description: "Student ID" },
        },
        required: ["studentId"],
      },
    },
    {
      name: "get_student_profile",
      description: "Get a student's profile information",
      inputSchema: {
        type: "object",
        properties: {
          studentId: { type: "string", description: "Student ID" },
        },
        required: ["studentId"],
      },
    },
    {
      name: "verify_student_login",
      description: "Verify student login credentials and return student info",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Student email" },
          password: { type: "string", description: "Student password" },
        },
        required: ["email", "password"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_courses": {
      let sql = "SELECT * FROM courses";
      const params = [];
      if (args.department) {
        sql += " WHERE LOWER(department) = ?";
        params.push(args.department.toLowerCase());
      }
      sql += " ORDER BY code";
      const courses = db.prepare(sql).all(...params);
      return { content: [{ type: "text", text: JSON.stringify(courses, null, 2) }] };
    }

    case "search_courses": {
      const query = `%${args.query.toLowerCase()}%`;
      const courses = db.prepare(
        "SELECT * FROM courses WHERE LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(instructor) LIKE ? ORDER BY code"
      ).all(query, query, query);
      return { content: [{ type: "text", text: JSON.stringify(courses, null, 2) }] };
    }

    case "get_course_details": {
      const course = db.prepare("SELECT * FROM courses WHERE code = ?").get(args.courseCode.toUpperCase());
      if (!course) return { content: [{ type: "text", text: "Course not found" }], isError: true };
      const enrolled = db.prepare(
        "SELECT s.name, s.student_id FROM students s JOIN enrollments e ON s.student_id = e.student_id WHERE e.course_code = ?"
      ).all(args.courseCode.toUpperCase());
      return { content: [{ type: "text", text: JSON.stringify({ ...course, enrolledStudents: enrolled.length, spotsRemaining: course.max_enrollment - course.current_enrollment }, null, 2) }] };
    }

    case "get_student_courses": {
      const courses = db.prepare(`
        SELECT c.*, e.grade FROM courses c
        JOIN enrollments e ON c.code = e.course_code
        WHERE e.student_id = ?
        ORDER BY c.code
      `).all(args.studentId);
      return { content: [{ type: "text", text: JSON.stringify(courses, null, 2) }] };
    }

    case "get_student_schedule": {
      const courses = db.prepare(`
        SELECT c.code, c.name, c.schedule, c.location, c.building, c.instructor
        FROM courses c
        JOIN enrollments e ON c.code = e.course_code
        WHERE e.student_id = ?
        ORDER BY c.schedule
      `).all(args.studentId);
      return { content: [{ type: "text", text: JSON.stringify({ studentId: args.studentId, schedule: courses }, null, 2) }] };
    }

    case "get_student_profile": {
      const student = db.prepare("SELECT student_id, name, email, major, year, gpa FROM students WHERE student_id = ?").get(args.studentId);
      if (!student) return { content: [{ type: "text", text: "Student not found" }], isError: true };
      const courseCount = db.prepare("SELECT COUNT(*) as c FROM enrollments WHERE student_id = ?").get(args.studentId);
      return { content: [{ type: "text", text: JSON.stringify({ ...student, enrolledCourses: courseCount.c }, null, 2) }] };
    }

    case "verify_student_login": {
      const student = db.prepare("SELECT * FROM students WHERE email = ?").get(args.email);
      if (!student) {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, error: "Invalid credentials" }) }] };
      }
      // Note: actual bcrypt verification happens in the auth API route
      return { content: [{ type: "text", text: JSON.stringify({
        success: true,
        student: { student_id: student.student_id, name: student.name, email: student.email, major: student.major, year: student.year, gpa: student.gpa, password_hash: student.password_hash }
      }) }] };
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
  console.error("Client connected to Academics MCP Server via SSE");
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
      case "list_courses": {
        let sql = "SELECT * FROM courses";
        const sqlParams = [];
        if (params?.department) {
          sql += " WHERE LOWER(department) = ?";
          sqlParams.push(params.department.toLowerCase());
        }
        sql += " ORDER BY code";
        result = db.prepare(sql).all(...sqlParams);
        break;
      }
      case "search_courses": {
        const query = `%${(params?.query || "").toLowerCase()}%`;
        result = db.prepare(
          "SELECT * FROM courses WHERE LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(instructor) LIKE ? ORDER BY code"
        ).all(query, query, query);
        break;
      }
      case "get_course_details": {
        const course = db.prepare("SELECT * FROM courses WHERE code = ?").get((params?.courseCode || "").toUpperCase());
        if (!course) return res.status(404).json({ error: "Course not found" });
        const enrolled = db.prepare(
          "SELECT s.name, s.student_id FROM students s JOIN enrollments e ON s.student_id = e.student_id WHERE e.course_code = ?"
        ).all(course.code);
        result = { ...course, enrolledStudents: enrolled.length, spotsRemaining: course.max_enrollment - course.current_enrollment };
        break;
      }
      case "get_student_courses": {
        result = db.prepare(`
          SELECT c.*, e.grade FROM courses c
          JOIN enrollments e ON c.code = e.course_code
          WHERE e.student_id = ?
          ORDER BY c.code
        `).all(params?.studentId);
        break;
      }
      case "get_student_schedule": {
        const schedule = db.prepare(`
          SELECT c.code, c.name, c.schedule, c.location, c.building, c.instructor
          FROM courses c
          JOIN enrollments e ON c.code = e.course_code
          WHERE e.student_id = ?
          ORDER BY c.schedule
        `).all(params?.studentId);
        result = { studentId: params?.studentId, schedule };
        break;
      }
      case "get_student_profile": {
        const student = db.prepare("SELECT student_id, name, email, major, year, gpa FROM students WHERE student_id = ?").get(params?.studentId);
        if (!student) return res.status(404).json({ error: "Student not found" });
        const courseCount = db.prepare("SELECT COUNT(*) as c FROM enrollments WHERE student_id = ?").get(student.student_id);
        result = { ...student, enrolledCourses: courseCount.c };
        break;
      }
      case "verify_student_login": {
        const student = db.prepare("SELECT * FROM students WHERE email = ?").get(params?.email);
        if (!student) {
          result = { success: false, error: "Invalid credentials" };
        } else {
          result = {
            success: true,
            student: { student_id: student.student_id, name: student.name, email: student.email, major: student.major, year: student.year, gpa: student.gpa, password_hash: student.password_hash }
          };
        }
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
  res.json({ status: "ok", server: "academics-mcp-server", port: PORT });
});

const httpServer = app.listen(PORT, "0.0.0.0", () => {
  console.error(`Academics MCP Server running on http://127.0.0.1:${PORT}`);
});

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Academics MCP Server failed: port ${PORT} is already in use.`);
  } else {
    console.error("Academics MCP Server failed to start:", error);
  }
  process.exit(1);
});
