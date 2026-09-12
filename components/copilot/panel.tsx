"use client";
import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, ArrowUp, ChevronRight, X } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, type VoiceState } from "./avatar";
import type { DCADraft } from "@/lib/dca/draft";
import type { Strategy } from "@/lib/dca/simulator";
import type { CopilotReply } from "@/lib/ai/copilot";
import { LiveVoiceProvider, type Transcript } from "@/lib/voice/provider";
export function CopilotPanel({
  account,
  strategy,
  onDcaDraft,
  onPreview,
  onClose,
  aiConfigured,
}: {
  account: string;
  strategy: Strategy;
  onDcaDraft: (draft: DCADraft) => void;
  onPreview: (s: Strategy) => void;
  onClose: () => void;
  aiConfigured: boolean;
}) {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; provider?: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const voice = useRef<LiveVoiceProvider | null>(null);
  const latest = useRef({ account, strategy, onPreview, onDcaDraft });
  useEffect(() => {
    latest.current = { account, strategy, onPreview, onDcaDraft };
  }, [account, strategy, onPreview, onDcaDraft]);
  useEffect(() => () => voice.current?.dispose(), []);
  async function ask(message: string) {
    if (busy || !message.trim()) return;
    setBusy(true);
    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account,
          strategy,
          message,
          history: messages
            .slice(-20)
            .map(({ role, content }) => ({ role, content })),
        }),
        signal: AbortSignal.timeout(140000),
      });
      const result = (await response.json()) as CopilotReply & {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: result.text, provider: result.provider },
      ]);
      if (result.preview) onPreview(result.preview);
      if (result.dcaDraft) onDcaDraft(result.dcaDraft);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Copilot unavailable. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function startVoice() {
    if (voiceState !== "idle") {
      voice.current?.stop();
      return;
    }
    if (!aiConfigured) {
      setError(
        "Voice unavailable. Configure OPENAI_API_KEY; use text chat meanwhile.",
      );
      return;
    }
    setError("");
    setTranscript([]);
    voice.current = new LiveVoiceProvider({
      state: setVoiceState,
      transcript: (t) => setTranscript((x) => [...x, t]),
      error: setError,
      delegate: async (history, isCurrent) => {
        const state = latest.current;
        const response = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account: state.account,
            strategy: state.strategy,
            message:
              "Respond to the latest request in this voice transcript. It may contain overlapping fragments: " +
              history
                .map((t) => `${t.role}: ${t.delta}`)
                .join("")
                .slice(-5000),
          }),
          signal: AbortSignal.timeout(140000),
        });
        const result = (await response.json()) as CopilotReply;
        if (!response.ok)
          return "The calculation service is unavailable. Please use the strategy builder.";
        if (result.preview && isCurrent()) state.onPreview(result.preview);
        if (result.dcaDraft && isCurrent()) state.onDcaDraft(result.dcaDraft);
        return result.text;
      },
    });
    await voice.current.start();
  }
  return (
    <aside className="copilot-panel" aria-label="DCA AI Copilot">
      <div className="copilot-head">
        <div className="inline">
          <Avatar state={voiceState} />
          <div>
            <strong>DCA AI</strong>
            <small>Your Hyperliquid Copilot</small>
          </div>
        </div>
        <button
          className="icon-button close-copilot"
          onClick={onClose}
          aria-label="Close Copilot"
        >
          <X size={18} />
        </button>
      </div>
      <div className="copilot-status">
        <i />
        {aiConfigured ? "AI CONFIGURED" : "LOCAL TOOLS · NO API KEY"}
      </div>
      <div className="chat-scroll" aria-live="polite">
        {messages.length === 0 ? (
          <>
            <div className="ai-intro">
              <span className="eyebrow">A LITTLE CLARITY. A BETTER PLAN.</span>
              <h3>
                Let’s put your
                <br />
                strategy in perspective.
              </h3>
              <p>
                I can help you understand your portfolio and explore BTC + HYPE
                accumulation.
              </p>
            </div>
            <div className="quick-prompts">
              {[
                "Analyze my portfolio",
                "Build a BTC + HYPE DCA",
                "Simulate $50/day",
                "Should I use leverage?",
              ].map((q) => (
                <button key={q} onClick={() => ask(q)} disabled={busy}>
                  {q}
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            <div className="context-note">
              <span className="context-dot" /> Portfolio & builder context
              included
              <br />
              <small>
                {account === "demo"
                  ? "Demo balances · live market prices"
                  : "Read-only Hyperliquid account data"}
              </small>
            </div>
          </>
        ) : (
          messages.map((m, i) => (
            <div className={`message ${m.role}`} key={i}>
              <small>
                {m.role === "user"
                  ? "YOU"
                  : m.provider === "local"
                    ? "LOCAL CALCULATOR"
                    : "DCA AI"}
              </small>
              <p>{m.content}</p>
            </div>
          ))
        )}
        {busy && <p className="muted">Checking context & calculating…</p>}
        {transcript.length > 0 && (
          <div className="transcript">
            <small>LIVE TRANSCRIPT · AI VOICE</small>
            <p>
              <b>YOU </b>
              {transcript
                .filter((t) => t.role === "user")
                .map((t) => t.delta)
                .join("")}
            </p>
            <p>
              <b>DCA AI </b>
              {transcript
                .filter((t) => t.role === "assistant")
                .map((t) => t.delta)
                .join("")}
            </p>
          </div>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="chat-bottom">
        <Button variant="outline" className="voice-button" onClick={startVoice}>
          {voiceState === "idle" ? <Mic size={16} /> : <MicOff size={16} />}{" "}
          {voiceState === "idle"
            ? "Start voice"
            : voiceState === "tool_running"
              ? "Simulating… · Stop voice"
              : `${voiceState} · Stop voice`}
        </Button>
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <input
            aria-label="Ask DCA AI"
            placeholder="Ask about your strategy…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={6000}
          />
          <button aria-label="Send message" disabled={busy || !input.trim()}>
            <ArrowUp size={19} />
          </button>
        </form>
        <small>Simulation only. You stay in control.</small>
      </div>
    </aside>
  );
}
