export class ApiError extends Error {}

export async function post<T = Record<string, unknown>>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Sem ligação. Verifica a internet e tenta outra vez.');
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T;
  if (!res.ok || data.ok === false) throw new ApiError(data.error ?? `Erro ${res.status}.`);
  return data;
}
