/**
 * The places a book can be sent: the fifty states and the District of Columbia.
 *
 * Territories and military post codes are left out on purpose. The printer's
 * delivery options and prices for them are not ones this checkout can promise.
 */
const STATES: readonly (readonly [code: string, name: string])[] = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

export const US_STATE_CODES: ReadonlySet<string> = new Set(
  STATES.map(([code]) => code),
);

/** Lower case, letters only, so "Washington, D.C." and "new  york" both match. */
const key = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, "");

const CODE_BY_NAME: ReadonlyMap<string, string> = new Map([
  ...STATES.map(([code, name]) => [key(name), code] as const),
  ["washingtondc", "DC"],
]);

/**
 * The two-letter code for what was typed or autofilled into the state field,
 * or null when it is not a state we deliver to.
 *
 * Browsers autofill this field with whatever the saved address holds, and for
 * many people that is the full name. Cutting the input to two characters
 * turned "Arizona" into "AR", which is Arkansas: a valid code for the wrong
 * state, and a book sent to it.
 */
export function stateCode(input: string): string | null {
  const typed = input.trim();
  if (!typed) return null;

  const upper = typed.toUpperCase();
  if (US_STATE_CODES.has(upper)) return upper;

  // "D.C." and the like: a code written with punctuation.
  const letters = upper.replace(/[^A-Z]/g, "");
  if (letters.length === 2 && US_STATE_CODES.has(letters)) return letters;

  return CODE_BY_NAME.get(key(typed)) ?? null;
}
