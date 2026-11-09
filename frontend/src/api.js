const REQUEST_TIMEOUT_MS = 180_000; // a live agent run waits on providers and Qwen

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      /* non-JSON error page from a proxy */
    }
    if (!response.ok) {
      throw new ApiError(data?.error || `Request failed (${response.status})`, response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === "AbortError") throw new ApiError("This is taking too long. Please try again.", 0);
    throw new ApiError("We could not connect. Please check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body = {}) => request("POST", path, body),
};
