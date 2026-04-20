export function formatTime(time) {
  if (!time || typeof time !== "string") return "";

  const [rawHour, rawMinute = "00"] = time.split(":");
  const hour = Number(rawHour);
  if (Number.isNaN(hour)) return time;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${rawMinute.padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return "";
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

export function addHours(time, hours) {
  if (!time) return "";
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(rawHour + Number(hours || 0), rawMinute || 0, 0, 0);
  return date.toTimeString().slice(0, 5);
}

export const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  const value = `${String(hour).padStart(2, "0")}:${minute}`;
  return {
    value,
    label: formatTime(value),
  };
});
