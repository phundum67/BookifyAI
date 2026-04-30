import { api } from "./client";

export const authApi = {
  me: () => api.get("/auth/me"),
  signup: (payload) => api.post("/auth/signup", payload),
  login: (payload) => api.post("/auth/login", payload),
  logout: () => api.post("/auth/logout", {}),
  chooseRole: (account_type) => api.patch("/auth/role", { account_type }),
  updateProfile: (payload) => api.patch("/auth/profile", payload),
};

export const businessApi = {
  list: (params = "") => api.get(`/businesses${params}`),
  get: (id) => api.get(`/businesses/${id}`),
  create: (payload) => api.post("/businesses", payload),
  update: (id, payload) => api.put(`/businesses/${id}`, payload),
  mine: () => api.get("/businesses/mine"),
  availabilityCheck: (id) => api.get(`/businesses/${id}/owner-booking-check`),
};

export const slotsApi = {
  list: (businessId, date, includeAll = false) =>
    api.get(`/businesses/${businessId}/slots?date=${date || ""}${includeAll ? "&all=true" : ""}`),
  generate: (businessId, payload) => api.post(`/businesses/${businessId}/slots/generate`, payload),
  update: (slotId, payload) => api.patch(`/slots/${slotId}`, payload),
  closures: (businessId, payload) => api.post(`/businesses/${businessId}/closures`, payload),
};

export const bookingsApi = {
  create: (payload) => api.post("/bookings", payload),
  customer: () => api.get("/bookings/customer"),
  business: () => api.get("/bookings/business"),
  cancel: (bookingId) => api.patch(`/bookings/${bookingId}/cancel`, {}),
};

export const favoritesApi = {
  list: () => api.get("/favorites"),
  add: (businessId) => api.post(`/favorites/${businessId}`, {}),
  remove: (businessId) => api.delete(`/favorites/${businessId}`),
};

export const reviewsApi = {
  list: (businessId) => api.get(`/businesses/${businessId}/reviews`),
  create: (businessId, payload) => api.post(`/businesses/${businessId}/reviews`, payload),
};

export const notificationsApi = {
  list: () => api.get("/notifications"),
  markRead: (id) => api.patch(`/notifications/${id}/read`, {}),
};

export const dashboardApi = {
  summary: () => api.get("/dashboard/summary"),
};
