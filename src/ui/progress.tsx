import React from "react";
import { Text, Box } from "ink";

interface ProgressBarProps {
  percent: number;
  label?: string;
  width?: number;
}

export function ProgressBar({ percent, label, width = 30 }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  const bar = "█".repeat(filled) + "░".repeat(empty);

  return (
    <Box>
      {label && <Text>{label}: </Text>}
      <Text color="cyan">{bar}</Text>
      <Text> {Math.round(clamped)}%</Text>
    </Box>
  );
}

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <Box flexDirection="column" gap={1}>
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        const icon = isDone ? "✓" : isActive ? "→" : " ";
        const color = isDone ? "green" : isActive ? "cyan" : "gray";

        return (
          <Box key={i}>
            <Text color={color}>{icon} {step}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
