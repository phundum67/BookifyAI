import * as SecureStore from "expo-secure-store";

import { API_BASE_URL, DATA_BACKEND } from "../constants";
import { supabaseApi } from "../supabase/bookifyApi";

const TOKEN_KEY = "bookify_auth_token";
let authToken = null;
let accessTokenProvider = null;

export function setAccessTokenProvider(provider) {
  accessTokenProvider = typeof provider === "function" ? provider : null;
}

export async function loadAuthToken() {
  authToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return authToken;
}

export async function setAuthToken(token) {
  authToken = token || null;
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function clearAuthToken() {
  authToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function api(path, options = {}) {
  if (DATA_BACKEND === "supabase") {
    return supabaseApi(path, options);
  }

  const bearerToken = accessTokenProvider ? await accessTokenProvider() : authToken;
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const responseText = await response.text();
  let payload = {};
  let responseWasReadable = true;
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch (_error) {
      responseWasReadable = false;
      payload = { message: "The server returned an unreadable response.", errors: [] };
    }
  } else {
    payload = { message: response.ok ? "ok" : "The server returned an empty response.", data: {}, errors: [] };
  }

  if (!response.ok) {
    const message = payload.errors && payload.errors.length ? payload.errors.join(" ") : payload.message;
    const error = new Error(message || "Request failed.");
    error.status = response.status;
    error.payload = payload;
    error.responseWasReadable = responseWasReadable;
    throw error;
  }

  if (!accessTokenProvider && payload.data && payload.data.token) {
    await setAuthToken(payload.data.token);
  }

  return payload;
}
