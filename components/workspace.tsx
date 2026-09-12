"use client";
import {
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
  useRef,
} from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  Download,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Avatar } from "./copilot/avatar";
import { CopilotPanel } from "./copilot/panel";
import {
  defaultStrategy,
  strategySchema,
  simulateDCA,
  scenarios,
  annualContribution,
  calculateAllocation,
  type Strategy,
} from "@/lib/dca/simulator";
import { demoPortfolio, demoMarket, demoStrategy } from "@/lib/demo";
import type { Portfolio, Market } from "@/lib/hyperliquid/types";
import { money, compactMoney, percent } from "@/lib/format";
import { localStrategyStorage } from "@/lib/storage/strategies";

const subscribeWidth = (callback: () => void) => {
  const media = window.matchMedia("(min-width:1101px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const desktopSnapshot = () => window.matchMedia("(min-width:1101px)").matches;
export function Workspace({
  initialConnect = false,
}: {
  initialConnect?: boolean;
}) {
  const [account, setAccount] = useState("demo");
  const [portfolio, setPortfolio] = useState<Portfolio>(demoPortfolio);
  const [market, setMarket] = useState<Market>(demoMarket);
  const [strategy, setStrategy] = useState<Strategy>(demoStrategy);
  const [saved, setSaved] = useState<Strategy | null>(demoStrategy);
  const [preview, setPreview] = useState<Strategy | null>(null);
  const [connect, setConnect] = useState(initialConnect);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [marketError, setMarketError] = useState("");
  const [scenario, setScenario] = useState(1);
  const [copilotOpen, setCopilotOpen] = useState<boolean | null>(null);
  const accountRequest = useRef(0);
  const [insight, setInsight] = useState("");
  const [aiConfigured, setAiConfigured] = useState(false);
  const desktop = useSyncExternalStore(
    subscribeWidth,
    desktopSnapshot,
    () => true,
  );
  const copilotVisible = copilotOpen ?? desktop;
  useEffect(() => {
    void fetch("/api/status")
      .then((r) => r.json())
      .then((r) => setAiConfigured(r.aiConfigured))
      .catch(() => {});
    void localStrategyStorage
      .load("demo")
      .then((s) => {
        setSaved(s);
        if (s) setStrategy(s);
      })
      .catch(() =>
        setNotice(
          "Browser storage unavailable or invalid. Saving may be restricted.",
        ),
      );
  }, []);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refreshPrices() {
      try {
        const response = await fetch("/api/hyperliquid/market", {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(18000)]),
        });
        if (!response.ok) throw new Error("Market unavailable");
        const next: Market = await response.json();
        if (!disposed) {
          setMarket(next);
          setMarketError("");
        }
      } catch {
        if (!disposed) setMarketError("Live prices unavailable. Displayed prices are not current; retrying automatically.");
      } finally {
        if (!disposed) timer = setTimeout(refreshPrices, 15000);
      }
    }
    void refreshPrices();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, []);
  const resultSchema = strategySchema.safeParse(strategy);
  const result = resultSchema.success
    ? simulateDCA({
        ...strategy,
        btcPrice: market.BTC,
        hypePrice: market.HYPE,
        ...scenarios[scenario],
      })
    : null;
  const constant = resultSchema.success
    ? simulateDCA({ ...strategy, btcPrice: market.BTC, hypePrice: market.HYPE })
    : null;
  const chart =
    result?.curve.map((p, i) => ({
      month: p.month,
      contributed: p.contributed,
      ...Object.fromEntries(
        scenarios.map((s) => [
          s.name,
          simulateDCA({
            ...strategy,
            btcPrice: market.BTC,
            hypePrice: market.HYPE,
            ...s,
          }).curve[i].value,
        ]),
      ),
    })) ?? [];
  const previewResult = preview
    ? simulateDCA({ ...preview, btcPrice: market.BTC, hypePrice: market.HYPE })
    : null;
  const split = resultSchema.success
    ? calculateAllocation(strategy.contributionAmount, strategy.btcAllocation)
    : null;
  const patch = (p: Partial<Strategy>) => setStrategy((s) => ({ ...s, ...p }));
  async function loadAccount(target: string) {
    const requestId = ++accountRequest.current;
    setInsight("");
    setLoading(true);
    setError("");
    try {
      if (!/^0x[0-9a-fA-F]{40}$/.test(target))
        throw new Error(
          "Enter a valid 0x address with 40 hexadecimal characters.",
        );
      const [pr, mr] = await Promise.all([
        fetch("/api/hyperliquid/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: target }),
          signal: AbortSignal.timeout(30000),
        }),
        fetch("/api/hyperliquid/market", {
          signal: AbortSignal.timeout(18000),
        }),
      ]);
      const p = await pr.json();
      const m = await mr.json();
      if (!pr.ok || !mr.ok)
        throw new Error(
          p.error || m.error || "Hyperliquid unavailable. Please retry.",
        );
      let stored: Strategy | null = null;
      try {
        stored = await localStrategyStorage.load(target);
      } catch {
        setNotice("Saved strategy unavailable. Portfolio data loaded.");
      }
      if (requestId !== accountRequest.current) return;
      setPortfolio(p);
      setMarket(m);
      setAccount(target.toLowerCase());
      setSaved(stored);
      setPreview(null);
      setConnect(false);
      setStrategy(stored ?? defaultStrategy);
      if (aiConfigured)
        void fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account: target,
            strategy: stored ?? defaultStrategy,
            message:
              "Analyze my portfolio. Give one concise insight grounded in the current data; do not create a strategy.",
          }),
          signal: AbortSignal.timeout(140000),
        })
          .then(async (response) => {
            if (!response.ok) return;
            const insightResult = await response.json();
            if (
              requestId === accountRequest.current &&
              insightResult.provider === "openai"
            )
              setInsight(insightResult.text);
          })
          .catch(() => {});
    } catch (e) {
      if (requestId === accountRequest.current)
        setError(e instanceof Error ? e.message : "Could not load portfolio.");
    } finally {
      if (requestId === accountRequest.current) setLoading(false);
    }
  }
  async function useDemo() {
    accountRequest.current++;
    setLoading(false);
    setInsight("");
    setAccount("demo");
    setPortfolio(demoPortfolio);
    setStrategy(demoStrategy);
    setPreview(null);
    setSaved(demoStrategy);
    setError("");
    setConnect(false);
    try {
      const stored = await localStrategyStorage.load("demo");
      setSaved(stored);
      setStrategy(stored ?? demoStrategy);
    } catch {
      setNotice("Using demo strategy; browser storage is unavailable.");
    }
  }
  async function save() {
    if (!preview) return;
    try {
      await localStrategyStorage.save(account, preview);
      setSaved(preview);
      setStrategy(preview);
      setPreview(null);
      setNotice(
        "Strategy saved on this device. Simulation only — no trades scheduled.",
      );
    } catch {
      setNotice("Unable to save. Please allow browser storage and try again.");
    }
  }
  const onPreview = useCallback((s: Strategy) => {
    setPreview(s);
  }, []);
  function exportStrategy() {
    if (!saved) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { version: 1, mode: "simulation", strategy: saved },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "dca-ai-strategy.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function remove() {
    try {
      await localStrategyStorage.remove(account);
      setSaved(null);
      setNotice("Saved strategy removed from this device.");
    } catch {
      setNotice("Could not access browser storage.");
    }
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="logo">
          <span className="logo-symbol">∿</span>DCA<span>AI</span>
        </Link>
        <span className="header-divider" />
        <span className="header-subtitle">HYPERLIQUID COPILOT</span>
        <div className="top-actions">
          <a
            className="account-button exchange-link"
            href="https://app.hyperliquid.xyz/trade"
            target="_blank"
            rel="noopener noreferrer"
            title="Open Hyperliquid. For Split view: right-click → Open link in split view"
          >
            Hyperliquid <ArrowUpRight size={15} />
          </a>
          <button className="account-button" onClick={() => setConnect(true)}>
            <Wallet size={15} />
            {account === "demo"
              ? "Demo portfolio"
              : `${account.slice(0, 6)}…${account.slice(-4)}`}
            <span className="badge">
              {account === "demo" ? "DEMO" : "READ ONLY"}
            </span>
          </button>
        </div>
      </header>
      <details className="split-view-help">
        <summary>Open Hyperliquid alongside DCA AI</summary>
        <p>
          In Chrome, right-click the Hyperliquid link above and select
          “Open link in split view”. If the exchange is already open, combine
          the existing tabs using the tab menu. A normal click opens a new tab.
        </p>
        <p>
          Keep this pair open. To restore your tabs after restarting Chrome:
          Settings → On startup → Continue where you left off.
          Start your microphone separately with Start voice.
        </p>
      </details>
      <div className="workspace-layout">
        <nav className="rail" aria-label="Sections">
          <a
            href="#overview"
            className="rail-active"
            aria-label="Portfolio overview"
          >
            <Layers size={22} />
          </a>
          <a href="#builder" aria-label="Strategy builder">
            <ChartNoAxesCombined size={22} />
          </a>
          <button
            onClick={() => setCopilotOpen(!copilotVisible)}
            aria-label="Toggle Copilot"
          >
            <Sparkles size={22} />
          </button>
          <span className="rail-bottom">
            <ShieldCheck size={21} />
          </span>
        </nav>
        <main className="dashboard">
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR CAPITAL. YOUR DIRECTION.</span>
              <h1>
                Portfolio overview<span>.</span>
              </h1>
            </div>
            <div className="data-status">
              <span className={account === "demo" ? "dot muted-dot" : "dot"} />
              {account === "demo"
                ? "DEMO DATA"
                : `SNAPSHOT · ${new Date(portfolio.asOf).toLocaleTimeString()}`}
              {account !== "demo" && (
                <button
                  aria-label="Refresh portfolio"
                  className="icon-button"
                  disabled={loading}
                  onClick={() => loadAccount(account)}
                >
                  <RefreshCw size={15} className={loading ? "spin" : ""} />
                </button>
              )}
            </div>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}
          {error && !connect && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="positions-note" role="status">
            {market.source === "live"
              ? `${marketError ? "LAST PRICES" : "LIVE PRICES"} · Hyperliquid · ${new Date(market.asOf).toLocaleTimeString()} · updates every 15s`
              : "Loading live prices · reference fixtures shown until connected"}
            {account === "demo" && " · Portfolio balances are demo"}
            {marketError && <p className="error">{marketError}</p>}
          </div>
          <section id="overview" className="portfolio-grid">
            <div className="portfolio-hero card">
              <div className="section-label">
                TOTAL PORTFOLIO <Wallet size={16} />
              </div>
              <div className="portfolio-number">
                {money(portfolio.accountValue).split(".")[0]}
                <span>.{money(portfolio.accountValue).split(".")[1]}</span>
              </div>
              <div className="portfolio-caption">
                {portfolio.pnlDay !== undefined ? (
                  <>
                    <span className="positive">
                      ↗ {money(portfolio.pnlDay)}
                    </span>
                    <span className="muted">24h · demo</span>
                  </>
                ) : (
                  <span className="muted">Standard account equity · USD</span>
                )}
              </div>
              <div className="allocation-strip">
                <span style={{ flex: Math.abs(portfolio.btcExposure) }} />
                <span style={{ flex: Math.abs(portfolio.hypeExposure) }} />
                <span style={{ flex: portfolio.usdcBalance }} />
              </div>
              <div className="legend">
                <span>
                  <i />
                  BTC
                </span>
                <span>
                  <i />
                  HYPE
                </span>
                <span>
                  <i />
                  USDC spot
                </span>
              </div>
            </div>
            <div className="asset-stack">
              {[
                {
                  coin: "BTC",
                  name: "Bitcoin",
                  value: portfolio.btcExposure,
                  price: market.BTC,
                  symbol: "₿",
                },
                {
                  coin: "HYPE",
                  name: "Hyperliquid",
                  value: portfolio.hypeExposure,
                  price: market.HYPE,
                  symbol: "∿",
                },
                {
                  coin: "USDC",
                  name: "Spot balance",
                  value: portfolio.usdcBalance,
                  price: 1,
                  symbol: "$",
                },
              ].map((a, i) => (
                <div className={`asset-card card asset-${i}`} key={a.coin}>
                  <div className="asset-icon">{a.symbol}</div>
                  <div>
                    <strong>{a.coin}</strong>
                    <small>
                      {a.name} · {money(a.price)}{a.coin === "USDC" ? " peg reference" : ""}
                    </small>
                  </div>
                  <div className="asset-value">
                    <strong>{compactMoney(a.value)}</strong>
                    <small>
                      {portfolio.accountValue > 0
                        ? percent((a.value / portfolio.accountValue) * 100)
                        : "—"}{" "}
                      of equity
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="strategy-status card">
            <span className="mini-icon">
              <Activity size={19} />
            </span>
            <div>
              <span className="eyebrow">
                {saved ? "SAVED DCA STRATEGY" : "YOUR NEXT STEP"}
              </span>
              <p>
                {saved ? (
                  <>
                    <strong>{money(saved.contributionAmount)}</strong> /{" "}
                    {saved.contributionFrequency
                      .replace("daily", "day")
                      .replace("weekly", "week")
                      .replace("monthly", "month")}{" "}
                    <span className="status-split">
                      BTC {saved.btcAllocation}% <i /> HYPE{" "}
                      {saved.hypeAllocation}%
                    </span>
                  </>
                ) : (
                  "No active DCA strategy"
                )}
              </p>
            </div>
            <div className="target">
              <span className="eyebrow">MODELED LEVERAGE</span>
              <strong>
                {saved ? `${saved.leverage.toFixed(2)}x` : "1.00x"}
              </strong>
            </div>
            <span className="badge">SIMULATION</span>
            {saved ? (
              <div className="inline">
                <button
                  className="icon-button"
                  onClick={exportStrategy}
                  aria-label="Export strategy"
                >
                  <Download size={16} />
                </button>
                <button
                  className="icon-button"
                  onClick={remove}
                  aria-label="Delete saved strategy"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <a href="#builder" className="text-link">
                Create strategy <ArrowRight size={14} />
              </a>
            )}
          </div>
          {insight && (
            <div className="portfolio-insight card">
              <span className="eyebrow">PORTFOLIO INSIGHT · AI</span>
              <p>{insight}</p>
              <button
                className="text-link"
                onClick={() => setCopilotOpen(true)}
              >
                Ask DCA AI <ArrowRight size={14} />
              </button>
            </div>
          )}
          <section id="builder" className="builder-section">
            <div className="section-heading">
              <h2>Design your DCA</h2>
              <span className="muted">Small steps. Long-term thinking.</span>
            </div>
            <div className="builder-grid">
              <div className="builder card">
                <div className="section-label">
                  STRATEGY BUILDER <Layers size={16} />
                </div>
                <label className="field-label">Contribution frequency</label>
                <div className="segmented">
                  {(["daily", "weekly", "monthly"] as const).map((f) => (
                    <button
                      key={f}
                      className={
                        strategy.contributionFrequency === f ? "selected" : ""
                      }
                      onClick={() => patch({ contributionFrequency: f })}
                    >
                      {f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <label className="field-label" htmlFor="amount">
                  Contribution amount
                </label>
                <div className="amount-input">
                  <span>$</span>
                  <input
                    id="amount"
                    type="number"
                    min="0.01"
                    max="10000000"
                    step="0.01"
                    value={strategy.contributionAmount || ""}
                    onChange={(e) =>
                      patch({ contributionAmount: Number(e.target.value) })
                    }
                  />
                  <span>
                    /
                    {strategy.contributionFrequency === "daily"
                      ? "day"
                      : strategy.contributionFrequency === "weekly"
                        ? "week"
                        : "month"}
                  </span>
                </div>
                <div className="amount-presets">
                  {[10, 25, 50, 100].map((a) => (
                    <button
                      key={a}
                      className={
                        a === strategy.contributionAmount ? "selected" : ""
                      }
                      onClick={() => patch({ contributionAmount: a })}
                    >
                      ${a}
                    </button>
                  ))}
                </div>
                <div className="field-label allocation-label">
                  <span>Asset allocation</span>
                  <span>100% allocated</span>
                </div>
                <div className="allocation-numbers">
                  <span>
                    BTC <b>{strategy.btcAllocation}%</b>
                  </span>
                  <span>
                    HYPE <b>{strategy.hypeAllocation}%</b>
                  </span>
                </div>
                <input
                  aria-label="BTC allocation"
                  className="allocation-slider"
                  type="range"
                  min="0"
                  max="100"
                  value={strategy.btcAllocation}
                  onChange={(e) =>
                    patch({
                      btcAllocation: Number(e.target.value),
                      hypeAllocation: 100 - Number(e.target.value),
                    })
                  }
                />
                <div className="allocation-amounts">
                  <span>{split ? money(split.btc) : "—"}</span>
                  <span>{split ? money(split.hype) : "—"}</span>
                </div>
                <div className="fields-row">
                  <div>
                    <label htmlFor="period" className="field-label">
                      Time horizon
                    </label>
                    <select
                      id="period"
                      value={strategy.durationMonths}
                      onChange={(e) =>
                        patch({ durationMonths: Number(e.target.value) })
                      }
                    >
                      {[1, 3, 6, 12, 24].map((m) => (
                        <option key={m} value={m}>
                          {m} month{m > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="leverage" className="field-label">
                      Leverage · simulation
                    </label>
                    <select
                      id="leverage"
                      value={strategy.leverage}
                      onChange={(e) =>
                        patch({ leverage: Number(e.target.value) })
                      }
                    >
                      {[1, 1.05, 1.08, 1.1, 1.15, 1.2].map((l) => (
                        <option key={l} value={l}>
                          {l.toFixed(2)}x
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <label htmlFor="capital" className="field-label">
                  Initial capital <span className="muted">(optional)</span>
                </label>
                <input
                  id="capital"
                  className="capital-input"
                  type="number"
                  min="0"
                  max="1000000000"
                  value={strategy.capital}
                  onChange={(e) => patch({ capital: Number(e.target.value) })}
                />
                {strategy.leverage > 1 && (
                  <p className="warning">
                    Leverage amplifies losses and liquidation risk.
                  </p>
                )}
                {!resultSchema.success && (
                  <p role="alert" className="error">
                    Enter a positive amount and valid allocations.
                  </p>
                )}
                <Button
                  className="preview-button"
                  disabled={!resultSchema.success || loading}
                  onClick={() => setPreview(strategy)}
                >
                  Preview strategy <ArrowUpRight size={18} />
                </Button>
                <small className="builder-foot">
                  <ShieldCheck size={12} /> No orders. No signatures. Just a
                  plan.
                </small>
              </div>
              <div className="projection card">
                <div className="section-label">
                  EXPLORE THE POSSIBILITIES{" "}
                  <span className="badge subtle">
                    {strategy.durationMonths} MONTHS
                  </span>
                </div>
                <div className="projection-heading">
                  <div>
                    <span className="muted">Hypothetical ending equity</span>
                    <h2>
                      {result ? compactMoney(result.projectedValue) : "—"}
                    </h2>
                  </div>
                  <span
                    className={`scenario-tag ${scenarios[scenario].name.toLowerCase()}`}
                  >
                    {scenarios[scenario].name} scenario
                  </span>
                </div>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chart}
                      margin={{ top: 15, right: 12, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="chart-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#78e2c2"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="#78e2c2"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="#243137"
                        strokeDasharray="3 5"
                      />
                      <XAxis
                        dataKey="month"
                        tickFormatter={(v) => `${v} mo`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#819097", fontSize: 10 }}
                        minTickGap={25}
                      />
                      <YAxis
                        tickFormatter={(v) => `$${v / 1000}k`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#819097", fontSize: 10 }}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#172025",
                          border: "1px solid #314047",
                          borderRadius: 10,
                        }}
                        formatter={(v) => money(Number(v))}
                        labelFormatter={(v) => `Month ${v}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="Bull"
                        stroke="#7edec5"
                        fill="url(#chart-fill)"
                        strokeWidth={scenario === 2 ? 3 : 1.5}
                        strokeOpacity={scenario === 2 ? 1 : 0.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="Base"
                        stroke="#7dafa8"
                        fill="transparent"
                        strokeWidth={scenario === 1 ? 3 : 1.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="Bear"
                        stroke="#727f89"
                        fill="transparent"
                        strokeWidth={scenario === 0 ? 3 : 1.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="contributed"
                        name="Contributed"
                        stroke="#394950"
                        strokeDasharray="4 4"
                        fill="transparent"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="scenario-cards">
                  {scenarios.map((s, i) => {
                    const r = resultSchema.success
                      ? simulateDCA({
                          ...strategy,
                          btcPrice: market.BTC,
                          hypePrice: market.HYPE,
                          ...s,
                        })
                      : null;
                    return (
                      <button
                        key={s.name}
                        onClick={() => setScenario(i)}
                        className={scenario === i ? "selected" : ""}
                      >
                        <span>
                          {s.name.toUpperCase()}
                          {scenario === i && <Check size={13} />}
                        </span>
                        <strong>
                          {r ? compactMoney(r.projectedValue) : "—"}
                        </strong>
                        <small>
                          BTC {s.btcAnnualReturn > 0 ? "+" : ""}
                          {s.btcAnnualReturn * 100}% · HYPE{" "}
                          {s.hypeAnnualReturn > 0 ? "+" : ""}
                          {s.hypeAnnualReturn * 100}% / yr
                        </small>
                      </button>
                    );
                  })}
                </div>
                <div className="projection-totals">
                  <div>
                    <small>YOUR CONTRIBUTIONS</small>
                    <strong>
                      {constant
                        ? compactMoney(constant.totalContributions)
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <small>MODELED EXPOSURE</small>
                    <strong>
                      {constant
                        ? compactMoney(constant.effectiveExposure)
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <small>RELATIVE RISK</small>
                    <strong
                      className={
                        constant?.riskLevel === "high" ? "negative" : ""
                      }
                    >
                      {constant?.riskLevel.toUpperCase() ?? "—"}
                    </strong>
                  </div>
                </div>
                <p className="simulation-disclaimer">
                  Scenario simulation only. Historical or hypothetical returns
                  do not predict future performance. Excludes fees, funding and
                  liquidation. Risk labels are relative, not a safety rating.
                </p>
              </div>
            </div>
          </section>
          <section className="positions card">
            <div className="section-heading">
              <h2>Portfolio positions</h2>
              <span className="muted">
                Gross exposure {compactMoney(portfolio.totalExposure)} ·{" "}
                {portfolio.effectiveLeverage?.toFixed(2) ?? "—"}x equity
              </span>
            </div>
            {portfolio.positions.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ASSET</th>
                      <th>SIDE</th>
                      <th>SIZE</th>
                      <th>MARK PRICE</th>
                      <th>EXPOSURE</th>
                      <th>UNREALIZED PNL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map((p, i) => (
                      <tr key={`${p.coin}-${i}`}>
                        <td>{p.coin}</td>
                        <td>
                          <span className="badge subtle">
                            {p.side.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {p.size.toLocaleString("en-US", {
                            maximumFractionDigits: 6,
                          })}
                        </td>
                        <td>{money(p.markPrice)}</td>
                        <td>{money(p.usdValue)}</td>
                        <td>
                          {p.unrealizedPnl === undefined
                            ? "—"
                            : money(p.unrealizedPnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">
                No positions found in this account. Check that this is the
                master or subaccount address, not an agent wallet.
              </p>
            )}
            <div className="positions-note">
              {account === "demo"
                ? "Portfolio balances and position marks are demo fixtures. BTC/HYPE market quotes above update independently. Connect an address for your real portfolio."
                : `Snapshot includes ${portfolio.openOrders.length} open orders and ${portfolio.recentFills.length} recent fills. USDC card is spot cash only; perp equity is included in the portfolio total.`}
            </div>
            {portfolio.warnings.map((w) => (
              <p className="data-warning" key={w}>
                {w}
              </p>
            ))}
          </section>
          <footer>
            DCA AI provides analytical and educational tools, not personalized
            financial advice. Crypto assets and leveraged positions involve
            substantial risk.
            <span>
              LOCAL FIRST <i /> READ ONLY <i /> OPEN SOURCE
            </span>
          </footer>
        </main>
        {copilotVisible && (
          <CopilotPanel
            key={account}
            account={account}
            strategy={resultSchema.success ? strategy : defaultStrategy}
            onPreview={onPreview}
            onClose={() => setCopilotOpen(false)}
            aiConfigured={aiConfigured}
          />
        )}
      </div>
      {!copilotVisible && (
        <button className="copilot-fab" onClick={() => setCopilotOpen(true)}>
          <Avatar /> DCA AI <Sparkles size={16} />
        </button>
      )}
      <Modal
        open={connect}
        onOpenChange={setConnect}
        title="Connect Hyperliquid"
        description="View public account data using your master or subaccount address. No wallet signature needed."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadAccount(address);
          }}
        >
          <label className="field-label" htmlFor="address">
            Public account address
          </label>
          <input
            id="address"
            className="address-input"
            placeholder="0x…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button className="full" disabled={loading}>
            {loading ? "Loading portfolio…" : "View portfolio"}
            <ArrowRight size={16} />
          </Button>
        </form>
        <Button variant="ghost" className="full" onClick={useDemo}>
          Try demo portfolio
        </Button>
        <p className="small muted">Never enter a seed phrase or private key.</p>
      </Modal>
      <Modal
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title="Preview strategy"
        description="Review the plan before saving. This will not place or schedule any trades."
      >
        {preview && previewResult && (
          <>
            <div className="preview-allocations">
              <div>
                <small>BITCOIN</small>
                <strong>{preview.btcAllocation}%</strong>
                <span>
                  {money(
                    calculateAllocation(
                      preview.contributionAmount,
                      preview.btcAllocation,
                    ).btc,
                  )}{" "}
                  / {preview.contributionFrequency}
                </span>
              </div>
              <div>
                <small>HYPERLIQUID</small>
                <strong>{preview.hypeAllocation}%</strong>
                <span>
                  {money(
                    calculateAllocation(
                      preview.contributionAmount,
                      preview.btcAllocation,
                    ).hype,
                  )}{" "}
                  / {preview.contributionFrequency}
                </span>
              </div>
            </div>
            <dl className="preview-details">
              <div>
                <dt>Contribution</dt>
                <dd>
                  {money(preview.contributionAmount)} /{" "}
                  {preview.contributionFrequency}
                </dd>
              </div>
              <div>
                <dt>Initial capital</dt>
                <dd>{money(preview.capital)}</dd>
              </div>
              <div>
                <dt>Monthly / yearly run rate</dt>
                <dd>
                  {money(annualContribution(preview) / 12)} /{" "}
                  {money(annualContribution(preview))}
                </dd>
              </div>
              <div>
                <dt>Period / leverage</dt>
                <dd>
                  {preview.durationMonths} months /{" "}
                  {preview.leverage.toFixed(2)}x
                </dd>
              </div>
              <div>
                <dt>Total planned contributions</dt>
                <dd>{money(previewResult.totalContributions)}</dd>
              </div>
              <div>
                <dt>Relative risk</dt>
                <dd>{previewResult.riskLevel.toUpperCase()}</dd>
              </div>
            </dl>
            <p className="small muted">
              Run rates exclude initial capital. Calendar timing may differ; the
              model uses {previewResult.contributionCount} end-of-period
              contributions.
            </p>
            {previewResult.warnings.map((w) => (
              <p className="small muted" key={w}>
                · {w}
              </p>
            ))}
            <div className="modal-actions">
              <Button variant="outline" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button onClick={save}>
                Save strategy <Check size={16} />
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
