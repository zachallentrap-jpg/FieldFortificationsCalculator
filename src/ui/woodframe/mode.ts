// Which of the two wood-frame apps this page is.
//
// The tool branched in two because it was being asked to do two jobs badly at once:
//
//   PLANNING is for a 1371 who is going to build the thing. Choose the structure, the
//   foundation, the materials, the openings — down to the hardware and the count — look at it
//   from every side, then hand the command one clean sheet they can sign or send.
//
//   LEARNING is a teaching aid. The same engine, the same model, the same "tap a piece and find
//   out what it is", plus cards to drill with. It deliberately does NOT show man-hours, supply
//   quantities, or a command packet: those are the outputs of a real plan, and a classroom
//   model that prints them invites someone to hand a lesson to their CO.
//
// ONE code base, two pages. The alternative — forking the studio — would have meant two copies
// of the workbench drifting apart, and the half that got less attention would rot. Everything
// mode-specific goes through the predicates below, so the difference between the apps is a list
// you can read in one file rather than a diff nobody re-reads.

export type AppMode = 'plan' | 'learn';

/** Read once at boot from `<body data-app>`; the page's identity does not change under it. */
export const MODE: AppMode = document.body.dataset.app === 'learn' ? 'learn' : 'plan';

export const isPlanning = MODE === 'plan';
export const isLearning = MODE === 'learn';

/** What each app is called where a user can see it. */
export const APP_NAME: Record<AppMode, string> = {
  plan: 'Wood-Frame Planning',
  learn: 'Wood-Frame Learning',
};

/**
 * Feature switches, named for what they ARE rather than which app has them, so a new mode (or a
 * setting) can answer them without every call site learning about it.
 */
export const FEATURES = {
  /** Labor projections, supply quantities, the command sheet — planning outputs. */
  commandOutputs: isPlanning,
  /** Hardware take-off: nails and pins by count and weight. */
  hardwareTakeoff: isPlanning,
  /** Flashcard drill over the engine's own members and doctrine. */
  flashcards: isLearning,
  /** Teaching copy on the stage panel: why this stage, what to watch. */
  stageTeaching: true,
};
