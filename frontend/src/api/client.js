const API_BASE_URL =  "https://phundum67.pythonanywhere.com/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({
    message: "Unexpected response",
    data: {},
    errors: ["The server returned an invalid response."],
  }));

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
