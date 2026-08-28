/**
 * The guided tour, as data.
 *
 * Every step points at a real control in the real application by its
 * `data-tour` attribute. There is no scripted mock behind any of them: the
 * step that says "act on it" highlights the actual button that writes to the
 * ledger, and the tour advances because the write happened.
 *
 * That is the difference from the tour this replaces, which drove a parallel
 * set of fixture components. Keeping targets as strings here means the tour
 * knows nothing about the components it points at, and the components know
 * nothing about the tour beyond one attribute.
 */

export interface TourStep {
  id: string;
  /** Route prefix this step lives on. */
  route: string;
  /** `data-tour` value of the element to highlight. */
  target: string;
  eyebrow: string;
  title: string;
  body: string;
  /** What the visitor is asked to do. */
  instruction: string;
  /**
   * "click" means the highlighted control must really be used — there is no
   * Continue button. "read" advances on Next.
   */
  advance: "click" | "read";
  placement?: "top" | "bottom";
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "priorities",
    route: "/dashboard",
    target: "priority-row-1",
    eyebrow: "Detect",
    title: "Start where the next hour is worth most",
    body: "Every open deal, sorted by expected revenue — deal value multiplied by win probability. The arithmetic is a column, so the ranking can be checked rather than trusted.",
    instruction: "Open the deal at the top.",
    advance: "click",
    placement: "bottom",
  },
  {
    id: "score",
    route: "/opportunities/",
    target: "opportunity-score",
    eyebrow: "Detect",
    title: "The score shows its work",
    body: "Customer fit, engagement and buying signals each contribute points, and every line says which rule fired. Nothing here is a black box you have to take on faith.",
    instruction: "Have a look, then continue.",
    advance: "read",
    placement: "bottom",
  },
  {
    id: "recommendation",
    route: "/opportunities/",
    target: "next-action",
    eyebrow: "Decide",
    title: "One action, with the evidence attached",
    body: "Selryn picks a single next step from the stage, the silence and the signals — and shows the reasoning, so you can disagree with it on the merits.",
    instruction: "Read the recommendation, then continue.",
    advance: "read",
    placement: "bottom",
  },
  {
    id: "act",
    route: "/opportunities/",
    target: "action-controls",
    eyebrow: "Act",
    title: "Acting really writes",
    body: "These buttons are the product's own. In this sandbox they update the ledger for real — what they will not do is send anything to the invented person on the other end.",
    instruction: "Click “Mark done”.",
    advance: "click",
    placement: "top",
  },
  {
    id: "recorded",
    route: "/opportunities/",
    target: "deal-timeline",
    eyebrow: "Learn",
    title: "Your decision is on the record",
    body: "The action you just took joined this deal's chain: advice given, what was done about it, how the buyer reacted, what the deal did next. Selryn then recomputes the next action from the new state — which sometimes means different advice and sometimes the same advice, because the situation itself has not changed.",
    instruction: "Look at the timeline, then continue.",
    advance: "read",
    placement: "bottom",
  },
  {
    id: "to-analytics",
    route: "/opportunities/",
    target: "nav-analytics",
    eyebrow: "Learn",
    title: "Where it all adds up",
    body: "Actions, buyer responses and outcomes are recorded together, so the product can report what its advice was actually worth.",
    instruction: "Open Analytics.",
    advance: "click",
    placement: "bottom",
  },
  {
    id: "impact",
    route: "/analytics",
    target: "impact",
    eyebrow: "Learn",
    title: "The loop closes here",
    body: "Recommendation → action → response → outcome, counted honestly. The sample data includes the actions that went nowhere, because a dataset where every recommendation worked would teach you something false.",
    instruction: "That's the tour.",
    advance: "read",
    placement: "bottom",
  },
];

export const TOTAL_TOUR_STEPS = TOUR_STEPS.length;

/** Whether a step belongs on the route currently being viewed. */
export function stepMatchesRoute(step: TourStep, pathname: string): boolean {
  return step.route.endsWith("/")
    ? pathname.startsWith(step.route)
    : pathname === step.route;
}

/** The first step that belongs to a route — where a direct visit should land. */
export function firstStepOnRoute(pathname: string): number {
  const i = TOUR_STEPS.findIndex((s) => stepMatchesRoute(s, pathname));
  return i === -1 ? 0 : i;
}
