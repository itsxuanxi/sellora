/**
 * The product's destinations, as data.
 *
 * Kept free of React so it can be asserted directly — the navigation is a
 * claim about what the product is for, and that claim is worth a test rather
 * than only a code review. `components/app/sidebar-nav.tsx` renders it and
 * owns the icons.
 *
 * Three primary entries, one per capability:
 *
 *   Today     which deals need me now, why, and what to do  (decisions)
 *   Deals     one opportunity: its risks, evidence, history (detection)
 *   Outcomes  what we did, what came back, what moved       (learning)
 *
 * And two supporting ones, which are infrastructure rather than capabilities:
 *
 *   Integrations  where the data comes from
 *   Settings      how this workspace is configured
 *
 * The previous seven collapsed to this because three of them were not
 * separate jobs. Actions and Impact were both "what happened after we acted"
 * split across two pages, so neither showed the loop as a loop; they are now
 * two sections of Outcomes. Overlooked was a filter on a list of deals that
 * had been promoted to a rail, and it is a filter again.
 *
 * Nothing was deleted. Every retired route still resolves — see
 * `REDIRECTED_NAV_HREFS` for the ones that now forward, and
 * `RETIRED_NAV_HREFS` for the ones reachable from inside the screen they
 * belong to. A link in somebody's bookmark bar or a Slack message from last
 * week still lands somewhere useful.
 */

export interface NavDestination {
  name: string;
  href: string;
  /** One line: the question this destination answers. */
  answers: string;
}

/** The three capabilities. */
export const NAV_DESTINATIONS: NavDestination[] = [
  { name: "Today", href: "/dashboard", answers: "Who needs a follow-up now, and what should it say?" },
  { name: "Deals", href: "/opportunities", answers: "What is the risk on this deal, and what is the evidence?" },
  { name: "Outcomes", href: "/outcomes", answers: "What did we do, what came back, and what moved?" },
];

/** Infrastructure. Present in the rail, below a divider, not a capability. */
export const NAV_SUPPORTING: NavDestination[] = [
  { name: "Integrations", href: "/integrations", answers: "Where does this data come from?" },
  { name: "Settings", href: "/settings", answers: "How is this workspace configured?" },
];

/** Everything in the rail, in order. */
export const ALL_NAV_DESTINATIONS: NavDestination[] = [
  ...NAV_DESTINATIONS,
  ...NAV_SUPPORTING,
];

/**
 * Routes that now forward somewhere else.
 *
 * Kept as redirects rather than removed: these were nav destinations for
 * months, so they are in bookmarks, in Slack threads and in the tour. A 404
 * would be a worse answer than the page that absorbed them.
 */
export const REDIRECTED_NAV_HREFS: Record<string, string> = {
  "/actions": "/outcomes",
  "/impact": "/outcomes",
  "/analytics": "/outcomes",
};

/**
 * Sections with no nav slot of their own, reached from the screen they belong
 * to.
 *
 * `/recovery` is the notable one: it lost its rail slot but kept its page,
 * because reopening dormant deals is a real job with real content behind it —
 * just a weekly one rather than part of working today's list. It is linked
 * from Deals. Redirecting it to a filter would have thrown away the
 * eligibility rules and the set-aside reasons that page exists to show.
 */
export const RETIRED_NAV_HREFS = [
  "/recovery",
  "/recover",
  "/signals",
  "/campaigns",
  "/insights",
  "/accounts",
  "/prospects",
  "/icp",
  "/agent",
  "/intent",
];
