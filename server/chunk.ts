/**
 * How much transcript one model call receives. Long transcripts are cut into
 * chunks of roughly this size and analysed one after another, because accuracy
 * drops well before the context window is full.
 */
export const CHUNK_CHARS = Math.max(2_000, Number(process.env.ANALYZE_CHUNK_CHARS) || 12_000);

/** Split on line boundaries so a speaker turn is never cut in half unnecessarily. */
export function chunkTranscript(transcript: string, maxChars: number): string[] {
  const lines = transcript.split('\n');
  const chunks: string[] = [];
  let current = '';

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const line of lines) {
    if (line.length > maxChars) {
      // A single turn longer than one chunk: hard-split it.
      push();
      for (let start = 0; start < line.length; start += maxChars) {
        chunks.push(line.slice(start, start + maxChars));
      }
      continue;
    }
    if (current.length + line.length + 1 > maxChars) push();
    current += (current ? '\n' : '') + line;
  }
  push();

  return chunks.length > 0 ? chunks : [transcript.trim()];
}
