const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "https://phundum67.pythonanywhere.com/api").replace(/\/$/, "");

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (networkError) {
    throw {
      status: 0,
      message: "Network error",
      errors: ["Could not connect to the server. Please check your internet connection and API URL."],
      data: {},
    };
  }

  const contentType = response.headers.get("content-type") || "";
  let data;

  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => null);
  } else {
    const rawText = await response.text().catch(() => "");
    data = {
      message: "Unexpected response",
      data: {},
      errors: [rawText ? `The server returned a non-JSON response: ${rawText.slice(0, 120)}` : "The server returned an unreadable response."],
    };
  }

  if (!data || typeof data !== "object") {
    data = {
      message: "Unexpected response",
      data: {},
      errors: ["The server returned an unreadable response."],
    };
  }

  if (!response.ok) {
    throw {
      status: response.status,
      message: data.message || "Request failed",
      errors: data.errors || [],
      data: data.data || {},
    };
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};
