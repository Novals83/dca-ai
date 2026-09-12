import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
export default function Page() {
  return (
    <main className="landing">
      <header className="topbar">
        <Link href="/" className="logo">
          <span className="logo-symbol">∿</span>DCA<span>AI</span>
        </Link>
        <span className="header-subtitle">HYPERLIQUID COPILOT</span>
        <Link href="/app" className="landing-nav">
          Open app <ArrowUpRight size={16} />
        </Link>
      </header>
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">
            <i className="dot" /> BUILT FOR CONSISTENCY
          </span>
          <h1>
            Your AI
            <br />
            DCA strategist<span>.</span>
          </h1>
          <p>
            A clearer view of your portfolio.
            <br />A more considered way to accumulate BTC + HYPE.
          </p>
          <div className="landing-ctas">
            <Button asChild>
              <Link href="/app?connect=1">
                Connect Hyperliquid <ArrowUpRight size={18} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app">
                Try demo <ArrowRight size={18} />
              </Link>
            </Button>
          </div>
          <span className="landing-note">
            <ShieldCheck size={15} /> Read-only. No signatures. No automated
            trades.
          </span>
        </div>
        <div className="landing-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="visual-core">∿</div>
          <span className="orbit-label label-btc">
            ₿ <small>BITCOIN</small>
          </span>
          <span className="orbit-label label-hype">
            ∿ <small>HYPERLIQUID</small>
          </span>
          <div className="visual-caption">
            <span className="dot" /> INTELLIGENCE MEETS INTENTION
          </div>
        </div>
      </section>
      <section className="landing-features">
        <div>
          <Layers />
          <span>01 / UNDERSTAND</span>
          <h3>Your portfolio, in context.</h3>
          <p>
            Read public Hyperliquid balances and exposures from one account
            address.
          </p>
        </div>
        <div>
          <ShieldCheck />
          <span>02 / EXPLORE</span>
          <h3>Calculate before you commit.</h3>
          <p>
            Compare contributions, allocations and hypothetical scenarios. Save
            a plan locally.
          </p>
        </div>
        <div>
          <Sparkles />
          <span>03 / CONVERSE</span>
          <h3>Think it through together.</h3>
          <p>
            Bring portfolio context to text and voice with your own OpenAI API
            key.
          </p>
        </div>
      </section>
      <div className="edition-note">
        <span>COMMUNITY EDITION</span>
        <p>
          Free to self-host. Your device, your API key.
          <br />
          Cloud accounts and subscription hosting are planned for the next
          stage.
        </p>
        <Link href="/app">
          Explore the workspace <ArrowRight size={16} />
        </Link>
      </div>
      <footer>
        DCA AI provides analytical and educational tools, not personalized
        financial advice. Crypto assets and leveraged positions involve
        substantial risk.
      </footer>
    </main>
  );
}
