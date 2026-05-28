import { Hero } from "../components/Hero";
import { LabCard } from "../components/LabCard";
import { NewLabCard } from "../components/NewLabCard";
import { RecentVerdict } from "../components/RecentVerdict";
import { labs } from "../data/labs";

export function LabsScreen() {
  return (
    <div className="wrap">
      <Hero />

      <div className="labs-bar">
        <div className="sect-label">Saved labs - 2</div>
        <div className="sect-label faint">Sorted by last run</div>
      </div>

      <section className="lab-grid">
        {labs.map((lab) => (
          <LabCard lab={lab} key={lab.name} />
        ))}
      </section>

      <div className="spacer-16" />
      <NewLabCard />
      <RecentVerdict />
    </div>
  );
}
