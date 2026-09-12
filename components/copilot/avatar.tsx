export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "tool_running";
export function Avatar({ state = "idle" }: { state?: VoiceState }) {
  return (
    <span aria-hidden="true" className={`orb orb-${state}`}>
      <span />
      <span />
      <span />
    </span>
  );
}
