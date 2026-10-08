export type RailIconName = "chats" | "feed" | "traders" | "record" | "analytics" | "profile" | "sign-in" | "sign-up" | "sign-out";

export function RailIcon({ name }: { name: RailIconName }) {
  const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return <svg className="chat-rail-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...shared}>
    {name === "chats" && <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.4-.7L4 20l1.3-3.8A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8 11h8M8 14h5" /></>}
    {name === "feed" && <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>}
    {name === "traders" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8" /></>}
    {name === "record" && <><path d="M6 3.8h8l4 4V20H6z" /><path d="M14 4v4h4M9 12h6M9 16h6" /></>}
    {name === "analytics" && <><path d="M4 19.5h16" /><path d="M6 16v-5M11 16V6M16 16v-3M20 16V8" /></>}
    {name === "profile" && <><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></>}
    {name === "sign-in" && <><path d="M12 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" /><path d="M12 4v16M5 12h4" /></>}
    {name === "sign-up" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M18 8v6M15 11h6" /></>}
    {name === "sign-out" && <><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" /><path d="M12 4v16M12 12h7" /></>}
  </svg>;
}
