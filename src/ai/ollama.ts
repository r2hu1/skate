export async function queryOllama(
  prompt: string,
  ollamaUrl: string,
  model: string,
  systemPrompt?: string,
): Promise<string> {
  const body: Record<string, any> = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.3,
    },
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as any;
  const response = data.response || "";
  if (!response) {
    console.warn(
      `  Ollama response empty. done=${data.done} error=${data.error || "none"}`,
    );
  }
  return response;
}

export async function checkOllamaRunning(ollamaUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function startOllama(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["ollama", "serve"], {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env },
    });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const res = await fetch("http://localhost:11434/api/tags", {
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) return true;
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}

export async function ensureOllama(ollamaUrl: string): Promise<boolean> {
  if (await checkOllamaRunning(ollamaUrl)) return true;
  console.log("  Ollama is not running. Attempting to start it...");
  const started = await startOllama();
  if (started) {
    console.log("  Ollama started successfully");
  } else {
    console.log("  Could not start Ollama automatically");
    console.log("  Start it manually: ollama serve");
  }
  return started;
}

export async function checkOllamaModel(
  ollamaUrl: string,
  model: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`);
    if (!res.ok) return false;
    const data = (await res.json()) as any;
    const models = (data.models || []).map((m: any) => m.name);
    return models.some((m: string) => m.startsWith(model) || m === model);
  } catch {
    return false;
  }
}
