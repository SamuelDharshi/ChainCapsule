"use client";
import { useEffect, useState } from "react";

interface Props {
  targetMs: number;   // Unix epoch ms when the capsule unlocks
  onExpire?: () => void;
}

interface TimeLeft {
  days:    number;
  hours:   number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calculate(targetMs: number): TimeLeft {
  const diff = targetMs - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const s = Math.floor(diff / 1000);
  return {
    days:    Math.floor(s / 86400),
    hours:   Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    expired: false,
  };
}

export default function CountdownTimer({ targetMs, onExpire }: Props) {
  const [time, setTime] = useState<TimeLeft>(calculate(targetMs));

  useEffect(() => {
    const interval = setInterval(() => {
      const t = calculate(targetMs);
      setTime(t);
      if (t.expired) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetMs, onExpire]);

  if (time.expired) {
    return (
      <div className="countdown">
        <span className="badge badge-unlocked" style={{ fontSize: "0.9rem", padding: "0.4rem 1rem" }}>
          🔓 Unlockable Now
        </span>
      </div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="countdown">
      <Segment value={pad(time.days)}    label="Days" />
      <span className="countdown-sep">:</span>
      <Segment value={pad(time.hours)}   label="Hrs" />
      <span className="countdown-sep">:</span>
      <Segment value={pad(time.minutes)} label="Min" />
      <span className="countdown-sep">:</span>
      <Segment value={pad(time.seconds)} label="Sec" />
    </div>
  );
}

function Segment({ value, label }: { value: string; label: string }) {
  return (
    <div className="countdown-segment">
      <span className="countdown-value">{value}</span>
      <span className="countdown-label">{label}</span>
    </div>
  );
}
