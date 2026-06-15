import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  const key = (process.env.GEMINI_API_KEY || "dummy-key").replace(/['"]/g, "").trim();
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

export interface AITool {
  server: string;
  name: string;
  description: string;
  inputSchema: any;
}

export interface AIResponse {
  answer: string;
  toolCalls: Array<{ server: string; tool: string; args: any }>;
}

function convertJsonSchemaToGemini(schema: any): any {
  if (!schema || !schema.properties) return { type: "OBJECT", properties: {} };

  const properties: any = {};
  for (const [key, value] of Object.entries(schema.properties as Record<string, any>)) {
    const prop: any = { description: value.description || "" };
    switch (value.type) {
      case "string": prop.type = "STRING"; break;
      case "number":
      case "integer": prop.type = "NUMBER"; break;
      case "boolean": prop.type = "BOOLEAN"; break;
      case "array":
        prop.type = "ARRAY";
        // 🛠️ FIX: Always supply an explicit type blueprint for arrays to satisfy Gemini's compiler
        if (value.items && value.items.type) {
          prop.items = { type: value.items.type.toUpperCase() };
        } else {
          prop.items = { type: "STRING" }; // Safe default fallback
        }
        break;
      default: prop.type = "STRING";
    }
    properties[key] = prop;
  }

  return {
    type: "OBJECT",
    properties,
    required: schema.required || [],
  };
}

export async function queryGemini(
  systemPrompt: string,
  userQuery: string,
  tools: AITool[],
  callTool: (server: string, toolName: string, args: any) => Promise<any>,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<AIResponse> {
  const genAI = getGenAI();

  const functionDeclarations = tools.map((tool) => ({
    name: `${tool.server}__${tool.name}`,
    description: tool.description,
    parameters: convertJsonSchemaToGemini(tool.inputSchema),
  }));

  console.log(`[Gemini] Using API key: ${(process.env.GEMINI_API_KEY || "").substring(0, 8)}...`);
  console.log(`[Gemini] Sending query: "${userQuery}" with ${functionDeclarations.length} tools and ${conversationHistory.length} history messages`);

  const modelOptions: any = {
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  };
  if (functionDeclarations.length > 0) {
    modelOptions.tools = [{ functionDeclarations }];
  }

  const model = genAI.getGenerativeModel(modelOptions);

  const geminiHistory: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];
  for (const msg of conversationHistory) {
    const role = msg.role === "assistant" ? "model" : "user";

    if (geminiHistory.length === 0 && role === "model") {
      continue;
    }

    if (geminiHistory.length > 0 && geminiHistory[geminiHistory.length - 1].role === role) {
      geminiHistory[geminiHistory.length - 1].parts[0].text += "\n\n" + msg.content;
    } else {
      geminiHistory.push({
        role: role as "user" | "model",
        parts: [{ text: msg.content }],
      });
    }
  }

  const chat = model.startChat({
    history: geminiHistory,
  });

  let result;
  try {
    result = await chat.sendMessage(userQuery);
  } catch (err: any) {
    console.error(`[Gemini] sendMessage failed:`, err?.message || err);
    console.error(`[Gemini] Full error:`, JSON.stringify(err, null, 2));
    throw err;
  }

  let currentResponse = result.response;
  const toolCallResults: Array<{ server: string; tool: string; args: any }> = [];

  let iterations = 0;
  while (currentResponse.functionCalls() && currentResponse.functionCalls()!.length > 0 && iterations < 5) {
    iterations++;
    const functionCalls = currentResponse.functionCalls()!;
    console.log(`[Gemini] AI requested ${functionCalls.length} tool call(s): ${functionCalls.map(fc => fc.name).join(", ")}`);
    const functionResponses: any[] = [];

    for (const fc of functionCalls) {
      const [serverName, toolName] = fc.name.split("__");
      const args = fc.args || {};
      toolCallResults.push({ server: serverName, tool: toolName, args });

      try {
        const toolResult = await callTool(serverName, toolName, args);

        const structuralResponse = typeof toolResult === "string"
          ? { result: toolResult }
          : toolResult;

        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: structuralResponse,
          },
        });
      } catch (error: any) {
        console.error(`[Gemini] Tool call ${fc.name} failed:`, error.message);
        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: { error: error.message },
          },
        });
      }
    }

    const nextResult = await chat.sendMessage(functionResponses);
    currentResponse = nextResult.response;
  }

  let textResponse = "";
  try {
    textResponse = currentResponse.text();
  } catch (e) {
    console.log("[Gemini] Could not get text response from model:", e);
  }

  if (toolCallResults.length > 0) {
    console.log(`[Gemini] Final response length: ${textResponse.length} chars (after ${iterations} tool-call iterations)`);
  } else {
    console.log(`[Gemini] Direct response (no tools): ${textResponse.substring(0, 100)}...`);
  }

  return {
    answer: textResponse || "I couldn't generate a response.",
    toolCalls: [],
  };
}