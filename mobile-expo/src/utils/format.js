export function formatTime(value) {
  if (!value) return "";
  const [hourText, minute = "00"] = value.split(":");
  let hour = Number(hourText);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

export function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function todayISO() {
  return toLocalISODate(new Date());
}

export function toLocalISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatPrice(business, valueOverride) {
  const price = valueOverride !== undefined ? valueOverride : business?.price_per_hour;
  if (price === null || price === undefined || price === "") return "Price on request";
  const symbol = business?.currency_symbol || business?.currency_code || business?.currency || "";
  return `${symbol} ${Number(price).toLocaleString()} / hour`.trim();
}

export function addHours(time, hours) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour + Number(hours), minute, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
