"use client";
import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

// Password box with an eye button inside the bar. Inline styles so it works in both the Tailwind and the old CSS pages.
export default function PasswordInput({ style, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  const Icon = show ? EyeOff : Eye;
  return (
    <span style={{ position: "relative", display: "block" }}>
      <input {...props} type={show ? "text" : "password"} style={{ ...style, paddingRight: 44, width: "100%" }} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        tabIndex={-1}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "flex", padding: 4, background: "none", border: 0, color: "#6b7280", cursor: "pointer", width: "auto" }}
      >
        <Icon size={18} />
      </button>
    </span>
  );
}
