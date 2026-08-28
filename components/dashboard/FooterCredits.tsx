"use client";

import { useEffect, useState } from "react";

export default function FooterCredits() {
  const [rightPad, setRightPad] = useState("pr-72");

  useEffect(() => {
    function check() {
      const sidebar = document.querySelector("aside.fixed.right-0");
      if (!sidebar) return;
      const w = sidebar.getBoundingClientRect().width;
      setRightPad(w <= 48 ? "pr-16" : "pr-80");
    }
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className={`pb-4 text-right pl-56 ${rightPad} transition-all`}>
      <span className="text-[11px] text-gray-400/70 select-none tracking-wide">
        Developed by © Kappa-ai.com
      </span>
    </div>
  );
}
