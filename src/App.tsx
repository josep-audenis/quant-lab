import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { DataScreen } from "./screens/DataScreen";
import { DocsScreen } from "./screens/DocsScreen";
import { LabsScreen } from "./screens/LabsScreen";

export function App() {
  const [activeTab, setActiveTab] = useState<"experiments" | "data" | "docs">("experiments");

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "docs" ? <DocsScreen /> : activeTab === "data" ? <DataScreen /> : <LabsScreen />}
    </AppShell>
  );
}
