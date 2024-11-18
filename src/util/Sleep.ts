export async function sleep (ms: number): Promise<void> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}