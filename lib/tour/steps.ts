/**
 * The guided story, as data.
 *
 * One deal — Cloudmint — from a revenue leak to a booked next meeting, told
 * through the real application. Every step points at a real control by its
 * `data-tour` attribute; the components carry the attribute and know nothing
 * else about the tour.
 *
 * The copy deliberately does not quote scores, probabilities or amounts.
 * Those are computed by the scoring engine from the seeded evidence, and a
 * tour that hardcoded them would drift the first time a weight changed and
 * then confidently contradict the screen it is pointing at. It names what to
 * look at; the product supplies the numbers.
 *
 * The one figure that is safe to state is the deal value, because that is an
 * input to the engine rather than an output of it.
 */

export interface TourStep {
  id: string;
  /** Route prefix this step lives on. */
  route: string;
  /** `data-tour` value of the element to highlight. */
  target: string;
  /** DETECT | DECIDE | ACT | LEARN — the phase this step belongs to. */
  phase: "Detect" | "Decide" | "Act" | "Learn";
  title: string;
  body: string;
  /** What the visitor is asked to do. */
  instruction: string;
  /**
   * "click" means the highlighted control must really be used — there is no
   * Continue button. "read" advances on Continue.
   */
  advance: "click" | "read";
  placement?: "top" | "bottom";
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "find",
    route: "/dashboard",
    target: "priority-row-1",
    phase: "Detect",
    title: "Start with the revenue that needs attention",
    body: "Every open deal, ranked by expected revenue — deal value multiplied by win probability. Cloudmint is a $42,000 deal with strong buying intent that has gone quiet, which is why it is at the top.",
    instruction: "Open the Cloudmint opportunity.",
    advance: "click",
    placement: "bottom",
  },
  {
    id: "signals",
    route: "/opportunities/",
    target: "signal-timeline",
    phase: "Detect",
    title: "See what changed",
    body: "The demo, the proposal, the two opens, the VP Finance joining the evaluation, the security page view — and then nothing for four days. Selryn reads them together rather than one at a time.",
    instruction: "Look at the signals on this deal, then continue.",
    advance: "read",
    placement: "bottom",
  },
  {
    id: "risk",
    route: "/opportunities/",
    target: "score-summary",
    phase: "Decide",
    title: "Turn activity into a decision",
    body: "Customer fit, engagement and buying signals each contribute points, and every line says which rule fired. The silence after a proposal that was opened twice is what puts this deal's expected revenue at risk.",
    instruction: "Read why the score is what it is, then continue.",
    advance: "read",
    placement: "bottom",
  },
  {
    id: "recommendation",
    route: "/opportunities/",
    target: "next-action",
    phase: "Decide",
    title: "Know what to do next",
    body: "One action, chosen from the stage, the silence and the signals — with the evidence that led to it and how confident Selryn is. Maya viewed the security page after joining the evaluation, and nobody has followed up.",
    instruction: "Read the recommendation and its evidence, then continue.",
    advance: "read",
    placement: "bottom",
  },
  {
    id: "draft",
    route: "/opportunities/",
    target: "action-console",
    phase: "Act",
    title: "Keep the human in control",
    body: "Selryn recommends; a person decides. It will write the action from the evidence above, and nothing customer-facing leaves without your approval — in this sandbox nothing leaves at all, whatever you click.",
    instruction: "Click “Draft the action”.",
    advance: "click",
    placement: "top",
  },
  {
    id: "approve",
    route: "/opportunities/",
    target: "approve-send",
    phase: "Act",
    title: "Review, edit, then approve",
    body: "Edit it freely — Selryn stores its draft alongside what you actually sent, so whether a human changed it is measured rather than assumed. The recommendation, your edits, your approval and the destination are all recorded together.",
    instruction: "Change anything you like, then approve it.",
    advance: "click",
    placement: "top",
  },
  {
    id: "response",
    route: "/opportunities/",
    target: "loop-controls",
    phase: "Learn",
    title: "See what happened next",
    body: "Maya replied: “Wednesday works. Please include our security lead and procurement manager.” Recording that reply is not bookkeeping — it becomes evidence the scoring engine reads, so the deal stops looking silent.",
    instruction: "Click “Log response”, choose Replied, and save.",
    advance: "click",
    placement: "top",
  },
  {
    id: "outcome",
    route: "/opportunities/",
    target: "score-summary",
    phase: "Learn",
    title: "Connect the action to revenue",
    body: "The reply re-scored the deal: the leak closed, win probability rose and expected revenue rose with it. Move the stage forward and the figures move again — because the evidence changed, not because a demo said so. The deal has advanced. It has not been won.",
    instruction: "That is the loop, closed.",
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
