import type { WordTimestamp, SubtitleStyle } from "../types";

const MAX_LINE_LENGTH = 42;
const MAX_DISPLAY_DURATION = 3.5;

export function generateSRT(words: WordTimestamp[], style: SubtitleStyle = "minimal", offset = 0): string {
  const groups = groupWordsIntoCaptions(words, offset);
  return groups.map((group, i) => formatSRTBlock(i + 1, group, style)).join("\n\n");
}

interface CaptionGroup {
  start: number;
  end: number;
  text: string;
}

function groupWordsIntoCaptions(words: WordTimestamp[], offset = 0): CaptionGroup[] {
  if (words.length === 0) return [];

  const groups: CaptionGroup[] = [];
  let currentStart = Math.max(0, words[0].start - offset);
  let currentEnd = Math.max(0, words[0].end - offset);
  let currentText = "";
  let currentLength = 0;

  for (const word of words) {
    const wordText = word.word.trim();
    if (!wordText) continue;

    const wordStart = Math.max(0, word.start - offset);
    const wordEnd = Math.max(0, word.end - offset);

    const newLength = currentLength + wordText.length + (currentLength > 0 ? 1 : 0);
    const displayDuration = wordEnd - currentStart;

    if ((newLength > MAX_LINE_LENGTH || displayDuration > MAX_DISPLAY_DURATION) && currentLength > 0) {
      groups.push({ start: currentStart, end: currentEnd, text: currentText });
      currentStart = wordStart;
      currentEnd = wordEnd;
      currentText = wordText;
      currentLength = wordText.length;
    } else {
      currentText += (currentText ? " " : "") + wordText;
      currentEnd = wordEnd;
      currentLength = newLength;
    }
  }

  if (currentText) groups.push({ start: currentStart, end: currentEnd, text: currentText });
  return groups;
}

function formatSRTBlock(index: number, group: CaptionGroup, style: SubtitleStyle): string {
  const start = formatTime(group.start);
  const end = formatTime(group.end);
  let text = group.text;
  if (style === "tiktok") text = text.toUpperCase();
  else if (style === "mrbeast") text = text.split(" ").map(w => w.toUpperCase()).join(" ");
  return `${index}\n${start} --> ${end}\n${text}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(num: number, length = 2): string {
  return String(num).padStart(length, "0");
}


