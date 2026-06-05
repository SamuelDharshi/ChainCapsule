import type { Metadata } from "next";
import "./globals.css";
import "@mysten/dapp-kit/dist/index.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import AICapsuleChat from "@/components/AICapsuleChat";

export const metadata: Metadata = {
  title: "ChainCapsule — On-chain Time Capsule & Dead Man's Switch",
  description:
    "Encrypt files client-side, store on Walrus decentralized storage, and program a Sui smart contract to release your decryption key after a future date or inactivity. No server. No middleman.",
  keywords: ["Sui", "Walrus", "time capsule", "dead man switch", "encryption", "blockchain", "Tatum"],
  openGraph: {
    title: "ChainCapsule",
    description: "Store your secrets on-chain. The blockchain unlocks them when you can't.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          <main className="pt-navbar">
            {children}
          </main>
          <AICapsuleChat />
        </Providers>
      </body>
    </html>
  );
}
