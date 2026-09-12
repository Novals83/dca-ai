import { it, expect, vi } from "vitest";
import { localStrategyStorage } from "../lib/storage/strategies";
import { defaultStrategy } from "../lib/dca/simulator";
it("scopes strategies by address and persists deletion", async () => {
  const items = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
  });
  try {
    await localStrategyStorage.save("0xABC", defaultStrategy);
    expect(await localStrategyStorage.load("0xabc")).toEqual(defaultStrategy);
    expect(await localStrategyStorage.load("0xdef")).toBeNull();
    expect(await localStrategyStorage.load("demo")).not.toBeNull();
    await localStrategyStorage.remove("demo");
    expect(await localStrategyStorage.load("demo")).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
