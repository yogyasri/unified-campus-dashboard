#  Unified Campus Dashboard with Ai Assistant

> **AI-powered campus dashboard** that dynamically queries independent MCP (Model Context Protocol) servers for real-time campus data — no single giant database.
- **demo link**:https://drive.google.com/file/d/1EatdB0S7mkorxjJpIcU0gmi6BNVefLhv/view?usp=sharing
- **deployed link**:unified-campus-dashboard-bkukrx5q9-yogyasris-projects.vercel.app
> 

##  Overview

Instead of building massive web scrapers that dump everything into one giant database, Campus Hub uses **independent MCP servers** for each campus data source. The AI assistant dynamically routes natural-language queries to the appropriate server(s) in real-time.

### Key Features

- **5 Independent MCP Servers** — Library, Cafeteria, Events, Academics, Notifications
- **AI Assistant** — Routes natural-language queries to appropriate MCP server(s) via function calling
- **Unified Dashboard** — Dark glassmorphism UI surfacing data from all sources
- **No Single Database** — Each MCP server has its own SQLite database
- **Multi-Provider AI** — Configurable GPT-4o + Gemini fallback
- **JWT Authentication** — Student login with personalized views
- **Real-time Data** — Live indicators, current meal detection, event countdowns

---

##  Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS DASHBOARD (Port 3000)               │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │  Dashboard   │  │  REST API Routes │  │  AI Chat Route     │  │
│  │  Components  │  │  /api/library    │  │  /api/chat         │  │
│  │  (React)     │  │  /api/cafeteria  │  │  (GPT-4o / Gemini) │  │
│  └──────┬───────┘  │  /api/events     │  └──────┬─────────────┘  │
│         │          │  /api/notifications│         │                │
│         │          └────────┬──────────┘         │                │
│         │                   │                    │                │
│         └───────────────────┼────────────────────┘                │
│                             │                                    │
│                   ┌─────────┴──────────┐                         │
│                   │  MCP Bridge Layer  │                         │
│                   │  (SSE Connections)  │                         │
│                   └─────────┬──────────┘                         │
└─────────────────────────────┼────────────────────────────────────┘
                              │ SSE
           ┌──────────────────┼──────────────────────┐
           │                  │                      │
     ┌─────┴─────┐   ┌──────┴──────┐   ┌───────────┴────────────┐
     │  Library   │   │  Cafeteria  │   │  Events  │  Academics  │
     │  :4001     │   │  :4002      │   │  :4003   │  :4004      │
     │  SQLite    │   │  SQLite     │   │  SQLite  │  SQLite     │
     └───────────┘   └─────────────┘   └──────────┴─────────────┘
                                              │
                                       ┌──────┴──────┐
                                       │ Notifications│
                                       │  :4005       │
                                       │  SQLite      │
                                       └──────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 + Custom CSS (Dark Glassmorphism) |
| Backend | Next.js API Routes |
| MCP Servers | Node.js + Express + MCP SDK |
| Database | SQLite (better-sqlite3) per server |
| AI | OpenAI GPT-4o + Google Gemini (configurable) |
| Auth | Custom JWT + bcryptjs |
| Protocol | Model Context Protocol (MCP) over SSE |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ installed
-  **Google Gemini API Key**

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/unified-campus-hub.git
cd unified-campus-hub
```

### 2. Install Dependencies

```bash
# Install MCP server dependencies
cd mcp-servers/library-server && npm install
cd ../cafeteria-server && npm install
cd ../events-server && npm install
cd ../academics-server && npm install
cd ../notifications-server && npm install

# Install frontend dependencies
cd ../../frontend && npm install
```

### 3. Configure Environment

Create `frontend/.env.local`:

```env
# AI Provider: "openai" or "gemini"
AI_PROVIDER=openai

# API Keys (set the one matching your provider)
OPENAI_API_KEY=sk-your-key-here
GEMINI_API_KEY=your-gemini-key-here

# JWT Secret
JWT_SECRET=your-secret-key-here

# MCP Server URLs (defaults shown)
MCP_LIBRARY_URL=http://127.0.0.1:4001
MCP_CAFETERIA_URL=http://127.0.0.1:4002
MCP_EVENTS_URL=http://127.0.0.1:4003
MCP_ACADEMICS_URL=http://127.0.0.1:4004
MCP_NOTIFICATIONS_URL=http://127.0.0.1:4005
```

### 4. Start the Application

Start the entire stack (all 5 MCP servers + Next.js frontend) with a single command:

```bash
# Production mode (requires `npm run build` in frontend/ first)
node start.js

# Development mode (with hot reload)
node start.js --dev
```

This will:
1. Start the Library server on port 4001
2. Start the Cafeteria server on port 4002
3. Start the Events server on port 4003
4. Start the Academics server on port 4004
5. Start the Notifications server on port 4005
6. Launch the Next.js dashboard on port 3000

> **Note:** SQLite databases are auto-created and seeded with demo data on first startup. No manual setup needed.

Open **http://localhost:3000** in your browser.

### 5. Login

Use one of the demo accounts:

| Email | Password | Major |
|-------|----------|-------|
| alice@cs.iitr.ac.in | password123 | Computer Science |
| bob@ece.iitr.ac.in | password123 | Electronics |
| yogya@cs.iitr.ac.in | password123 | Computer Science |

---

## 📁 Project Structure

```
unified-campus-hub/
├── frontend/                          # Next.js 16 Dashboard
│   ├── app/
│   │   ├── api/                       # API Route Handlers
│   │   │   ├── auth/                  # Login, Logout, Session
│   │   │   ├── chat/                  # AI Chat Endpoint
│   │   │   ├── library/               # Library Data
│   │   │   ├── cafeteria/             # Cafeteria Data
│   │   │   ├── events/                # Events Data
│   │   │   └── notifications/         # Alerts & Deadlines
│   │   ├── components/                # React Components
│   │   │   ├── Sidebar.tsx            # Collapsible Navigation
│   │   │   ├── Header.tsx             # Top Bar with Greeting
│   │   │   ├── LibraryCard.tsx        # Book Availability Widget
│   │   │   ├── CafeteriaCard.tsx      # Current Meal Widget
│   │   │   ├── EventsCard.tsx         # Upcoming Events Widget
│   │   │   ├── NotificationsPanel.tsx # Alerts & Deadlines
│   │   │   ├── CampusMap.tsx          # Interactive SVG Map
│   │   │   └── ChatPanel.tsx          # AI Assistant Panel
│   │   ├── login/page.tsx             # Login Page
│   │   ├── page.tsx                   # Main Dashboard
│   │   ├── layout.tsx                 # Root Layout
│   │   └── globals.css                # Design System
│   ├── lib/
│   │   ├── auth.ts                    # JWT Utilities
│   │   ├── mcp-bridge.ts             # MCP Connection Manager
│   │   └── ai-providers/             # AI Provider Abstraction
│   │       ├── openai.ts             # OpenAI Integration
│   │       ├── gemini.ts             # Gemini Integration
│   │       └── index.ts              # Provider Factory
│   └── middleware.ts                  # Auth Middleware
│
├── mcp-servers/                       # Independent MCP Servers
│   ├── library-server/                # Port 4001 — Books & Catalog
│   ├── cafeteria-server/              # Port 4002 — Menus & Meals
│   ├── events-server/                 # Port 4003 — Campus Events
│   ├── academics-server/              # Port 4004 — Courses & Students
│   └── notifications-server/          # Port 4005 — Alerts & Deadlines
│
├── start.js                           # Node.js Multi-service Orchestrator
└── README.md
```

---

## 🤖 MCP Server Details

### Library Server (Port 4001)
- `search_books` — Search by title, author, or genre
- `get_available_books` — List available books
- `get_book_details` — Get specific book info
- `get_library_stats` — Total counts and availability
- `get_recent_arrivals` — Newest additions

### Cafeteria Server (Port 4002)
- `get_daily_menu` — Full day's menu
- `get_meal_details` — Specific meal details
- `get_current_meal` — What's being served right now
- `get_todays_specials` — Daily deals
- `search_menu` — Find specific food items

### Events Server (Port 4003)
- `get_upcoming_events` — Next N events
- `search_events` — Search by keyword
- `get_event_details` — Specific event info
- `get_events_by_category` — Filter by type
- `get_events_today` — Today's events

### Academics Server (Port 4004)
- `list_courses` — All courses (filterable by department)
- `search_courses` — Search by code/name/instructor
- `get_course_details` — Specific course info
- `get_student_courses` — Student's enrolled courses
- `get_student_schedule` — Weekly schedule
- `get_student_profile` — Student info
- `verify_student_login` — Auth verification

### Notifications Server (Port 4005)
- `get_announcements` — Active announcements
- `get_pinned_alerts` — Important pinned alerts
- `get_deadlines` — Upcoming deadlines
- `search_announcements` — Search by keyword

