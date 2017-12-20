// @flow

const trueRE = /^(1|true)$/
const falseRE = /^(0|false)$/

export function parseBool(input: string, defaultBool: boolean): boolean {
  return trueRE.test(input) ? true : falseRE.test(input) ? false : defaultBool
}

export function getElapsed(started: number): string {
  const elapsed = Date.now() - started
  if (elapsed < 1000) return elapsed + 'ms'
  return (elapsed / 1000).toFixed(3) + 's'
}

export function clearTerminal(): void {

  // Print empty lines until the screen is blank.
  process.stdout.write('\x1B[2J')

  // Clear the scrollback.
  process.stdout.write('\u001b[H\u001b[2J\u001b[3J')
}
