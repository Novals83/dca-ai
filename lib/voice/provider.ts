import type { VoiceState } from "@/components/copilot/avatar";
export type Transcript = {
  role: "user" | "assistant";
  delta: string;
  startMs: number;
  endMs: number;
};
export interface VoiceProvider {
  start(): Promise<void>;
  stop(): void;
  dispose(): void;
}
export class LiveVoiceProvider implements VoiceProvider {
  private peer?: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private stream?: MediaStream;
  private audio?: HTMLAudioElement;
  private closed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private revision = 0;
  private transcript: Transcript[] = [];
  constructor(
    private hooks: {
      state: (s: VoiceState) => void;
      transcript: (t: Transcript) => void;
      delegate: (
        history: Transcript[],
        isCurrent: () => boolean,
      ) => Promise<string>;
      error: (message: string) => void;
    },
  ) {}
  private send(value: unknown) {
    if (this.channel?.readyState === "open")
      this.channel.send(JSON.stringify(value));
  }
  async start() {
    this.closed = false;
    this.hooks.state("connecting");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Microphone requires localhost or HTTPS.");
      this.peer = new RTCPeerConnection();
      this.audio = new Audio();
      this.audio.autoplay = true;
      this.peer.ontrack = (e) => {
        if (this.audio) {
          this.audio.srcObject = new MediaStream([e.track]);
          void this.audio
            .play()
            .catch(() =>
              this.hooks.error(
                "Audio playback blocked. Restart voice from a browser tab.",
              ),
            );
        }
      };
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.closed) {
        this.dispose();
        return;
      }
      this.stream
        .getAudioTracks()
        .forEach((track) => this.peer!.addTrack(track, this.stream!));
      this.channel = this.peer.createDataChannel("oai-events");
      this.channel.onmessage = async ({ data }) => {
        try {
          const e = JSON.parse(data) as {
            type: string;
            delta?: string;
            start_ms?: number;
            end_ms?: number;
            delegation?: { id: string };
          };
          if (e.type === "session.started") {
            clearTimeout(this.timer);
            this.hooks.state("listening");
          }
          if (e.type === "session.closed") {
            this.dispose();
            return;
          }
          if (e.type === "error") {
            this.hooks.error("Voice connection error. Use text chat.");
            this.stop();
          }
          if (
            e.type === "session.input_transcript.delta" ||
            e.type === "session.output_transcript.delta"
          ) {
            const t: Transcript = {
              role: e.type.includes("input_") ? "user" : "assistant",
              delta: e.delta ?? "",
              startMs: e.start_ms ?? 0,
              endMs: e.end_ms ?? 0,
            };
            this.transcript.push(t);
            if (t.role === "user") this.revision++;
            this.hooks.transcript(t);
            this.hooks.state(t.role === "user" ? "listening" : "speaking");
          }
          if (e.type === "session.delegation.created" && e.delegation) {
            const revision = this.revision;
            this.hooks.state("tool_running");
            const result = await this.hooks.delegate(
              [...this.transcript],
              () => revision === this.revision && !this.closed,
            );
            if (this.closed) return;
            this.send({
              type: "session.commentary.append",
              event_id: crypto.randomUUID(),
              delegation_id: e.delegation.id,
              content:
                revision === this.revision
                  ? result.slice(0, 1200)
                  : "The user supplied more information while this result was being calculated. Please delegate again using the updated conversation before proposing a strategy.",
            });
            this.hooks.state("listening");
          }
        } catch {
          this.hooks.error("Voice task failed. Please use text chat.");
        }
      };
      this.channel.onclose = () => {
        if (!this.closed) {
          this.hooks.error("Voice disconnected. Text chat remains available.");
          this.dispose();
        }
      };
      this.peer.onconnectionstatechange = () => {
        if (this.peer?.connectionState === "failed") {
          this.hooks.error("WebRTC connection failed. Use text chat.");
          this.dispose();
        }
      };
      await this.peer.setLocalDescription(await this.peer.createOffer());
      if (this.peer.iceGatheringState !== "complete")
        await new Promise<void>((resolve, reject) => {
          const peer = this.peer!;
          const timeout = setTimeout(() => {
            peer.removeEventListener("icegatheringstatechange", check);
            reject(new Error("WebRTC connection timed out."));
          }, 10000);
          const check = () => {
            if (peer.iceGatheringState === "complete") {
              clearTimeout(timeout);
              peer.removeEventListener("icegatheringstatechange", check);
              resolve();
            }
          };
          peer.addEventListener("icegatheringstatechange", check);
          check();
        });
      if (this.closed) return;
      const response = await fetch("/api/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: this.peer.localDescription?.sdp }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Voice unavailable. Use text chat.");
      if (this.closed) return;
      this.timer = setTimeout(() => {
        this.hooks.error("Voice startup timed out. Use text chat.");
        this.dispose();
      }, 15000);
      await this.peer.setRemoteDescription({
        type: "answer",
        sdp: result.transport.sdp,
      });
    } catch (e) {
      this.hooks.error(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission denied. Enable it in your browser or use text chat."
          : e instanceof Error
            ? e.message
            : "Voice unavailable. Use text chat.",
      );
      this.dispose();
    }
  }
  stop() {
    if (this.channel?.readyState === "open") {
      this.send({ type: "session.close" });
      this.stream?.getTracks().forEach((t) => {
        t.enabled = false;
      });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.dispose(), 3000);
    } else this.dispose();
  }
  dispose() {
    this.closed = true;
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.channel?.close();
    this.peer?.close();
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
    }
    this.hooks.state("idle");
  }
}
