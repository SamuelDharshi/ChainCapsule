import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google Gen AI securely on the server
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } else {
    console.warn("GEMINI_API_KEY is not defined in the environment. AI Assistant will operate in fallback mode.");
  }
} catch (error) {
  console.error("Failed to initialize GoogleGenAI client:", error);
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", aiEnabled: !!ai });
});

// AI Chat Assistant endpoint - implements Gemini 3.5 Flash search/interaction queries about capsules
app.post("/api/chat", async (req, res) => {
  const { messages, capsules, blockchainState } = req.body;

  if (!ai) {
    return res.status(500).json({
      error: "AI service is currently unavailable. Please configure the GEMINI_API_KEY.",
    });
  }

  try {
    const activeCapsulesText = capsules && capsules.length > 0 
      ? capsules.map((c: any) => {
          const type = c.unlockAfterMs > 0 ? "Time Capsule" : "Dead Man's Switch";
          const remaining = c.unlockAfterMs > 0 
            ? `${Math.max(0, (c.unlockAfterMs - blockchainState.currentTimeMs) / 1000).toFixed(0)} seconds remaining`
            : `${c.inactivityDays} days limit, last heartbeat ${new Date(c.lastHeartbeat).toISOString()}, current clock ${new Date(blockchainState.currentTimeMs).toISOString()}`;
          return `- ID: ${c.id}\n  Name: ${c.name}\n  Type: ${type}\n  Status: ${c.isUnlocked ? "Unlocked" : "Locked"}\n  Owner: ${c.owner}\n  Beneficiary: ${c.beneficiary}\n  Timer Status: ${remaining}\n  Walrus Blob ID: ${c.walrusBlobId}`;
        }).join("\n")
      : "No active capsules found in the virtual registry.";

    const systemInstruction = `You are a helpful, secure ChainCapsule Assistant integrated with the Tatum MCP query suite on the Sui Chain + Walrus decentralized storage.
Your purpose is to answer user queries about their on-chain time capsules, dead man's switches, cryptographic security, or the status of their active virtual capsules.

Here is the current state of the SUI Virtual Blockchain Sandbox:
- Current Time: ${new Date(blockchainState?.currentTimeMs || Date.now()).toISOString()} (Timestamp MS: ${blockchainState?.currentTimeMs || Date.now()})
- Simulated Owner Wallet Address: ${blockchainState?.walletAddress || '0xOwner'}
- Simulated Beneficiary Wallet Address: ${blockchainState?.beneficiaryAddress || '0xBeneficiary'}
- Active Capsules on Core Contract:
${activeCapsulesText}

Answer questions objectively and clearly using a clean technical style. If asked "How long until capsule <id> unlocks?", calculate the exact remaining seconds using the current SUI Clock time from the SUI Clock object above, or explain whether they can call heartbeat() or unlock(). Always explain how their browser uses AES-256 for local ciphertext encryption before storing on Walrus. Keep your response helpful, concise, and structured.`;

    // Map conversation array to content parts format expected by GoogleGenAI
    const lastMessage = messages[messages.length - 1];
    
    // We can use a direct call to generateContent for stateless queries or build custom conversation
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: lastMessage.text,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message || "An error occurred with the AI assistant." });
  }
});

// Setup Vite Dev Server / Static Production Server
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ChainCapsule Server] Running on http://localhost:${PORT}`);
  });
}

setupVite().catch((error) => {
  console.error("Vite server initialization error:", error);
});
