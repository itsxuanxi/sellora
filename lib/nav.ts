/**
 * The product's destinations, as data.
 *
 * Kept free of React so it can be asserted directly — the navigation is a
 * claim about what belongs in the daily loop, and that claim is worth a test
 * rather than only a code review. `components/app/sidebar-nav.tsx` renders it
 * and owns the icons.
 *
 * Each destination answers exactly one question:
 *
 *   Today        what should I do now?
 *   Deals        which opportunities matter?
 *   Actions      what is waiting for execution?
 *   Impact       what revenue changed?
 *   Integrations where does the data come from?
 *   Settings     how is this workspace configured?
 *
 * This replaced thirteen items across two groups. Nothing was deleted:
 * accounts, contacts, the ICP builder and intent campaigns are all still
 * reachable, from inside the screen they belong to rather than from a
 * permanent rail.
 */

export interface NavDestination {
  name: string;
  href: string;
}

export const NAV_DESTINATIONS: NavDestination[] = [
  { name: "Today", href: "/dashboard" },
  { name: "Deals", href: "/opportunities" },
  { name: "Actions", href: "/actions" },
  { name: "Impact", href: "/impact" },
  { name: "Integrations", href: "/integrations" },
  { name: "Settings", href: "/settings" },
];

/** Sections that used to own a nav slot and are now reached another way. */
export const RETIRED_NAV_HREFS = [
  "/recover",
  "/signals",
  "/campaigns",
  "/insights",
  "/accounts",
  "/prospects",
  "/icp",
  "/agent",
  "/analytics",
  "/intent",
];
