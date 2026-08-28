import { DEMO_CONTACT, formatUsd, INITIAL_EXPECTED } from "@/lib/demo/fixture";

/**
 * The nine steps, as data.
 *
 * `requiredAction` is what separates this from a slideshow. A step with
 * `"click"` has no Continue button at all — the only way forward is to
 * perform the real interaction on the highlighted control, and the store
 * refuses to advance until the corresponding flag flips. That is enforced in
 * the reducer rather than by hiding a button, so it cannot be clicked past.
 *
 * `target` is a data-demo-target attribute value. Keeping targets as strings
 * here means a step can point at anything on any of the four routes without
 * this module importing a single component.
 */

export type DemoPlacement = "top" | "right" | "bottom" | "left" | "center";

export interface GuidedDemoStep {
  id: string;
  /** Where this step happens. The store redirects if the visitor is elsewhere. */
  route: string;
  /** data-demo-target of the element to spotlight. */
  target: string;
  eyebrow: string;
  title: string;
  description: string;
  /** The imperative — exactly what to do next. */
  instruction: string;
  placement: DemoPlacement;
  /**
   * "click" means the visitor must really do it; the coachmark shows no
   * Continue. "none" is for steps that only need reading.
   */
  requiredAction: "click" | "none";
  /** The state flag that proves the action happened. */
  completedWhen?: DemoFlag;
  /** Where the demo goes once this step is done. */
  nextRoute?: string;
}

/** The booleans the reducer flips as the visitor works. */
export type DemoFlag =
  | "opportunityOpened"
  | "signalsExpanded"
  | "analysisCompleted"
  | "recommendationGenerated"
  | "draftOpened"
  | "actionApproved"
  | "buyerResponseReceived"
  | "opportunityUpdated"
  | "demoCompleted";

export const DEMO_ROUTES = {
  intro: "/demo",
  workspace: "/demo/workspace",
  opportunity: "/demo/opportunities/cloudmint",
  analytics: "/demo/analytics",
} as const;

export const GUIDED_DEMO_STEPS: GuidedDemoStep[] = [
  {
    id: "open-opportunity",
    route: DEMO_ROUTES.workspace,
    target: "pipeline-cloudmint",
    eyebrow: "Detect",
    title: "Start with the opportunity most likely to move revenue",
    description:
      "Selryn ranks every open opportunity by expected revenue, urgency and recent buying signals.",
    instruction: "Click Cloudmint to open the opportunity.",
    // The pipeline row is full-width, so there is no column beside it.
    placement: "bottom",
    requiredAction: "click",
    completedWhen: "opportunityOpened",
    nextRoute: DEMO_ROUTES.opportunity,
  },
  {
    id: "view-signals",
    route: DEMO_ROUTES.opportunity,
    target: "view-signals",
    eyebrow: "Detect",
    title: "See every signal in one timeline",
    description:
      "Selryn combines proposal activity, stakeholder engagement, website intent and CRM history into one evidence trail.",
    instruction: "Click “View signals”.",
    placement: "bottom",
    requiredAction: "click",
    completedWhen: "signalsExpanded",
  },
  {
    id: "analyze",
    route: DEMO_ROUTES.opportunity,
    target: "analyze",
    eyebrow: "Decide",
    title: "Separate urgency from noise",
    description: `The deal has positive intent, but four days of silence after the demo puts ${formatUsd(
      INITIAL_EXPECTED
    )} of expected revenue at risk.`,
    instruction: "Review the evidence, then click “Analyze opportunity”.",
    placement: "bottom",
    requiredAction: "click",
    completedWhen: "analysisCompleted",
  },
  {
    id: "recommend",
    route: DEMO_ROUTES.opportunity,
    target: "recommend",
    eyebrow: "Decide",
    title: "Turn the evidence into one clear action",
    description:
      "Selryn recommends one action based on the opportunity stage, stakeholder activity and recent silence.",
    instruction: "Click “Generate next best action”.",
    placement: "bottom",
    requiredAction: "click",
    completedWhen: "recommendationGenerated",
  },
  {
    id: "review-draft",
    route: DEMO_ROUTES.opportunity,
    target: "review-draft",
    eyebrow: "Act",
    title: "Review before anything is sent",
    description:
      "Selryn drafts the action, but your team keeps the final decision.",
    instruction: "Click “Review draft”.",
    placement: "top",
    requiredAction: "click",
    completedWhen: "draftOpened",
  },
  {
    id: "approve",
    route: DEMO_ROUTES.opportunity,
    target: "approve-send",
    eyebrow: "Act",
    title: "Approve the next best action",
    description:
      "The action, reasoning and final human decision are recorded together for future learning.",
    instruction: "Click “Approve and send”.",
    placement: "top",
    requiredAction: "click",
    completedWhen: "actionApproved",
  },
  {
    id: "response",
    route: DEMO_ROUTES.opportunity,
    target: "view-response",
    eyebrow: "Learn",
    title: "Connect the action to the buyer’s response",
    description:
      "Selryn tracks what happened after the action instead of stopping at email generation.",
    instruction: "Click “View response”.",
    placement: "top",
    requiredAction: "click",
    completedWhen: "buyerResponseReceived",
  },
  {
    id: "update",
    route: DEMO_ROUTES.opportunity,
    target: "update-opportunity",
    eyebrow: "Learn",
    title: "Watch the opportunity move forward",
    description:
      "The response updates the CRM stage, win probability and expected revenue.",
    instruction: "Click “Update opportunity”.",
    placement: "top",
    requiredAction: "click",
    completedWhen: "opportunityUpdated",
    nextRoute: DEMO_ROUTES.analytics,
  },
  {
    id: "loop",
    route: DEMO_ROUTES.analytics,
    target: "complete-demo",
    eyebrow: "Learn",
    title: "Close the signal–action–outcome loop",
    description: `Selryn records which signals led to which recommendation, what the team executed, how ${DEMO_CONTACT.name.split(" ")[0]} responded, and how the opportunity changed.`,
    instruction: "Click “Complete demo”.",
    placement: "top",
    requiredAction: "click",
    completedWhen: "demoCompleted",
  },
];

export const TOTAL_STEPS = GUIDED_DEMO_STEPS.length;

export function stepIndexById(id: string): number {
  return GUIDED_DEMO_STEPS.findIndex((s) => s.id === id);
}

/** The first step that belongs to a route — where a direct visit should land. */
export function firstStepOnRoute(route: string): number {
  const i = GUIDED_DEMO_STEPS.findIndex((s) => s.route === route);
  return i === -1 ? 0 : i;
}
