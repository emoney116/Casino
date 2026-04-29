import { BlackjackPageClean } from "./BlackjackPageClean";

export function BlackjackPage({ onExit }: { onExit?: () => void }) {
  return <BlackjackPageClean onExit={onExit} />;
}
