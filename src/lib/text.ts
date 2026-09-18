/**
 * Bidirectional control characters let text reorder what is printed around it, so a widget
 * title can make the rest of a line read backwards or hide what it really says. Configuration
 * text is written by people and pasted from anywhere, so the controls are stripped before it
 * reaches the page, and what is left is isolated in a bdi element so it cannot reorder its
 * neighbours either.
 */
const BIDI_CONTROLS = /[؜‎‏‪-‮⁦-⁩]/g

export function stripBidiControls(text: string): string {
  return text.replace(BIDI_CONTROLS, '')
}
