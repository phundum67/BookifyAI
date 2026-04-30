import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Award,
  Briefcase,
  Calendar,
  CalendarCheck,
  Clock3,
  IndianRupee,
  Star
} from "lucide-react-native";

import { api } from "../api/client";
import { BottomTabs, BusinessBookingCard, Card, CustomerAvatar, Screen, SectionTitle, Title, styles } from "../components/ui";
import { BusinessBookingDetailsScreen } from "./BusinessBookingDetailsScreen";
import { BusinessSlotAvailabilityScreen } from "./BusinessSlotAvailabilityScreen";
import { formatDate, formatPrice, formatTime } from "../utils/format";

const ICON_COLOR = "#4B5563";
const ICON_BG = "#E5E7EB";

const tabs = [
  { label: "Dashboard", value: "dashboard" },
  { label: "Bookings", value: "bookings" },
  { label: "Slots", value: "slots" },
  { label: "Settings", value: "settings" }
];

function DashboardIcon({ icon: Icon, size = 22, muted = false }) {
  if (muted) {
    return <Icon color="#999999" size={size} strokeWidth={2} />;
  }

  return (
    <View style={screenStyles.iconCircle}>
      <Icon color={ICON_COLOR} size={size} strokeWidth={2} />
    </View>
  );
}

function QuickActionButton({ icon: Icon, label, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, styles.secondaryButton, screenStyles.quickActionButton, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={screenStyles.quickActionContent}>
        <DashboardIcon icon={Icon} size={20} />
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function DashboardEmptyState() {
  return (
    <Card style={screenStyles.emptyCard}>
      <DashboardIcon icon={Calendar} muted />
      <Text style={screenStyles.emptyTitle}>No recent bookings yet.</Text>
    </Card>
  );
}

export function BusinessDashboardScreen({ activeTab, onOpenProfile, onTabChange, onError }) {
  const [summary, setSummary] = useState(null);
  const [business, setBusiness] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showSlotAvailability, setShowSlotAvailability] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab !== "dashboard") return;
    loadDashboard();
  }, [activeTab]);

  async function loadDashboard() {
    try {
      const payload = await api("/dashboard/summary");
      setSummary(payload.data.summary);
      setBusiness(payload.data.business);
    } catch (error) {
      onError(error);
    }
  }

  async function updateBookingStatus(bookingId, status) {
    try {
      const payload = await api(`/bookings/${bookingId}/status`, { method: "PATCH", body: { status } });
      const updatedBooking = payload.data.booking;
      setSelectedBooking(updatedBooking);
      await loadDashboard();
      return updatedBooking;
    } catch (error) {
      onError(error);
      return null;
    }
  }

  async function cancelBooking(bookingId) {
    try {
      const payload = await api(`/bookings/${bookingId}/cancel`, { method: "PATCH", body: {} });
      const updatedBooking = payload.data.booking;
      setSelectedBooking(updatedBooking);
      await loadDashboard();
      return updatedBooking;
    } catch (error) {
      onError(error);
      return null;
    }
  }

  async function saveBookingNotes(bookingId, notes) {
    try {
      const payload = await api(`/bookings/${bookingId}/notes`, { method: "PATCH", body: { notes } });
      const updatedBooking = payload.data.booking;
      setSelectedBooking(updatedBooking);
      await loadDashboard();
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
      await loadDashboard();
      return updatedBooking;
    } catch (error) {
      onError(error);
      return null;
    }
  }

  async function blockBookingCustomer(bookingId) {
    try {
      const targetBooking = selectedBooking || summary?.recent_bookings?.find((item) => item.id === bookingId) || summary?.next_upcoming_booking;
      const method = targetBooking?.customer_is_blocked ? "DELETE" : "POST";
      const payload = await api(`/bookings/${bookingId}/block-user`, { method, body: method === "POST" ? {} : undefined });
      const updatedBooking = payload.data.booking || null;
      if (updatedBooking) {
        setSelectedBooking(updatedBooking);
      }
      await loadDashboard();
      return updatedBooking;
    } catch (error) {
      onError(error);
      return null;
    }
  }

  if (!summary) {
    return (
      <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />}>
        <Title eyebrow="Business">Dashboard</Title>
        <Card>
          <Text style={styles.businessName}>Create your business profile first.</Text>
          <Text style={[styles.businessLocation, { marginVertical: 10 }]}>Your dashboard appears after profile setup.</Text>
          <Pressable
            style={({ pressed }) => [styles.button, styles.primaryButton, screenStyles.createProfileButton, pressed && styles.pressed]}
            onPress={onOpenProfile}
          >
            <Text style={[styles.buttonText, styles.primaryButtonText]}>Create profile</Text>
          </Pressable>
        </Card>
      </Screen>
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

  if (showSlotAvailability) {
    return <BusinessSlotAvailabilityScreen business={business} onBack={() => setShowSlotAvailability(false)} onError={onError} />;
  }

  const next = summary.next_upcoming_booking;
  const stats = [
    { label: "Today", value: summary.todays_booking_count, icon: CalendarCheck },
    { label: "Total", value: summary.total_bookings, icon: Briefcase },
    { label: "Reviews", value: summary.total_reviews, icon: Star },
    { label: "Rating", value: summary.average_rating || 0, icon: Award },
    { label: "Earnings", value: formatPrice(business, summary.estimated_earnings || 0), icon: IndianRupee },
    { label: "Recent", value: (summary.recent_bookings || []).length, icon: Clock3 }
  ];

  return (
    <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />}>
      <Title eyebrow="Business">Dashboard</Title>
      <Card>
        {next ? (
          <Pressable
            accessibilityLabel="Open next booking details"
            style={({ pressed }) => [screenStyles.nextBookingCardButton, pressed && styles.pressed]}
            onPress={() => setSelectedBooking(next)}
          >
            <View style={screenStyles.nextBookingHeader}>
              <DashboardIcon icon={CalendarCheck} />
              <Text style={styles.eyebrow}>Next booking</Text>
              <Text style={screenStyles.nextBookingLink}>View details</Text>
            </View>
            <View style={screenStyles.nextCustomerRow}>
              <CustomerAvatar name={next.customer_name} size={34} uri={next.customer_profile_image} />
              <View style={screenStyles.nextCustomerText}>
                <Text style={screenStyles.nextCustomerName} numberOfLines={1}>{next.customer_name}</Text>
                <Text style={screenStyles.nextCustomerMeta} numberOfLines={1}>
                  {formatDate(next.slot_date)} - {formatTime(next.start_time)} to {formatTime(next.end_time)}
                </Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <>
            <View style={screenStyles.nextBookingHeader}>
              <DashboardIcon icon={CalendarCheck} />
              <Text style={styles.eyebrow}>Next booking</Text>
            </View>
            <Text style={[styles.businessLocation, { marginTop: 8 }]}>No upcoming bookings yet.</Text>
          </>
        )}
      </Card>
      <View style={screenStyles.statsGrid}>
        {stats.map(({ label, value, icon }) => (
          <View key={label} style={[styles.card, screenStyles.statCard]}>
            <DashboardIcon icon={icon} />
            <View style={screenStyles.statTextBlock}>
              <Text numberOfLines={1} style={screenStyles.statValue}>{value}</Text>
              <Text numberOfLines={1} style={screenStyles.statLabel}>{label}</Text>
            </View>
          </View>
        ))}
      </View>
      <SectionTitle>Quick actions</SectionTitle>
      <View style={screenStyles.quickActionsRow}>
        <QuickActionButton icon={Calendar} label="Check Slots" onPress={() => setShowSlotAvailability(true)} />
        <QuickActionButton icon={CalendarCheck} label="Manage Slots" onPress={() => onTabChange("slots")} />
      </View>
      <SectionTitle action={
        <Pressable style={({ pressed }) => [screenStyles.viewAllLink, pressed && styles.pressed]} onPress={() => onTabChange("bookings")}>
          <Text style={screenStyles.viewAllLinkText}>View all</Text>
        </Pressable>
      }>Recent bookings</SectionTitle>
      {summary.recent_bookings?.length
        ? summary.recent_bookings.map((booking) => (
          <BusinessBookingCard key={booking.id} booking={booking} onPress={setSelectedBooking} />
        ))
        : <DashboardEmptyState />}
    </Screen>
  );
}

const screenStyles = StyleSheet.create({
  createProfileButton: {
    alignSelf: "flex-start"
  },
  emptyCard: {
    alignItems: "center",
    gap: 10
  },
  emptyTitle: {
    color: "#999999",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: ICON_BG,
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  nextBookingCardButton: {
    gap: 8
  },
  nextBookingHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  nextBookingLink: {
    color: ICON_COLOR,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: "auto"
  },
  nextCustomerMeta: {
    color: "#667085",
    fontSize: 14,
    fontWeight: "600"
  },
  nextCustomerName: {
    color: "#111111",
    fontSize: 22,
    fontWeight: "900"
  },
  nextCustomerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 8
  },
  nextCustomerText: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minWidth: 0
  },
  quickActionButton: {
    flex: 1
  },
  quickActionContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "center"
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14
  },
  viewAllLink: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  viewAllLinkText: {
    color: ICON_COLOR,
    fontSize: 14,
    fontWeight: "800"
  },
  statCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    minWidth: 0,
    width: "48.5%"
  },
  statLabel: {
    color: "#555555",
    fontSize: 14,
    fontWeight: "600"
  },
  statTextBlock: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0
  },
  statValue: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "900"
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14
  }
});
