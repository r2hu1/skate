import React from "react";
import { Text, Box } from "ink";

interface Column {
  label: string;
  width: number;
}

interface TableProps {
  columns: Column[];
  rows: string[][];
}

export function Table({ columns, rows }: TableProps) {
  const header = columns.map(c => c.label.padEnd(c.width).slice(0, c.width)).join(" │ ");

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text bold underline>{header}</Text>
      </Box>
      {rows.map((row, i) => {
        const cells = row.map((cell, j) => {
          const col = columns[j];
          return cell.padEnd(col.width).slice(0, col.width);
        });
        return (
          <Box key={i}>
            <Text>{cells.join(" │ ")}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
