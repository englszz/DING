// A slow primary should not make every user wait through its retries.
const runtime = globalThis as typeof globalThis & {
  dingCatalogCircuit?: { retryAt: number };
};
const state = (runtime.dingCatalogCircuit ??= { retryAt: 0 });
export async function withMusicFallback<T>(
  primary: () => Promise<T>,
  backup: () => Promise<T>,
  waitMs = 2500,
): Promise<T> {
  if (Date.now() < state.retryAt) {
    try {
      return await backup();
    } catch {
      return primary();
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = primary();
  try {
    const result = await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Primary deadline")), waitMs);
      }),
    ]);
    state.retryAt = 0;
    return result;
  } catch {
    state.retryAt = Date.now() + 60000;
    // Observe completion even if the backup responds first; a successful primary
    // warms its cache and proves it is healthy again.
    void work.then(
      () => {
        state.retryAt = 0;
      },
      () => {},
    );
    try {
      return await backup();
    } catch (error) {
      let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            recoveryTimer = setTimeout(() => reject(error), 3000);
          }),
        ]);
      } finally {
        clearTimeout(recoveryTimer);
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
