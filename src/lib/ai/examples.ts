/**
 * Every whole line the prompts quote as an example — good or bad.
 *
 * One list, used twice. The prompts are built from these constants, and the
 * check that runs on what comes back (`lib/story/guard`) refuses anything that
 * matches one. A model shown a line tends to hand it back: a book made from
 * pictures of coloured circles came back with one caption from the
 * instructions printed four times, and a chapter about a collar and a ball
 * nobody had photographed. So a line may only be quoted in a prompt by being
 * added here first, which is what makes it impossible to print.
 *
 * Whole lines only. A two-word fragment quoted to make a point about wording
 * ("the striped blanket") does not belong here — it would match half of what
 * a real book legitimately says.
 */

/** Chapter titles held up as the register. */
export const EXAMPLE_TITLES = {
  bigHouse: "Small Dog, Big House",
  tooHot: "Too Hot To Bother",
} as const;

/** Introductions held up as the voice wanted. */
export const EXAMPLE_GOOD_OPENINGS = {
  bigHouse:
    "Everything was new and most of it was too tall. Juniper met each room at floor level and had the run of the place by the end of the first month.",
  tooHot:
    "August in Farmington was the kind of heat nobody argues with. Rocket found the coolest room in the house early on and made the rest of the summer somebody else's problem.",
} as const;

/** Introductions quoted as failures. Real ones, most of them printed. */
export const EXAMPLE_BAD_OPENINGS = {
  label:
    "Rocket claimed the middle of the bed against the green wall, waiting out the afternoon heat. His white paws rested flat on the plaid blanket while he watched the window.",
  labelShort:
    "Juniper settled into the corner of the grey sofa, her head turned towards the door.",
  aboutPictures:
    "These photographs trace Rocket's early days, capturing quiet moments of rest in his bed and at home. The camera also follows him outdoors…",
  inventory:
    "Every bare floor called for a full-body sploot, paws kicked wide or chin hooked over a favorite green toy. Bedtime meant tucking under a striped fleece blanket beside his plush sidekick, resting up for sunny afternoons in the park in his red harness.",
  sweep:
    "Everything demanded immediate investigation. Jordi greeted each giant new landmark with a happy grin, anchoring a bright red collar against every strange background until finally settling down on a bright beach towel.",
  fancyCalm:
    "Spring brought quieter afternoons spent sinking deep into the striped fleece blanket. Rocket rested his chin near the green toy, finally letting the long day slow down.",
  fancyDemanded:
    "Spring demanded nothing more than the striped blanket draped over the sofa. Rocket burrowed beneath its folds, sleeping off the afternoon until the warmth finally coaxed him back upright.",
  wrongPhoto:
    "Winter kept the striped pillow pulled close on the sofa. Rocket spent the coldest weeks curled into the wool folds, watching the snow pile up outside.",
  laterPhoto:
    "Everything was larger than him by half. Rocket tested the new tile floors flat on his belly before claiming the blue bed under a pile of bright blankets.",
} as const;

/** Page captions quoted anywhere in the rules, as the register or as a failure. */
export const EXAMPLE_CAPTIONS = {
  lakeFlat: "Back at the lake by June",
  lakeTold: "The lake, again, obviously",
  guessedYard: "Out into the sunny green yard",
  warmWeek: "The first warm week of June",
  fireplace: "Right by the fireplace",
  brickFireplace: "Right by the brick fireplace",
  lens: "Right up close to the lens",
  noseFirst: "Nose first, as usual",
  inventory: "brown dog on grass, facing left",
} as const;

export const PROMPT_EXAMPLE_TITLES: readonly string[] = Object.values(EXAMPLE_TITLES);
export const PROMPT_EXAMPLE_OPENINGS: readonly string[] = [
  ...Object.values(EXAMPLE_GOOD_OPENINGS),
  ...Object.values(EXAMPLE_BAD_OPENINGS),
];
export const PROMPT_EXAMPLE_CAPTIONS: readonly string[] = Object.values(EXAMPLE_CAPTIONS);

/** Everything above in one list: the single source the post-check reads. */
export const PROMPT_EXAMPLE_LINES: readonly string[] = [
  ...PROMPT_EXAMPLE_TITLES,
  ...PROMPT_EXAMPLE_OPENINGS,
  ...PROMPT_EXAMPLE_CAPTIONS,
];
