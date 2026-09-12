export type WalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};
export type Wallet = { id: string; name: string; provider: WalletProvider };
export function discoverWallets(onWallet: (wallet: Wallet) => void) {
  const announce = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (typeof detail?.info?.uuid === "string" && typeof detail?.info?.name === "string" && typeof detail?.provider?.request === "function") {
      onWallet({ id: detail.info.uuid, name: detail.info.name, provider: detail.provider });
    }
  };
  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  const timer = setTimeout(() => {
    const provider = (window as Window & { ethereum?: WalletProvider }).ethereum;
    if (provider?.request) onWallet({ id: "injected", name: "Browser wallet", provider });
  }, 500);
  return () => { clearTimeout(timer); window.removeEventListener("eip6963:announceProvider", announce); };
}
export function walletAddress(accounts: unknown): string | null {
  return Array.isArray(accounts) && typeof accounts[0] === "string" && /^0x[0-9a-fA-F]{40}$/.test(accounts[0]) ? accounts[0].toLowerCase() : null;
}
