import React, { useEffect, useState } from "react";

import { api } from "../api/client";
import { BottomTabs, CustomerBookingCard, EmptyState, Screen, Title } from "../components/ui";
import { BookingDetailsScreen } from "./BookingDetailsScreen";

const tabs = [
  { label: "Home", value: "home" },
  { label: "Browse", value: "browse" },
  { label: "Bookings", value: "bookings" },
  { label: "Settings", value: "settings" }
];

export function CustomerBookingsScreen({ activeTab, onTabChange, onError }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [checkedRescheduleAlerts, setCheckedRescheduleAlerts] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    try {
      setLoading(true);
      const payload = await api("/bookings/customer");
      const nextBookings = [...(payload.data.bookings || [])].sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
      setBookings(nextBookings);
      if (selectedBooking) {
        const refreshed = nextBookings.find((item) => item.id === selectedBooking.id);
        setSelectedBooking(refreshed || null);
      }
      if (!checkedRescheduleAlerts) {
        await alertLatestReschedule();
        setCheckedRescheduleAlerts(true);
      }
    } catch (error) {
      onError(error);
    } finally {
      setLoading(false);
    }
  }

  async function alertLatestReschedule() {
    try {
      const payload = await api("/notifications");
      const notifications = payload.data.notifications || [];
      const notice = notifications.find((item) => item.type === "booking_rescheduled" && !item.is_read);
      if (!notice) return;

      onError({
        title: notice.title || "Booking updated",
        message: notice.message || "One of your bookings was rescheduled.",
        tone: "info",
        helperTitle: "Updated slot",
        helperText: "Your booking timing was changed by the business. Please review the new slot details before the visit.",
        buttonText: "View update"
      });
      await api(`/notifications/${notice.id}/read`, { method: "PATCH", body: {} });
    } catch (_error) {
      // Booking list should still load even if notifications are unavailable.
    }
  }

  async function cancelBooking(id) {
    try {
      await api(`/bookings/${id}/cancel`, { method: "PATCH", body: {} });
      await loadBookings();
    } catch (error) {
      onError(error);
    }
  }

  if (selectedBooking) {
    return (
      <BookingDetailsScreen
        booking={selectedBooking}
        onBack={() => setSelectedBooking(null)}
        onCancel={cancelBooking}
        onError={onError}
      />
    );
  }

  return (
    <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />}>
      <Title>Your bookings</Title>
      {loading ? <EmptyState>Loading bookings...</EmptyState> : null}
      {!loading && bookings.length ? bookings.map((booking) => <CustomerBookingCard key={booking.id} booking={booking} onPress={setSelectedBooking} />) : null}
      {!loading && !bookings.length ? <EmptyState>No bookings yet. Start by booking your first place.</EmptyState> : null}
    </Screen>
  );
}
