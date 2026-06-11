import React from "react";
import { Text, Box } from "ink";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

interface LogViewerProps {
  entries: LogEntry[];
  maxEntries?: number;
}

const levelColors: Record<string, string> = {
  info: "white",
  warn: "yellow",
  error: "red",
  debug: "gray",
};

export function LogViewer({ entries, maxEntries = 100 }: LogViewerProps) {
  const visible = entries.slice(-maxEntries);

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="gray">
      {visible.map((entry, i) => (
        <Box key={i}>
          <Text color="gray">{entry.timestamp}</Text>
          <Text> </Text>
          <Text color={levelColors[entry.level] || "white"}>
            [{entry.level.toUpperCase()}]
          </Text>
          <Text> {entry.message}</Text>
        </Box>
      ))}
    </Box>
  );
}
