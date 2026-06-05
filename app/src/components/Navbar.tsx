"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@mysten/dapp-kit";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        {/* Logo */}
        <Link href="/" className="navbar-logo">
          <span className="logo-icon">⛓️</span>
          <span>Chain<span className="text-gradient">Capsule</span></span>
        </Link>

        {/* Nav Links */}
        <ul className="navbar-links">
          <li>
            <Link href="/" className={pathname === "/" ? "active" : ""}>Home</Link>
          </li>
          <li>
            <Link href="/create" className={pathname === "/create" ? "active" : ""}>Create</Link>
          </li>
          <li>
            <Link href="/dashboard" className={pathname.startsWith("/dashboard") ? "active" : ""}>Dashboard</Link>
          </li>
        </ul>

        {/* Wallet Connect */}
        <ConnectButton />
      </div>
    </nav>
  );
}
