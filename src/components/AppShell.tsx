import { LineChart, Search } from "lucide-react";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  activeTab: "experiments" | "data" | "docs";
  onTabChange: (tab: "experiments" | "data" | "docs") => void;
};

export function AppShell({ children, activeTab, onTabChange }: AppShellProps) {
  return (
    <div id="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <LineChart size={15} strokeWidth={2.4} />
          </span>
          QuantLab
          <span className="tag">local</span>
        </div>

        <nav className="topnav" aria-label="Primary">
          <button className={activeTab === "experiments" ? "active" : ""} onClick={() => onTabChange("experiments")}>
            Experiments
          </button>
          <button className={activeTab === "data" ? "active" : ""} onClick={() => onTabChange("data")}>
            Data
          </button>
          <button className={activeTab === "docs" ? "active" : ""} onClick={() => onTabChange("docs")}>
            Docs
          </button>
        </nav>

        <span className="spacer" />
        <button className="iconbtn" title="Search labs">
          <Search size={17} />
        </button>
        <div className="avatar" title="You">
          QL
        </div>
      </header>

      <main className="main">{children}</main>
    </div>
  );
}
