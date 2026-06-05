/**
 * Vercel Serverless Function — /api/chat
 * Replaces the Express /api/chat endpoint for production deployment.
 * Gemini AI Oracle with capsule context.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  }
} catch (e) {
  console.error("Failed to init Gemini AI:", e);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // CORS headers for browser requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (!ai) {
    return res.status(500).json({
      error: "AI service unavailable. Set GEMINI_API_KEY in Vercel environment variables.",
    });
  }

  const { messages, capsules, blockchainState } = req.body;

  try {
    const activeCapsulesText =
      capsules && capsules.length > 0
        ? capsules
            .map((c: any) => {
              const type = c.unlockAfterMs > 0 ? "Time Capsule" : "Dead Man's Switch";
              const remaining =
                c.unlockAfterMs > 0
                  ? `${Math.max(0, (c.unlockAfterMs - blockchainState.currentTimeMs) / 1000).toFixed(0)} seconds remaining`
                  : `${c.inactivityDays} days limit, last heartbeat ${new Date(c.lastHeartbeat).toISOString()}`;
              return `- ID: ${c.id}\n  Name: ${c.name}\n  Type: ${type}\n  Status: ${c.isUnlocked ? "Unlocked" : "Locked"}\n  Beneficiary: ${c.beneficiary}\n  Timer: ${remaining}\n  Walrus Blob ID: ${c.walrusBlobId}`;
            })
            .join("\n")
        : "No active capsules found.";

    const systemInstruction = `You are ChainCapsule AI Oracle — a helpful assistant integrated with Sui + Walrus blockchain on Tatum RPC.
Your purpose is to answer questions about on-chain time capsules and dead man's switches.

Current Sui Blockchain State:
- Current Time: ${new Date(blockchainState?.currentTimeMs || Date.now()).toISOString()}
- Owner Wallet: ${blockchainState?.walletAddress || "Not connected"}
- Active Capsules:
${activeCapsulesText}

Answer concisely. Explain cryptography clearly. Calculate remaining times using the current timestamp above.`;

    const lastMessage = messages[messages.length - 1];

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: lastMessage.text,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: error.message || "AI request failed" });
  }
}
