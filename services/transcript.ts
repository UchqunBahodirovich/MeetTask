import type { TranscriptLine } from '../types';

/** Shape shared by realtime tokens and async transcription tokens. */
export interface TranscriptToken {
  text: string;
  start_ms?: number | null;
  end_ms?: number | null;
  speaker?: string | null;
}

export function formatOffset(milliseconds = 0): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Group speech-to-text tokens into readable lines. A new line starts only when the
 * speaker changes — pauses inside one person's turn stay in the same block.
 */
export function tokensToLines(tokens: TranscriptToken[]): TranscriptLine[] {
  const lines: Array<TranscriptLine & { endMs: number }> = [];

  for (const token of tokens) {
    if (!token.text.trim() && lines.length === 0) continue;
    const speaker = token.speaker ? `Speaker ${token.speaker}` : 'Speaker';
    const startMs = token.start_ms ?? 0;
    const previous = lines.at(-1);
    const startsNewLine = !previous || previous.speaker !== speaker;

    if (startsNewLine) {
      lines.push({
        id: `line-${startMs}-${lines.length}`,
        speaker,
        text: token.text,
        timestamp: formatOffset(startMs),
        endMs: token.end_ms ?? startMs,
      });
    } else {
      previous.text += token.text;
      previous.endMs = token.end_ms ?? previous.endMs;
    }
  }

  return lines
    .map(({ endMs: _endMs, ...line }) => ({ ...line, text: line.text.trim() }))
    .filter((line) => line.text.length > 0);
}
