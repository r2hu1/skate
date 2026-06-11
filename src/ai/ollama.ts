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
      num_predict: 2048,
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

  const data = await res.json() as any;
  const response = data.response || "";
  if (!response && data.error) {
    console.warn(`  Ollama error: ${data.error}`);
  }
  return response;
}

export async function checkOllamaModel(ollamaUrl: string, model: string): Promise<boolean> {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`);
    if (!res.ok) return false;
    const data = await res.json() as any;
    const models = (data.models || []).map((m: any) => m.name);
    return models.some((m: string) => m.startsWith(model) || m === model);
  } catch {
    return false;
  }
}
