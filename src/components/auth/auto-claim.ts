/**
 * Whether a book should be saved to the signed-in account without being asked.
 *
 * Pure, so every way this has gone wrong can be written down as a test:
 * a book finished while already signed in that was only saved after a reload,
 * a second book under the same address that was never saved at all, and a
 * book made under one address saved into the library of whoever happened to
 * be signed in.
 */

export type AutoClaimInput = {
  /** The address of the signed-in account, or null when nobody is signed in. */
  sessionEmail: string | null | undefined;
  /** The address the book was made under, or null for one made with none. */
  leadEmail: string | null | undefined;
  funnelState: string;
  pageCount: number;
  /** The local draft's id, which is also the book's id in the library. */
  draftId: string | null | undefined;
  claimedAt: string | null | undefined;
  /** Draft ids a save has already been tried for and should not be again. */
  attemptedFor: readonly string[];
};

function normalized(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

/** The same person, whatever capitals or stray spaces either was typed with. */
export function sameAddress(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalized(a);
  return left !== "" && left === normalized(b);
}

export function shouldAutoClaim(input: AutoClaimInput): boolean {
  // Nobody to save it for.
  if (!normalized(input.sessionEmail)) return false;

  // Only a finished book. One still being read or written has pages that are
  // about to change, and saving it now would save half of it.
  if (input.funnelState !== "editing" || input.pageCount <= 0) return false;

  if (input.claimedAt) return false;

  // The id is what the save is recorded against. Before the first local save
  // there is not one, and the caller is told again when there is.
  if (!input.draftId) return false;

  // Once per book. Keyed on the book rather than the address, so a second
  // book made after starting over is saved too.
  if (input.attemptedFor.includes(input.draftId)) return false;

  // A book made with no address belongs to whoever is at this browser. One
  // made under an address belongs to that address, and is only filed into an
  // account without asking when the account is the same person's.
  if (normalized(input.leadEmail) && !sameAddress(input.sessionEmail, input.leadEmail)) {
    return false;
  }

  return true;
}
