import { Bell, LineChart, Search } from "lucide-react";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div id="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <LineChart size={15} strokeWidth={2.4} />
          </span>
          QuantLab
          <span className="tag">v0.4 - sim</span>
        </div>

        <nav className="topnav" aria-label="Primary">
          <a className="active">Labs</a>
          <a>New backtest</a>
          <a>Screener</a>
          <a>Docs</a>
        </nav>

        <span className="spacer" />
        <button className="iconbtn" title="Search labs">
          <Search size={17} />
        </button>
        <button className="iconbtn" title="Notifications">
          <Bell size={17} />
        </button>
        <div className="avatar" title="You">
          QL
        </div>
      </header>

      <main className="main">{children}</main>
    </div>
  );
}
