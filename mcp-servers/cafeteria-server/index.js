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
const PORT = process.env.PORT || 4002;

// ── SQLite Database Setup ───────────────────────────────────────────
const db = new Database(path.join(__dirname, "cafeteria.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
    item_name TEXT NOT NULL,
    category TEXT,
    calories INTEGER,
    is_vegetarian INTEGER DEFAULT 0,
    is_vegan INTEGER DEFAULT 0,
    allergens TEXT,
    price REAL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS specials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    available_date TEXT,
    meal_type TEXT,
    price REAL
  );
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS dietary_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    allergen TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, allergen)
  );
`);

const count = db.prepare("SELECT COUNT(*) as c FROM menu_items").get();
if (count.c === 0) {
  const insert = db.prepare(`
    INSERT INTO menu_items (day_of_week, meal_type, item_name, category, calories, is_vegetarian, is_vegan, allergens, price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const items = [
    // Monday
    ["monday", "breakfast", "Pancakes with Maple Syrup", "Main", 450, 1, 0, "gluten,dairy", 4.50],
    ["monday", "breakfast", "Scrambled Eggs & Toast", "Main", 380, 1, 0, "eggs,gluten", 3.50],
    ["monday", "breakfast", "Fresh Fruit Bowl", "Side", 120, 1, 1, null, 2.50],
    ["monday", "breakfast", "Coffee & Orange Juice", "Beverage", 50, 1, 1, null, 1.50],
    ["monday", "lunch", "Grilled Chicken Caesar Wrap", "Main", 580, 0, 0, "gluten,dairy", 7.50],
    ["monday", "lunch", "Caesar Salad", "Side", 220, 1, 0, "dairy", 4.00],
    ["monday", "lunch", "French Fries", "Side", 340, 1, 1, null, 2.50],
    ["monday", "lunch", "Lemonade", "Beverage", 90, 1, 1, null, 2.00],
    ["monday", "dinner", "Spaghetti Bolognese", "Main", 620, 0, 0, "gluten,dairy", 8.00],
    ["monday", "dinner", "Garlic Bread", "Side", 200, 1, 0, "gluten,dairy", 2.00],
    ["monday", "dinner", "Steamed Green Beans", "Side", 80, 1, 1, null, 1.50],
    // Tuesday
    ["tuesday", "breakfast", "Belgian Waffles", "Main", 480, 1, 0, "gluten,dairy,eggs", 5.00],
    ["tuesday", "breakfast", "Crispy Bacon", "Side", 210, 0, 0, null, 2.50],
    ["tuesday", "breakfast", "Greek Yogurt Parfait", "Side", 180, 1, 0, "dairy", 3.50],
    ["tuesday", "lunch", "Margherita Pizza", "Main", 550, 1, 0, "gluten,dairy", 6.50],
    ["tuesday", "lunch", "Garden Salad", "Side", 150, 1, 1, null, 3.50],
    ["tuesday", "lunch", "Onion Rings", "Side", 380, 1, 0, "gluten", 3.00],
    ["tuesday", "dinner", "Beef Tacos", "Main", 640, 0, 0, "gluten,dairy", 8.50],
    ["tuesday", "dinner", "Spanish Rice", "Side", 220, 1, 1, null, 2.00],
    ["tuesday", "dinner", "Refried Beans", "Side", 180, 1, 0, "dairy", 2.00],
    // Wednesday
    ["wednesday", "breakfast", "Oatmeal with Berries", "Main", 280, 1, 1, null, 3.00],
    ["wednesday", "breakfast", "Whole Wheat Toast & Jam", "Side", 190, 1, 1, "gluten", 2.00],
    ["wednesday", "breakfast", "Fresh Orange Juice", "Beverage", 110, 1, 1, null, 2.00],
    ["wednesday", "lunch", "Turkey Club Sandwich", "Main", 520, 0, 0, "gluten,dairy", 7.00],
    ["wednesday", "lunch", "Tomato Basil Soup", "Side", 180, 1, 0, "dairy", 3.50],
    ["wednesday", "lunch", "Kettle Chips", "Side", 260, 1, 1, null, 2.00],
    ["wednesday", "dinner", "Grilled Salmon", "Main", 480, 0, 0, "fish", 10.50],
    ["wednesday", "dinner", "Quinoa Pilaf", "Side", 190, 1, 1, null, 3.00],
    ["wednesday", "dinner", "Roasted Vegetables", "Side", 140, 1, 1, null, 2.50],
    // Thursday
    ["thursday", "breakfast", "Everything Bagels", "Main", 340, 1, 0, "gluten,dairy", 3.50],
    ["thursday", "breakfast", "Cream Cheese & Lox", "Side", 250, 0, 0, "dairy,fish", 4.00],
    ["thursday", "breakfast", "Cappuccino", "Beverage", 120, 1, 0, "dairy", 3.00],
    ["thursday", "lunch", "Classic Cheeseburger", "Main", 680, 0, 0, "gluten,dairy", 7.50],
    ["thursday", "lunch", "Sweet Potato Fries", "Side", 300, 1, 1, null, 3.00],
    ["thursday", "lunch", "Coleslaw", "Side", 170, 1, 0, "dairy,eggs", 2.00],
    ["thursday", "dinner", "Pasta Carbonara", "Main", 590, 0, 0, "gluten,dairy,eggs", 8.50],
    ["thursday", "dinner", "Garlic Knots", "Side", 220, 1, 0, "gluten,dairy", 2.50],
    ["thursday", "dinner", "Steamed Broccoli", "Side", 70, 1, 1, null, 1.50],
    // Friday
    ["friday", "breakfast", "French Toast", "Main", 420, 1, 0, "gluten,dairy,eggs", 4.50],
    ["friday", "breakfast", "Turkey Sausage", "Side", 180, 0, 0, null, 2.50],
    ["friday", "breakfast", "Chocolate Milk", "Beverage", 200, 1, 0, "dairy", 2.00],
    ["friday", "lunch", "Sushi Platter", "Main", 460, 0, 0, "fish,soy", 9.00],
    ["friday", "lunch", "Miso Soup", "Side", 80, 1, 0, "soy", 2.50],
    ["friday", "lunch", "Edamame", "Side", 120, 1, 1, "soy", 2.50],
    ["friday", "dinner", "BBQ Ribs", "Main", 750, 0, 0, null, 11.00],
    ["friday", "dinner", "Cornbread", "Side", 200, 1, 0, "gluten,dairy,eggs", 2.00],
    ["friday", "dinner", "Mac & Cheese", "Side", 380, 1, 0, "gluten,dairy", 3.50],
    // Saturday
    ["saturday", "breakfast", "Brunch Buffet Eggs Benedict", "Main", 550, 1, 0, "gluten,dairy,eggs", 8.00],
    ["saturday", "breakfast", "Smoked Salmon Platter", "Main", 380, 0, 0, "fish", 7.50],
    ["saturday", "breakfast", "Mimosa (Non-Alcoholic)", "Beverage", 80, 1, 1, null, 3.00],
    ["saturday", "lunch", "Grilled Cheese & Tomato Soup", "Main", 480, 1, 0, "gluten,dairy", 6.00],
    ["saturday", "lunch", "House Salad", "Side", 130, 1, 1, null, 3.00],
    ["saturday", "dinner", "Build Your Own Pizza", "Main", 600, 1, 0, "gluten,dairy", 8.00],
    ["saturday", "dinner", "Breadsticks", "Side", 280, 1, 0, "gluten,dairy", 2.50],
    ["saturday", "dinner", "Caesar Salad", "Side", 220, 1, 0, "dairy", 3.50],
    // Sunday
    ["sunday", "breakfast", "Sunday Brunch Omelet Bar", "Main", 480, 1, 0, "eggs,dairy", 7.00],
    ["sunday", "breakfast", "Buttermilk Waffles", "Main", 440, 1, 0, "gluten,dairy,eggs", 5.50],
    ["sunday", "breakfast", "Fresh Smoothies", "Beverage", 150, 1, 1, null, 4.00],
    ["sunday", "lunch", "Roast Chicken", "Main", 520, 0, 0, null, 8.00],
    ["sunday", "lunch", "Mashed Potatoes & Gravy", "Side", 280, 1, 0, "dairy", 2.50],
    ["sunday", "lunch", "Dinner Rolls", "Side", 160, 1, 0, "gluten,dairy", 1.50],
    ["sunday", "dinner", "Chef's Choice Buffet", "Main", 650, 0, 0, null, 9.00],
    ["sunday", "dinner", "Fresh Baked Rolls", "Side", 170, 1, 0, "gluten,dairy", 2.00],
    ["sunday", "dinner", "Seasonal Vegetables", "Side", 100, 1, 1, null, 2.00],
  ];

  const insertMany = db.transaction((items) => {
    for (const i of items) insert.run(...i);
  });
  insertMany(items);

  // Seed specials
  const insertSpecial = db.prepare(`
    INSERT INTO specials (title, description, available_date, meal_type, price) VALUES (?, ?, ?, ?, ?)
  `);
  const specials = [
    ["Taco Tuesday Special", "All tacos 50% off", null, "lunch", 3.50],
    ["Sushi Friday", "Fresh sushi rolls at a special price", null, "lunch", 7.00],
    ["Sunday Brunch Special", "Unlimited brunch buffet", null, "breakfast", 12.00],
  ];
  for (const s of specials) insertSpecial.run(...s);
  console.error(`Seeded ${items.length} menu items + ${specials.length} specials into cafeteria.db`);
}

// ── MCP Server ──────────────────────────────────────────────────────
const server = new Server(
  { name: "cafeteria-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function getTodayName() {
  return DAYS[new Date().getDay()];
}

function getCurrentMeal() {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_daily_menu",
      description: "Get the cafeteria menu for a specific day of the week",
      inputSchema: {
        type: "object",
        properties: {
          day: { type: "string", description: "Day of the week (monday-sunday). Defaults to today." },
        },
      },
    },
    {
      name: "get_meal_details",
      description: "Get menu for a specific meal on a specific day",
      inputSchema: {
        type: "object",
        properties: {
          day: { type: "string", description: "Day of the week" },
          meal: { type: "string", description: "Meal type: breakfast, lunch, or dinner" },
        },
        required: ["meal"],
      },
    },
    {
      name: "get_todays_specials",
      description: "Get today's special offers and deals in the cafeteria",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_current_meal",
      description: "Get what is currently being served right now based on the time of day",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "search_menu",
      description: "Search for specific food items across all days and meals",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Food item to search for" },
          vegetarian_only: { type: "boolean", description: "Only show vegetarian options" },
        },
        required: ["query"],
      },
    },
    {
      name: "mark_favorite",
      description: "Mark a cafeteria menu item as a student favorite",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "number", description: "Menu item ID" },
          studentId: { type: "string", description: "Student ID" },
        },
        required: ["itemId"],
      },
    },
    {
      name: "set_dietary_alert",
      description: "Set a dietary alert for a student for a specific allergen",
      inputSchema: {
        type: "object",
        properties: {
          allergen: { type: "string", description: "Allergen name (e.g. gluten, dairy, nuts)" },
          studentId: { type: "string", description: "Student ID" },
        },
        required: ["allergen"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_daily_menu": {
      const day = (args.day || getTodayName()).toLowerCase();
      const items = db.prepare("SELECT * FROM menu_items WHERE day_of_week = ? ORDER BY meal_type, category").all(day);
      if (items.length === 0) {
        return { content: [{ type: "text", text: `No menu found for ${day}` }], isError: true };
      }
      const grouped = { breakfast: [], lunch: [], dinner: [] };
      for (const item of items) {
        grouped[item.meal_type]?.push(item);
      }
      return { content: [{ type: "text", text: JSON.stringify({ day, menu: grouped, currentlyServing: getCurrentMeal() }, null, 2) }] };
    }

    case "get_meal_details": {
      const day = (args.day || getTodayName()).toLowerCase();
      const meal = args.meal.toLowerCase();
      const items = db.prepare("SELECT * FROM menu_items WHERE day_of_week = ? AND meal_type = ?").all(day, meal);
      return { content: [{ type: "text", text: JSON.stringify({ day, meal, items, isCurrentMeal: getCurrentMeal() === meal }, null, 2) }] };
    }

    case "get_todays_specials": {
      const specials = db.prepare("SELECT * FROM specials").all();
      return { content: [{ type: "text", text: JSON.stringify({ today: getTodayName(), specials }, null, 2) }] };
    }

    case "get_current_meal": {
      const meal = getCurrentMeal();
      const day = getTodayName();
      const items = db.prepare("SELECT * FROM menu_items WHERE day_of_week = ? AND meal_type = ?").all(day, meal);
      return { content: [{ type: "text", text: JSON.stringify({ day, currentMeal: meal, items, time: new Date().toLocaleTimeString() }, null, 2) }] };
    }

    case "search_menu": {
      const query = `%${args.query.toLowerCase()}%`;
      let sql = "SELECT * FROM menu_items WHERE LOWER(item_name) LIKE ?";
      const params = [query];
      if (args.vegetarian_only) {
        sql += " AND is_vegetarian = 1";
      }
      const results = db.prepare(sql).all(...params);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    case "mark_favorite": {
      const itemId = args.itemId;
      const studentId = args.studentId || "STU001";
      try {
        db.prepare("INSERT INTO favorites (student_id, item_id) VALUES (?, ?)").run(studentId, itemId);
        const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(itemId);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `${item?.item_name || 'Item'} added to favorites!` }) }] };
      } catch {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, reason: "Already in favorites" }) }] };
      }
    }

    case "set_dietary_alert": {
      const allergen = args.allergen;
      const studentId = args.studentId || "STU001";
      try {
        db.prepare("INSERT INTO dietary_alerts (student_id, allergen) VALUES (?, ?)").run(studentId, allergen);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Dietary alert set for ${allergen}. You'll be notified when menu items contain it.` }) }] };
      } catch {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, reason: "Alert already set" }) }] };
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
    } catch (e) { }
  }
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
  console.error("Client connected to Cafeteria MCP Server via SSE");
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
      case "get_daily_menu": {
        const day = (params?.day || getTodayName()).toLowerCase();
        const items = db.prepare("SELECT * FROM menu_items WHERE day_of_week = ? ORDER BY meal_type, category").all(day);
        const grouped = { breakfast: [], lunch: [], dinner: [] };
        for (const item of items) grouped[item.meal_type]?.push(item);
        result = { day, menu: grouped, currentlyServing: getCurrentMeal() };
        break;
      }
      case "get_meal_details": {
        const day = (params?.day || getTodayName()).toLowerCase();
        const meal = (params?.meal || getCurrentMeal()).toLowerCase();
        result = db.prepare("SELECT * FROM menu_items WHERE day_of_week = ? AND meal_type = ?").all(day, meal);
        break;
      }
      case "get_todays_specials": {
        result = db.prepare("SELECT * FROM specials").all();
        break;
      }
      case "get_current_meal": {
        const meal = getCurrentMeal();
        const day = getTodayName();
        const items = db.prepare("SELECT * FROM menu_items WHERE day_of_week = ? AND meal_type = ?").all(day, meal);
        result = { day, currentMeal: meal, items, time: new Date().toLocaleTimeString() };
        break;
      }
      case "search_menu": {
        const query = `%${(params?.query || "").toLowerCase()}%`;
        let sql = "SELECT * FROM menu_items WHERE LOWER(item_name) LIKE ?";
        const sqlParams = [query];
        if (params?.vegetarian_only) sql += " AND is_vegetarian = 1";
        result = db.prepare(sql).all(...sqlParams);
        break;
      }
      case "mark_favorite": {
        const itemId = params?.itemId;
        const studentId = params?.studentId || "STU001";
        try {
          db.prepare("INSERT INTO favorites (student_id, item_id) VALUES (?, ?)").run(studentId, itemId);
          const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(itemId);
          result = { success: true, message: `${item?.item_name || 'Item'} added to favorites!` };
        } catch {
          result = { success: false, reason: "Already in favorites" };
        }
        break;
      }
      case "set_dietary_alert": {
        const allergen = params?.allergen;
        const studentId = params?.studentId || "STU001";
        try {
          db.prepare("INSERT INTO dietary_alerts (student_id, allergen) VALUES (?, ?)").run(studentId, allergen);
          result = { success: true, message: `Dietary alert set for ${allergen}.` };
        } catch {
          result = { success: false, reason: "Alert already set" };
        }
        break;
      }
      case "get_user_favorites": {
        const studentId = params?.studentId || "STU001";
        const rows = db.prepare("SELECT item_id FROM favorites WHERE student_id = ?").all(studentId);
        result = rows.map(r => r.item_id);
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
  res.json({ status: "ok", server: "cafeteria-mcp-server", port: PORT });
});

const httpServer = app.listen(PORT, "0.0.0.0", () => {
  console.error(`Cafeteria MCP Server running on http://127.0.0.1:${PORT}`);
});

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Cafeteria MCP Server failed: port ${PORT} is already in use.`);
  } else {
    console.error("Cafeteria MCP Server failed to start:", error);
  }
  process.exit(1);
});
