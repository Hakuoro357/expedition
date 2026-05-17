export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
  ]);
}
