# Unified Campus Hub — Complete Rebuild Plan

## Current State Assessment

| Feature | Status | Notes |
|---------|--------|-------|
| MCP Servers (4) | ✅ Working | Library, Cafeteria, Events, Academics — but hardcoded data, stdio transport |
| AI Router | ✅ Working | Express server with OpenAI function calling — but separate process |
| Frontend UI | ⚠️ Minimal | Chat-only interface, no dashboard, basic Tailwind styling |
| Dashboard Widgets | ❌ Missing | No data cards, no visual data display |
| Authentication | ❌ Missing | No login, no personalization |
| Dark Mode / Premium Design | ❌ Missing | Basic light theme with default Tailwind |
| Deployment | ❌ Missing | No deployed demo link |
| README | ⚠️ Basic | Needs screenshots, architecture diagram, deployed link |

**Estimated completion: ~40%** → Target: **95%+**

---

## Architectural Decisions (from Interview)

| Decision | Choice |
|----------|--------|
| Layout | Sidebar nav + Dashboard grid + Docked AI chat panel |
| Data Storage | SQLite per MCP server (better-sqlite3) |
| Visual Theme | Dark mode glassmorphism (purple/blue/teal palette) |
| AI Provider | GPT-4o primary + Gemini fallback (configurable) |
| Auth | Custom JWT (hand-rolled login + cookie-stored JWT) |
| MCP Transport | HTTP/SSE (convert from stdio) |
| Backend | Consolidate Express ai-router into Next.js API routes |
| Data Fetching | Shared MCP bridge function (REST endpoints + AI both call same bridge) |
| Chat UX | Full JSON response (no streaming) + markdown rendering |
| Animations | Sidebar collapse/expand + pulse/glow on live data |
| Deployment | Single Render/Railway service |

---

## Proposed Changes

### Phase 1: Project Restructure & Dependencies

Consolidate the backend into Next.js and set up the new project structure.

#### [MODIFY] [package.json](file:///c:/Users/yogya/unified%20campus%20builder/frontend/package.json)
- Add dependencies: `better-sqlite3`, `jsonwebtoken`, `bcryptjs`, `openai`, `@google/generative-ai`, `react-markdown`, `react-icons`, `framer-motion`
- Add dev dependencies: `@types/better-sqlite3`, `@types/jsonwebtoken`, `@types/bcryptjs`

#### [MODIFY] [next.config.ts](file:///c:/Users/yogya/unified%20campus%20builder/frontend/next.config.ts)
- Configure `serverExternalPackages: ['better-sqlite3']` for native module support
- Add environment variable validation

#### [NEW] frontend/.env.local
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `JWT_SECRET`, `AI_PROVIDER=openai`

---

### Phase 2: MCP Servers — Convert to HTTP/SSE + SQLite

Convert all 4 MCP servers from stdio to HTTP transport and replace hardcoded arrays with SQLite databases.

#### [MODIFY] [library-server/index.js](file:///c:/Users/yogya/unified%20campus%20builder/mcp-servers/library-server/index.js)
- Replace `StdioServerTransport` with `SSEServerTransport` (HTTP-based)
- Replace hardcoded `libraryBooks` array with SQLite database (`library.db`)
- Add Express server to serve the SSE transport on a configurable port (e.g., 4001)
- Seed database with 15-20 books across multiple genres/subjects
- Add tools: `search_books`, `get_available_books`, `get_book_details`, `get_recent_arrivals`

#### [MODIFY] [cafeteria-server/index.js](file:///c:/Users/yogya/unified%20campus%20builder/mcp-servers/cafeteria-server/index.js)
- Same transport conversion (SSE on port 4002)
- SQLite database (`cafeteria.db`) with dynamic menu data
- Today's date awareness — menu rotates based on actual day of the week
- Add tools: `get_daily_menu`, `get_meal_details`, `get_todays_specials`, `get_nutrition_info`

#### [MODIFY] [events-server/index.js](file:///c:/Users/yogya/unified%20campus%20builder/mcp-servers/events-server/index.js)
- Same transport conversion (SSE on port 4003)
- SQLite database (`events.db`) with 15-20 events spanning next 30 days
- Date-based filtering (truly upcoming events based on current date)
- Add tools: `get_upcoming_events`, `search_events`, `get_event_details`, `get_events_by_category`

#### [MODIFY] [academics-server/index.js](file:///c:/Users/yogya/unified%20campus%20builder/mcp-servers/academics-server/index.js)
- Same transport conversion (SSE on port 4004)
- SQLite database (`academics.db`) with courses + student enrollment data
- Add student-aware tool: `get_my_courses(studentId)` for personalized results
- Add tools: `list_courses`, `search_courses`, `get_course_details`, `get_my_courses`, `get_schedule`

#### [NEW] mcp-servers/notifications-server/index.js
- New MCP server for campus notifications/alerts (port 4005)
- SQLite database with announcements, deadline reminders, emergency alerts
- Tools: `get_announcements`, `get_alerts`, `get_deadlines`

#### [MODIFY] Each server's `package.json`
- Add `better-sqlite3`, `express`, `@modelcontextprotocol/sdk` dependencies
- Update start scripts

#### [NEW] Each server gets a `seed.js` script
- Creates tables and populates with realistic demo data on first run

---

### Phase 3: Next.js API Routes — MCP Bridge + AI Orchestration

Replace the standalone Express ai-router with Next.js API Route Handlers.

#### [NEW] frontend/app/api/mcp/bridge.ts
- **Shared MCP bridge function**: `callMcp(serverName, toolName, args)`
- Connects to MCP servers over HTTP/SSE using `SSEClientTransport`
- Server registry mapping: `{ library: 'http://127.0.0.1:4001', ... }`
- Connection pooling / caching for MCP clients

#### [NEW] frontend/app/api/chat/route.ts
- POST endpoint for AI chat queries
- Uses the MCP bridge to discover and call tools
- Multi-provider support:
  - If `AI_PROVIDER=openai` → use OpenAI SDK with function calling
  - If `AI_PROVIDER=gemini` → use Google Generative AI SDK with function calling
- Returns full JSON response (answer + sources used)
- Injects student context from JWT session into tool calls

#### [NEW] frontend/app/api/library/route.ts
- GET endpoint for dashboard Library card
- Calls `callMcp('library', 'get_available_books', {})`
- Returns book count, availability stats, recent arrivals

#### [NEW] frontend/app/api/cafeteria/route.ts
- GET endpoint for dashboard Cafeteria card
- Calls `callMcp('cafeteria', 'get_daily_menu', { day: todayName })`
- Returns today's menu with active meal highlighted

#### [NEW] frontend/app/api/events/route.ts
- GET endpoint for dashboard Events card
- Calls `callMcp('events', 'get_upcoming_events', { limit: 5 })`
- Returns upcoming events with countdown

#### [NEW] frontend/app/api/notifications/route.ts
- GET endpoint for dashboard Notifications panel
- Calls `callMcp('notifications', 'get_announcements', {})`
- Returns active announcements and alerts

#### [NEW] frontend/app/api/auth/login/route.ts
- POST endpoint for login
- Validates credentials against users SQLite table in academics.db
- Returns JWT token set as httpOnly cookie

#### [NEW] frontend/app/api/auth/me/route.ts
- GET endpoint to get current user from JWT
- Returns student profile data

#### [NEW] frontend/app/api/auth/logout/route.ts
- POST endpoint to clear the JWT cookie

---

### Phase 4: Authentication UI

#### [NEW] frontend/app/login/page.tsx
- Premium dark-mode login page
- Student email + password form
- Demo account hints displayed (e.g., "Try: alice@campus.edu / password123")
- Redirect to dashboard on success

#### [NEW] frontend/lib/auth.ts
- JWT utility functions: `signToken()`, `verifyToken()`, `getSession()`
- Middleware helper to protect API routes

#### [NEW] frontend/middleware.ts
- Next.js middleware to protect `/` route — redirect to `/login` if no valid JWT cookie

---

### Phase 5: Dashboard UI — Premium Dark Glassmorphism Design

This is the largest phase. Complete redesign of the frontend.

#### [MODIFY] [globals.css](file:///c:/Users/yogya/unified%20campus%20builder/frontend/app/globals.css)
- Complete CSS overhaul with dark glassmorphism design system
- CSS custom properties for the color palette:
  - `--bg-primary: #0a0b1a` (deep navy)
  - `--bg-secondary: #111328` (slightly lighter)
  - `--glass: rgba(255, 255, 255, 0.05)` (frosted glass)
  - `--glass-border: rgba(255, 255, 255, 0.1)` (glass edges)
  - `--accent-purple: #8b5cf6`
  - `--accent-blue: #3b82f6`
  - `--accent-teal: #14b8a6`
- Glassmorphism card styles with `backdrop-filter: blur()`
- Sidebar animations (collapse/expand)
- Pulse/glow keyframes for live indicators
- Custom scrollbar styling
- Import Inter font from Google Fonts

#### [MODIFY] [layout.tsx](file:///c:/Users/yogya/unified%20campus%20builder/frontend/app/layout.tsx)
- Update metadata (title: "Campus Hub", proper description)
- Switch font to Inter
- Add dark mode class to html element
- Wrap children with auth context provider

#### [MODIFY] [page.tsx](file:///c:/Users/yogya/unified%20campus%20builder/frontend/app/page.tsx)
- Complete rewrite → Full dashboard layout:
  - Left: Collapsible sidebar with navigation
  - Center: Dashboard grid with data cards
  - Right: Docked AI chat panel (expandable/collapsible)

#### [NEW] frontend/app/components/Sidebar.tsx
- Navigation links: Home, Library, Cafeteria, Events, Academics
- User avatar and name at bottom
- Collapse/expand toggle with smooth animation
- Active page indicator with glow effect

#### [NEW] frontend/app/components/DashboardGrid.tsx
- Responsive CSS grid layout for data cards
- Loading skeleton states
- Auto-refresh on interval

#### [NEW] frontend/app/components/DataCard.tsx
- Generic glassmorphism card component
- Props: title, icon, children, accentColor, lastUpdated
- Frosted glass background with subtle border
- Header with title + source badge + refresh button

#### [NEW] frontend/app/components/LibraryCard.tsx
- Books available count with progress ring
- Recent arrivals list (3-4 items)
- Availability status indicators (green/yellow/red dots)
- "Search in chat" action button

#### [NEW] frontend/app/components/CafeteriaCard.tsx
- Today's menu tabs (Breakfast / Lunch / Dinner)
- Active meal highlighted with pulse/glow
- Menu items list with emoji icons
- Time-based meal detection ("Currently serving: Lunch")

#### [NEW] frontend/app/components/EventsCard.tsx
- Upcoming events list with date badges (month/day)
- Countdown timer to next event
- Category color coding
- "View details" action links

#### [NEW] frontend/app/components/NotificationsPanel.tsx
- Alert cards with severity icons (info/warning/urgent)
- Deadline countdown badges
- Dismiss functionality
- Slide-in animation for new alerts

#### [NEW] frontend/app/components/CampusMap.tsx
- Interactive SVG campus map
- Building markers with tooltips
- Highlight active locations (current class, event venue)
- Click to see building details

#### [NEW] frontend/app/components/ChatPanel.tsx
- Docked right-side panel with collapse/expand
- Chat message list with avatar icons
- Input box with send button
- Suggested quick prompts (e.g., "What's for lunch?", "Any events this week?")
- Source badges on AI responses
- Markdown rendering for formatted responses

#### [NEW] frontend/app/components/Header.tsx
- Global search bar (routes to AI chat)
- User avatar + name dropdown
- Date/time display
- Notifications badge count
- Logout option

---

### Phase 6: Multi-Provider AI Integration

#### [NEW] frontend/lib/ai-providers/openai.ts
- OpenAI GPT-4o integration with function calling
- Tool schema formatting for OpenAI format
- Response parsing

#### [NEW] frontend/lib/ai-providers/gemini.ts
- Google Gemini integration with function calling
- Tool schema formatting for Gemini format
- Response parsing

#### [NEW] frontend/lib/ai-providers/index.ts
- Provider factory: reads `AI_PROVIDER` env var
- Unified interface: `queryAI(systemPrompt, userQuery, tools) → { answer, toolCalls }`
- Automatic fallback if primary provider fails

---

### Phase 7: Deployment Configuration (Pure Node.js)

#### [NEW] start.js (project root)
- Pure Node.js orchestrator — no Docker, no Bash scripts
- `node start.js` starts all 5 MCP servers (ports 4001-4005) + Next.js production (port 3000)
- `node start.js --dev` starts in development mode (Next.js dev server with hot reload)
- Windows-compatible graceful shutdown (uses `taskkill` on Windows, `SIGTERM` on Unix)
- Child process output prefixed with server name for debugging
- Databases auto-seed on first startup (no manual step needed)

---

### Phase 8: README & Documentation

#### [MODIFY] [README.md](file:///c:/Users/yogya/unified%20campus%20builder/README.md)
- Add architecture diagram (Mermaid)
- Add screenshots of the dashboard
- Add feature descriptions with visuals
- Add detailed setup instructions
- Add deployed demo link
- Add tech stack badges
- Add environment variable documentation
- Add API endpoint documentation
- Add demo account credentials

---

## Open Questions

> [!IMPORTANT]
> **Campus Map Implementation**: For the campus map widget, should I create a custom SVG illustration of a fictional campus, or use a simplified grid-based map? A custom SVG would look more impressive but takes more effort.

> [!IMPORTANT]  
> **Notifications Server Data**: What kinds of campus notifications should be seeded? I'm planning: maintenance alerts, library due date reminders, event registration deadlines, weather alerts, and general announcements. Does this cover what you'd want?

> [!IMPORTANT]
> **Demo Accounts**: I'll create 3 student accounts with different enrolled courses. Should they have different names/majors (e.g., Alice - CS major, Bob - Math major, Carol - Engineering) to demonstrate personalization?

---

## Verification Plan

### Automated Tests
```bash
# Build verification
cd frontend && npm run build

# MCP server startup test
node mcp-servers/library-server/index.js &
curl http://127.0.0.1:4001/health

# API route tests
curl http://localhost:3000/api/library
curl http://localhost:3000/api/cafeteria
curl http://localhost:3000/api/events
curl -X POST http://localhost:3000/api/chat -d '{"query":"What books are available?"}'

# Auth flow test
curl -X POST http://localhost:3000/api/auth/login -d '{"email":"alice@campus.edu","password":"password123"}'
```

### Manual Verification
- Visual inspection of dark glassmorphism UI in browser
- Test all dashboard cards load data correctly
- Test AI chat with queries spanning multiple data sources
- Test login flow and personalized dashboard
- Test sidebar collapse/expand animation
- Test on mobile viewport for responsive layout
- Record demo video showing all features
- Deploy to Render/Railway and verify demo link works
