import type { WordTimestamp, SubtitleStyle } from "../types";

const MAX_LINE_LENGTH = 42;
const MAX_DISPLAY_DURATION = 3.5;

export function generateSRT(words: WordTimestamp[], _style: SubtitleStyle = "minimal", offset = 0): string {
  const groups = groupWordsIntoCaptions(words, offset);
  return groups.map((group, i) => formatSRTBlock(i + 1, group)).join("\n\n");
}

export function generateASS(words: WordTimestamp[], _style: SubtitleStyle = "minimal", offset = 0): string {
  const groups = groupWordsIntoCaptions(words, offset);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,36,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,20,20,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = groups.map((group, i) => formatASSEvent(i + 1, group));
  return header + events.join("\n");
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

function formatSRTBlock(index: number, group: CaptionGroup): string {
  return `${index}\n${formatTime(group.start)} --> ${formatTime(group.end)}\n${group.text}`;
}

function formatASSEvent(_index: number, group: CaptionGroup): string {
  const start = formatASSTime(group.start);
  const end = formatASSTime(group.end);
  return `Dialogue: 0,${start},${end},Default,,0,0,0,,${group.text}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs, 2)}`;
}

function pad(num: number, length = 2): string {
  return String(num).padStart(length, "0");
}
