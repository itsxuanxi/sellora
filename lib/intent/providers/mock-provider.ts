import type { DetectedSignal, SignalProvider } from "@/lib/intent/providers/types";
import type { SignalType } from "@/lib/intent/config";

/**
 * DEMO DATA ONLY. This provider does not call any real job board, funding
 * database, or news source — it deterministically fabricates plausible
 * recruiting-vertical signals so the product can be evaluated end-to-end
 * before a real integration is wired up (see providers/csv-provider.ts for
 * the real-data path). Every signal it produces:
 *   - has `sourceUrl: null` and description explicitly labeled "Demo data"
 *   - is tagged with SignalSource.kind === "mock", which the UI must render
 *     with a visible "Demo data" badge, never as if it were verified
 *
 * Never wire this into a production recommendation flow without that badge.
 */
export const mockProvider: SignalProvider = {
  key: "mock_recruiting_demo",
  name: "Demo data (simulated)",
  kind: "mock",
};

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), h | 1) + Math.imul(h ^ (h >>> 7), h | 61)) ^ h;
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

const HARD_TO_FILL_TITLES = [
  "Senior Recruiter",
  "Staff Software Engineer",
  "VP of Engineering",
  "Director of Data Science",
  "Enterprise Account Executive",
];
const HIRING_LEADER_TITLES = ["Head of Talent Acquisition", "VP People", "CHRO", "Director of Recruiting"];
const REGIONS = ["Toronto, ON", "Austin, TX", "Denver, CO", "Vancouver, BC", "Chicago, IL"];

/**
 * @param seedCompanies Company names to generate demo signals for (e.g. from
 *                       a campaign's imported contact list, or a short demo
 *                       set typed in by the user).
 */
export function generateMockSignals(seedCompanies: string[]): DetectedSignal[] {
  const out: DetectedSignal[] = [];
  const now = Date.now();

  for (const companyName of seedCompanies) {
    const rand = seededRandom(companyName.toLowerCase().trim());
    const signals: { type: SignalType; daysAgo: number; title: string; description: string; evidence: string }[] = [];

    if (rand() > 0.35) {
      const count = 5 + Math.floor(rand() * 8);
      signals.push({
        type: "job_surge",
        daysAgo: Math.floor(rand() * 6),
        title: `${count} new roles posted this week`,
        description: `${companyName} posted ${count} new job listings in the last 7 days.`,
        evidence: `${count} postings detected between day 0 and day 7 (demo data).`,
      });
    }
    if (rand() > 0.5) {
      const title = HARD_TO_FILL_TITLES[Math.floor(rand() * HARD_TO_FILL_TITLES.length)];
      signals.push({
        type: "stale_role",
        daysAgo: 30 + Math.floor(rand() * 20),
        title: `"${title}" open 30+ days`,
        description: `${companyName}'s "${title}" listing has been open without a hire for over a month.`,
        evidence: `Listing first seen ${30 + Math.floor(rand() * 20)} days ago, still active (demo data).`,
      });
    }
    if (rand() > 0.6) {
      const title = HARD_TO_FILL_TITLES[Math.floor(rand() * HARD_TO_FILL_TITLES.length)];
      signals.push({
        type: "hard_to_fill_role",
        daysAgo: Math.floor(rand() * 15),
        title: `Hard-to-fill role open: ${title}`,
        description: `${companyName} is hiring for "${title}", a role with a historically small qualified candidate pool.`,
        evidence: `Role classified as hard-to-fill by specialty + seniority (demo data).`,
      });
    }
    if (rand() > 0.7) {
      signals.push({
        type: "funding_round",
        daysAgo: 20 + Math.floor(rand() * 60),
        title: "Recently raised a funding round",
        description: `${companyName} closed a new round of funding, per demo dataset.`,
        evidence: `Simulated funding event (demo data — not a verified filing).`,
      });
    }
    if (rand() > 0.65) {
      const leaderTitle = HIRING_LEADER_TITLES[Math.floor(rand() * HIRING_LEADER_TITLES.length)];
      signals.push({
        type: "new_hiring_leader",
        daysAgo: 10 + Math.floor(rand() * 60),
        title: `New ${leaderTitle} appointed`,
        description: `${companyName} appears to have a newly appointed ${leaderTitle} (demo data).`,
        evidence: `Simulated leadership-change signal (demo data).`,
      });
    }
    if (rand() > 0.55) {
      signals.push({
        type: "headcount_growth",
        daysAgo: Math.floor(rand() * 30),
        title: "Headcount growing quickly",
        description: `${companyName}'s employee count appears to be growing faster than its industry median.`,
        evidence: `Simulated headcount trend (demo data).`,
      });
    }

    for (const s of signals) {
      out.push({
        companyName,
        domain: null,
        industry: "Business services",
        region: REGIONS[Math.floor(rand() * REGIONS.length)],
        companySize: ["11-50", "51-200", "201-1000"][Math.floor(rand() * 3)],
        signal: {
          signalType: s.type,
          title: s.title,
          description: s.description,
          evidence: s.evidence,
          sourceUrl: null,
          sourceKey: mockProvider.key,
          occurredAt: new Date(now - s.daysAgo * 24 * 60 * 60 * 1000),
          confidence: "low", // mock data is never treated as high-confidence
        },
      });
    }
  }

  return out;
}
