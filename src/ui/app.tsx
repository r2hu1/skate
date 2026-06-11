import React from "react";
import { Text, Box } from "ink";

interface AppProps {
  command?: string;
  status?: string;
}

export function App({ command, status }: AppProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Skate</Text>
        <Text> — AI-Powered Shorts CLI</Text>
      </Box>
      {command && (
        <Box>
          <Text>Command: </Text>
          <Text bold>{command}</Text>
        </Box>
      )}
      {status && (
        <Box>
          <Text>Status: </Text>
          <Text color="green">{status}</Text>
        </Box>
      )}
    </Box>
  );
}
