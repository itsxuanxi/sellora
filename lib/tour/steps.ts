/**
 * The guided story, as data.
 *
 * One deal — Cloudmint — from an unanswered proposal to a booked next
 * meeting, told
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

/**
 * The account the story follows, and the anchor its card carries on Today.
 *
 * The tour used to anchor its first step on whichever card happened to be
 * first ("follow-up-1") and tell the visitor to "open the deal at the top".
 * That worked while Today ranked by expected revenue and the sample seed made
 * this deal the largest — a comment in lib/sample-data.ts still says so. Today
 * now ranks by what is overdue, which puts a different deal first, so the
 * tour sent the visitor into one deal and then narrated another one's
 * proposal opens, stakeholder and security-page view. Every step after the
 * first was about a deal they were not looking at.
 *
 * Anchoring on the account by name cannot drift with the ranking.
 */
export const TOUR_ACCOUNT = "Cloudmint";

/** `data-tour` value the card for TOUR_ACCOUNT carries. */
export const TOUR_CARD_ANCHOR = "tour-deal";

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
    target: TOUR_CARD_ANCHOR,
    phase: "Detect",
    title: "Deals that are waiting on you",
    body: `Each card states the reason, the records behind it and how old they are. The order comes from how overdue each one is — not from a win rate Selryn guessed. We will follow ${TOUR_ACCOUNT}, where a proposal went out and nothing came back.`,
    instruction: `Open the ${TOUR_ACCOUNT} card.`,
    advance: "click",
    placement: "bottom",
  },
  {
    id: "signals",
    route: "/opportunities/",
    target: "signal-timeline",
    phase: "Detect",
    title: "See what changed",
    body: "The demo, the proposal, the two opens, the VP Finance joining the evaluation, the security page view — and then nothing. Every row here is a record with a date on it; Selryn reads them together rather than one at a time.",
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
    body: "Customer fit, engagement and buying signals each contribute points, and every line says which rule fired, including the ones that found nothing. The silence after a proposal that was opened twice is why this deal is on today's list.",
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
    instruction: "Click “Draft follow-up”.",
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
    title: "See what moved, and what did not",
    body: "The reply re-scored the deal: the risk cleared, and the estimated likelihood rose with it. Move the stage forward and the figures move again — because the evidence changed, not because a demo said so. The deal has advanced one stage. It has not been won, and no revenue has been booked.",
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
