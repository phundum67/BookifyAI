import React, { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../api/client";
import { COLORS } from "../constants";
import { BottomTabs, BusinessBookingCard, Card, Chip, EmptyState, IconButton, Screen, styles } from "../components/ui";
import { BusinessBookingDetailsScreen } from "./BusinessBookingDetailsScreen";
import { formatDate, formatTime, todayISO, toLocalISODate } from "../utils/format";

const tabs = [
  { label: "Dashboard", value: "dashboard" },
  { label: "Bookings", value: "bookings" },
  { label: "Slots", value: "slots" },
  { label: "Settings", value: "settings" }
];

const bookingTabs = [
  { key: "upcoming", label: "Upcoming" },
  { key: "available", label: "Available" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" }
];

function getNotificationTone(type) {
  if (type === "booking_issue_reported") {
    return {
      icon: "alert-circle-outline",
      backgroundColor: "#FFF4E5",
      borderColor: "#F4D6A6",
      color: "#A66A18"
    };
  }
  if (type === "booking_cancelled") {
    return {
      icon: "close-circle-outline",
      backgroundColor: "#FBECEC",
      borderColor: "#F3C7C7",
      color: "#B94A48"
    };
  }
  if (type === "booking_rescheduled") {
    return {
      icon: "time-outline",
      backgroundColor: "#FFF4E5",
      borderColor: "#F4D6A6",
      color: "#A66A18"
    };
  }
  if (type === "booking_confirmed" || type === "new_booking") {
    return {
      icon: "calendar-outline",
      backgroundColor: "#EAF1ED",
      borderColor: "#C9D8CF",
      color: "#4B6B57"
    };
  }
  return {
    icon: "notifications-outline",
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.border,
    color: COLORS.accent
  };
}

export function BusinessBookingsScreen({ activeTab, onTabChange, onError }) {
  const [bookings, setBookings] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBookingTab, setActiveBookingTab] = useState("upcoming");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadBookings();
    loadBusiness();
    loadNotifications({ silent: true });
  }, []);

  useEffect(() => {
    if (activeTab !== "bookings") return;
    loadBookings();
    loadBusiness();
    loadNotifications({ silent: true });
  }, [activeTab]);

  useEffect(() => {
    if (activeBookingTab === "available" && business?.id) {
      loadAvailability();
    }
  }, [activeBookingTab, business?.id, date, selectedServiceId]);

  useEffect(() => {
    if (activeTab !== "bookings" || selectedBooking) return undefined;
    const timer = setInterval(() => {
      loadBookings();
      loadNotifications({ silent: true });
      if (activeBookingTab === "available" && business?.id) {
        loadAvailability();
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [activeTab, activeBookingTab, business?.id, date, selectedBooking, selectedServiceId]);

  const groupedBookings = useMemo(() => {
    const upcoming = [];
    const completed = [];
    const cancelled = [];

    bookings.forEach((booking) => {
      const status = (booking.status || "").toLowerCase();
      if (status === "completed") {
        completed.push(booking);
      } else if (status === "cancelled") {
        cancelled.push(booking);
      } else {
        upcoming.push(booking);
      }
    });

    return { upcoming, completed, cancelled };
  }, [bookings]);

  const currentBookings = groupedBookings[activeBookingTab] || [];

  const services = Array.isArray(business?.services) ? business.services.filter(Boolean) : [];
  const visibleAvailabilitySlots = availabilitySlots.filter((slot) => slot.status === "available");

  async function loadBookings() {
    try {
      setLoading(true);
      const payload = await api("/bookings/business");
      const nextBookings = payload.data.bookings || [];
      setBookings(nextBookings);
      if (selectedBooking) {
        const refreshed = nextBookings.find((item) => item.id === selectedBooking.id);
        setSelectedBooking(refreshed || null);
      }
    } catch (error) {
      onError(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadBusiness() {
    try {
      const payload = await api("/businesses/mine");
      const nextBusiness = payload.data.business || null;
      setBusiness(nextBusiness);
      const nextServices = Array.isArray(nextBusiness?.services) ? nextBusiness.services.filter(Boolean) : [];
      setSelectedServiceId(nextServices[0]?.id ?? null);
    } catch (error) {
      onError(error);
    }
  }

  async function loadNotifications({ silent = false } = {}) {
    try {
      if (!silent) {
        setLoadingNotifications(true);
      }
      const payload = await api("/notifications");
      const nextNotifications = payload.data.notifications || [];
      setNotifications(nextNotifications);
      setUnreadCount(payload.data.unread_count || 0);
      return nextNotifications;
    } catch (error) {
      if (!silent) {
        onError(error);
      }
      return [];
    } finally {
      if (!silent) {
        setLoadingNotifications(false);
      }
    }
  }

  async function openNotifications() {
    setNotificationsVisible(true);
    const nextNotifications = await loadNotifications();
    const unread = nextNotifications.filter((item) => !item.is_read);
    if (!unread.length) return;

    try {
      await Promise.all(unread.map((item) => api(`/notifications/${item.id}/read`, { method: "PATCH", body: {} })));
      await loadNotifications({ silent: true });
    } catch (_error) {
      // The business owner can still read the alerts even if read receipts fail.
    }
  }

  async function openNotificationBooking(notification) {
    if (!notification?.booking_id) return;
    try {
      const payload = await api("/bookings/business");
      const booking = (payload.data.bookings || []).find((item) => item.id === notification.booking_id);
      if (!booking) {
        onError(new Error("That booking could not be found right now."));
        return;
      }
      setNotificationsVisible(false);
      setSelectedBooking(booking);
    } catch (error) {
      onError(error);
    }
  }

  async function loadAvailability() {
    if (!business?.id) return;
    try {
      setLoadingAvailability(true);
      const serviceQuery = selectedServiceId ? `&service_id=${selectedServiceId}` : "";
      const payload = await api(`/businesses/${business.id}/slots?date=${date}&all=true${serviceQuery}`);
      setAvailabilitySlots(payload.data.slots || []);
    } catch (error) {
      onError(error);
    } finally {
      setLoadingAvailability(false);
    }
  }

  async function updateBookingStatus(bookingId, status) {
    try {
      const payload = await api(`/bookings/${bookingId}/status`, { method: "PATCH", body: { status } });
      setSelectedBooking(payload.data.booking);
      await loadBookings();
    } catch (error) {
      onError(error);
    }
  }

  async function cancelBooking(bookingId) {
    try {
      const payload = await api(`/bookings/${bookingId}/cancel`, { method: "PATCH", body: {} });
      setSelectedBooking(payload.data.booking);
      await loadBookings();
    } catch (error) {
      onError(error);
    }
  }

  async function saveBookingNotes(bookingId, notes) {
    try {
      const payload = await api(`/bookings/${bookingId}/notes`, { method: "PATCH", body: { notes } });
      const updatedBooking = payload.data.booking;
      setSelectedBooking(updatedBooking);
      await loadBookings();
      return updatedBooking;
    } catch (error) {
      onError(error);
      return null;
    }
  }

  async function rescheduleBooking(bookingId, body) {
    try {
      const payload = await api(`/bookings/${bookingId}/reschedule`, { method: "PATCH", body });
      const updatedBooking = payload.data.booking;
      setSelectedBooking(updatedBooking);
      await loadBookings();
      return updatedBooking;
    } catch (error) {
      onError(error);
      return null;
    }
  }

  async function blockBookingCustomer(bookingId) {
    try {
      const targetBooking = bookings.find((item) => item.id === bookingId) || selectedBooking;
      const method = targetBooking?.customer_is_blocked ? "DELETE" : "POST";
      const payload = await api(`/bookings/${bookingId}/block-user`, { method, body: method === "POST" ? {} : undefined });
      const nextBooking = payload.data.booking || null;
      if (nextBooking) {
        setSelectedBooking(nextBooking);
      }
      await loadBookings();
      return nextBooking;
    } catch (error) {
      onError(error);
      return null;
    }
  }

  function selectedDateObject() {
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function handleDateChange(event, pickedDate) {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }
    if (event?.type === "dismissed" || !pickedDate) return;
    setDate(toLocalISODate(pickedDate));
  }

  function renderAvailableTab() {
    return (
      <>
        <Card style={screenStyles.availabilityCard}>
          <Text style={screenStyles.availabilityTitle}>Check available slots</Text>
          <Pressable style={({ pressed }) => [styles.datePickerButton, pressed && styles.pressed]} onPress={() => setShowDatePicker(true)}>
            <View style={styles.datePickerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Selected date</Text>
                <Text style={styles.datePickerText}>{formatDate(date)}</Text>
                <Text style={styles.datePickerHint}>Tap to choose another day</Text>
              </View>
              <View style={styles.calendarBadge}>
                <Ionicons color={COLORS.accent} name="calendar-outline" size={20} style={styles.calendarBadgeIcon} />
              </View>
            </View>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              display={Platform.OS === "ios" ? "inline" : "calendar"}
              mode="date"
              onChange={handleDateChange}
              value={selectedDateObject()}
            />
          ) : null}
          {services.length ? (
            <>
              <Text style={[styles.label, { marginTop: 12 }]}>Service</Text>
              <View style={screenStyles.serviceGrid}>
                {services.map((service) => (
                  <Chip
                    key={service.id ?? service.name}
                    label={service.name}
                    active={selectedServiceId === service.id}
                    style={screenStyles.serviceChip}
                    onPress={() => setSelectedServiceId(service.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </Card>

        <Card>
          <Text style={screenStyles.availabilityTitle}>Available slots</Text>
          {loadingAvailability ? (
            <EmptyState>Checking available slots...</EmptyState>
          ) : visibleAvailabilitySlots.length ? (
            <View style={screenStyles.availableSlotGrid}>
              {visibleAvailabilitySlots.map((slot) => (
                <View key={`available-${slot.id}`} style={screenStyles.availableSlotTile}>
                  <Text style={screenStyles.availableSlotTime}>{formatTime(slot.start_time)}</Text>
                  <Text style={screenStyles.availableSlotStatus}>Available</Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState>No available slots on {formatDate(date)}.</EmptyState>
          )}
        </Card>
      </>
    );
  }

  if (selectedBooking) {
    return (
      <BusinessBookingDetailsScreen
        booking={selectedBooking}
        onBack={() => setSelectedBooking(null)}
        onError={onError}
        onConfirmBooking={(booking) => updateBookingStatus(booking.id, "confirmed")}
        onCancelBooking={(booking) => cancelBooking(booking.id)}
        onCompleteBooking={(booking) => updateBookingStatus(booking.id, "completed")}
        onSaveNotes={(booking, notes) => saveBookingNotes(booking.id, notes)}
        onRescheduleBooking={(booking, body) => rescheduleBooking(booking.id, body)}
        onBlockUser={(booking) => blockBookingCustomer(booking.id)}
      />
    );
  }

  return (
    <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />}>
      <View style={screenStyles.headerRow}>
        <IconButton accessibilityLabel="Menu" color={COLORS.text} name="menu-outline" size={20} onPress={() => onTabChange("dashboard")} />
        <Text style={screenStyles.headerTitle}>Bookings</Text>
        <View style={screenStyles.notificationButtonWrap}>
          <IconButton accessibilityLabel="Notifications" color={COLORS.text} name="notifications-outline" size={20} onPress={openNotifications} />
          {unreadCount ? (
            <View style={screenStyles.notificationDot}>
              <Text style={screenStyles.notificationDotText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={screenStyles.segmentedTabs}>
        {bookingTabs.map((tab) => {
          const active = activeBookingTab === tab.key;
          return (
            <Pressable key={tab.key} style={screenStyles.segmentTab} onPress={() => setActiveBookingTab(tab.key)}>
              <Text style={[screenStyles.segmentLabel, active && screenStyles.segmentLabelActive]}>{tab.label}</Text>
              {active ? <View style={screenStyles.segmentUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={screenStyles.sectionHeader}>
        <Text style={screenStyles.sectionTitle}>
          {activeBookingTab === "available"
            ? "Available Slots"
            : `${bookingTabs.find((item) => item.key === activeBookingTab)?.label} Bookings (${currentBookings.length})`}
        </Text>
      </View>

      {activeBookingTab !== "available" && loading ? <EmptyState>Loading bookings...</EmptyState> : null}

      {activeBookingTab === "available" ? renderAvailableTab() : null}

      {activeBookingTab !== "available" && !loading && currentBookings.length ? (
        <>
          {currentBookings.map((booking) => (
            <BusinessBookingCard key={booking.id} booking={booking} onPress={setSelectedBooking} />
          ))}
          <Pressable style={({ pressed }) => [screenStyles.viewAllButton, pressed && screenStyles.pressed]} onPress={loadBookings}>
            <Text style={screenStyles.viewAllText}>
              {`View All ${bookingTabs.find((item) => item.key === activeBookingTab)?.label}`}
            </Text>
          </Pressable>
        </>
      ) : null}

      {activeBookingTab !== "available" && !loading && !currentBookings.length ? (
        <EmptyState>{`No ${activeBookingTab} bookings yet.`}</EmptyState>
      ) : null}

      <Modal animationType="slide" transparent visible={notificationsVisible} onRequestClose={() => setNotificationsVisible(false)}>
        <View style={screenStyles.notificationBackdrop}>
          <Pressable style={screenStyles.notificationDismissArea} onPress={() => setNotificationsVisible(false)} />
          <View style={screenStyles.notificationSheet}>
            <View style={screenStyles.sheetHandle} />
            <View style={screenStyles.notificationHeader}>
              <Text style={screenStyles.notificationTitle}>Booking alerts</Text>
              <Pressable style={({ pressed }) => [screenStyles.closeButton, pressed && styles.pressed]} onPress={() => setNotificationsVisible(false)}>
                <Text style={screenStyles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
            {loadingNotifications ? (
              <View style={screenStyles.notificationLoading}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={screenStyles.notificationMuted}>Loading alerts...</Text>
              </View>
            ) : null}
            {!loadingNotifications && notifications.length ? (
              <FlatList
                data={notifications}
                keyExtractor={(item) => String(item.id)}
                style={screenStyles.notificationList}
                renderItem={({ item }) => {
                  const tone = getNotificationTone(item.type);
                  const clickable = Boolean(item.booking_id);
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        screenStyles.notificationItem,
                        { borderLeftColor: tone.borderColor },
                        clickable && screenStyles.notificationPressable,
                        pressed && clickable && screenStyles.pressed
                      ]}
                      disabled={!clickable}
                      onPress={() => openNotificationBooking(item)}
                    >
                      <View style={[screenStyles.notificationIcon, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
                        <Ionicons color={item.is_read ? COLORS.light : tone.color} name={tone.icon} size={17} />
                      </View>
                      <View style={screenStyles.notificationContent}>
                        <Text style={screenStyles.notificationItemTitle}>{item.title}</Text>
                        <Text style={screenStyles.notificationItemMessage}>{item.message}</Text>
                      </View>
                      {clickable ? <Text style={screenStyles.notificationChevron}>›</Text> : null}
                    </Pressable>
                  );
                }}
              />
            ) : null}
            {!loadingNotifications && !notifications.length ? <Text style={screenStyles.notificationMuted}>No booking alerts yet.</Text> : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const screenStyles = StyleSheet.create({
  pressed: {
    opacity: 0.82
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14
  },
  notificationButtonWrap: {
    position: "relative"
  },
  notificationDot: {
    alignItems: "center",
    backgroundColor: "#E25757",
    borderRadius: 999,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 2,
    position: "absolute",
    right: -2,
    top: -2
  },
  notificationDotText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900"
  },
  headerTitle: {
    color: COLORS.text,
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center"
  },
  segmentedTabs: {
    borderBottomColor: "#E8EDF4",
    borderBottomWidth: 1,
    flexDirection: "row",
    marginBottom: 18
  },
  segmentTab: {
    alignItems: "center",
    flex: 1,
    paddingBottom: 10,
    paddingTop: 2
  },
  segmentLabel: {
    color: "#7C8798",
    fontSize: 14,
    fontWeight: "700"
  },
  segmentLabelActive: {
    color: "#1E2E4A"
  },
  segmentUnderline: {
    backgroundColor: "#2D4262",
    borderRadius: 999,
    bottom: -11,
    height: 3,
    position: "absolute",
    width: 92
  },
  sectionHeader: {
    marginBottom: 12
  },
  sectionTitle: {
    color: "#1E2E4A",
    fontSize: 20,
    fontWeight: "800"
  },
  availabilityCard: {
    marginBottom: 12
  },
  availabilityTitle: {
    color: "#23324B",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12
  },
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  serviceChip: {
    minHeight: 38
  },
  availableSlotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10
  },
  availableSlotTile: {
    backgroundColor: "#DDEFE3",
    borderColor: "#8EB89A",
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 72,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: "31.5%"
  },
  availableSlotTime: {
    color: "#2F6B43",
    fontSize: 15,
    fontWeight: "900"
  },
  availableSlotStatus: {
    color: "#2F6B43",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 7,
    textTransform: "uppercase"
  },
  viewAllButton: {
    alignItems: "center",
    borderColor: "#EEF2F6",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 2,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  viewAllText: {
    color: "#23324B",
    fontSize: 15,
    fontWeight: "800"
  },
  closeButton: {
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  closeButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "900"
  },
  notificationBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.22)",
    flex: 1,
    justifyContent: "flex-end"
  },
  notificationDismissArea: {
    flex: 1
  },
  notificationSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 10
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#D6DEE8",
    borderRadius: 999,
    height: 4,
    marginBottom: 14,
    width: 42
  },
  notificationHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  notificationTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900"
  },
  notificationLoading: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 20
  },
  notificationMuted: {
    color: COLORS.light,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 16,
    textAlign: "center"
  },
  notificationList: {
    maxHeight: 420
  },
  notificationItem: {
    alignItems: "center",
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    flexDirection: "row",
    gap: 12,
    paddingLeft: 10,
    paddingVertical: 12
  },
  notificationIcon: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  notificationContent: {
    flex: 1,
    gap: 4
  },
  notificationItemTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900"
  },
  notificationItemMessage: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  notificationPressable: {
    paddingRight: 6
  },
  notificationChevron: {
    color: COLORS.light,
    fontSize: 24,
    fontWeight: "700",
    marginLeft: 6
  }
});
