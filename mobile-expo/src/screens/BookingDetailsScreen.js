import React, { useEffect, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../api/client";
import { COLORS } from "../constants";
import { AppButton, BodyText, Card, IconButton, Screen, StatusBadge, styles } from "../components/ui";
import { formatDate, formatTime } from "../utils/format";

const REPORT_OPTIONS = [
  "Service was not good",
  "Booking got cancelled",
  "Wrong service details",
  "Slot timing issue",
  "Staff behavior issue"
];

function formatAmount(symbol, value) {
  if (value === null || value === undefined || value === "") return `${symbol || "₹"} 0`;
  return `${symbol || "₹"} ${Number(value).toLocaleString()}`;
}

function DetailRow({ icon, label, value }) {
  return (
    <View style={screenStyles.detailRow}>
      <View style={screenStyles.detailLabelWrap}>
        <Ionicons color={COLORS.light} name={icon} size={17} />
        <Text style={screenStyles.detailLabel}>{label}</Text>
      </View>
      <Text style={screenStyles.detailValue}>{value || "-"}</Text>
    </View>
  );
}

export function BookingDetailsScreen({ booking, onBack, onCancel, onError }) {
  const [businessContact, setBusinessContact] = useState({
    name: booking?.business_name || "",
    phone: booking?.business_phone || booking?.phone || "",
    location: booking?.business_location || booking?.location || "",
    loading: false
  });
  const [reportVisible, setReportVisible] = useState(false);
  const [reportChoices, setReportChoices] = useState([]);
  const [reportNotes, setReportNotes] = useState("");

  useEffect(() => {
    let isActive = true;
    const initialContact = {
      name: booking?.business_name || "",
      phone: booking?.business_phone || booking?.phone || "",
      location: booking?.business_location || booking?.location || "",
      loading: false
    };

    setBusinessContact({
      name: initialContact.name,
      phone: initialContact.phone,
      location: initialContact.location,
      loading: false
    });

    if (!initialContact.phone && (booking?.business_id || booking?.business_name)) {
      loadBusinessContact(booking, isActive);
    }

    return () => {
      isActive = false;
    };
  }, [
    booking?.business_id,
    booking?.business_location,
    booking?.business_name,
    booking?.business_phone,
    booking?.id,
    booking?.phone
  ]);

  async function loadBusinessContact(sourceBooking, isActive) {
    try {
      setBusinessContact((current) => ({ ...current, loading: true }));
      let business = null;

      if (sourceBooking?.business_id) {
        const payload = await api(`/businesses/${sourceBooking.business_id}`);
        business = payload?.data?.business || payload?.business || null;
      }

      if (!business && sourceBooking?.business_name) {
        const search = encodeURIComponent(sourceBooking.business_name);
        const payload = await api(`/businesses?search=${search}`);
        const businesses = payload?.data?.businesses || payload?.businesses || [];
        business = businesses.find((item) => String(item.name || "").toLowerCase() === String(sourceBooking.business_name).toLowerCase()) || businesses[0] || null;
      }

      if (!isActive) return;
      setBusinessContact({
        name: business?.name || sourceBooking?.business_name || "",
        phone: business?.phone || "",
        location: business?.location || sourceBooking?.business_location || sourceBooking?.location || "",
        loading: false
      });
    } catch (_error) {
      // Older booking payloads can still open; contact stays unavailable if lookup fails.
      if (isActive) {
        setBusinessContact((current) => ({ ...current, loading: false }));
      }
    }
  }

  const businessPhone = businessContact.phone || "";
  const businessName = booking?.business_name || businessContact.name || booking?.service_name || "Business";
  const businessLocation = businessContact.location || booking?.business_location || booking?.location || "";

  async function contactBusiness() {
    const phone = businessPhone;
    if (!phone) {
      onError?.(new Error("Business phone number is not available."));
      return;
    }
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch (_error) {
      onError?.(new Error("Call could not be started right now."));
    }
  }

  function toggleReportChoice(option) {
    setReportChoices((current) => (
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
    ));
  }

  async function submitReport() {
    const notes = reportNotes.trim();
    if (!reportChoices.length && !notes) {
      onError?.(new Error("Please select an issue or write a short note."));
      return;
    }

    try {
      await api(`/bookings/${booking?.id}/report-issue`, {
        method: "POST",
        body: {
          reasons: reportChoices,
          notes
        }
      });
      setReportVisible(false);
      setReportChoices([]);
      setReportNotes("");
      onError?.(new Error("Issue sent to the business owner."));
    } catch (error) {
      onError?.(error);
    }
  }

  const isUpcoming = !["completed", "cancelled"].includes(String(booking?.status || "").toLowerCase());
  const durationText = booking?.booking_type === "daily"
    ? `${booking?.duration_days || 1} day${(booking?.duration_days || 1) > 1 ? "s" : ""}`
    : `${booking?.duration_hours || 1} hour${(booking?.duration_hours || 1) > 1 ? "s" : ""}`;
  const timeText = booking?.booking_type === "daily"
    ? "Daily booking"
    : `${formatTime(booking?.start_time)} → ${formatTime(booking?.end_time)}`;

  return (
    <Screen>
      <View style={screenStyles.headerRow}>
        <IconButton accessibilityLabel="Back" color={COLORS.text} name="arrow-back-outline" size={20} onPress={onBack} />
        <Text style={screenStyles.headerTitle}>Booking Details</Text>
        <View style={screenStyles.headerSpacer} />
      </View>

      <Card>
        <View style={screenStyles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={screenStyles.businessName}>{booking?.business_name || booking?.service_name || "Booking"}</Text>
            <Text style={screenStyles.bookingId}>#{booking?.booking_id || booking?.id}</Text>
          </View>
          <StatusBadge status={String(booking?.status || "confirmed").toLowerCase()} />
        </View>
      </Card>

      <Card>
        <Text style={screenStyles.sectionTitle}>Booking Info</Text>
        <DetailRow icon="calendar-outline" label="Date" value={formatDate(booking?.slot_date)} />
        <DetailRow icon="time-outline" label="Time" value={timeText} />
        <DetailRow icon="hourglass-outline" label="Duration" value={durationText} />
        <DetailRow icon="cash-outline" label="Total Price" value={formatAmount(booking?.currency_symbol, booking?.total_price)} />
      </Card>

      <Card>
        <Text style={screenStyles.sectionTitle}>Business Info</Text>
        <DetailRow icon="business-outline" label="Business" value={businessName} />
        <DetailRow icon="construct-outline" label="Service" value={booking?.service_name} />
        <DetailRow icon="location-outline" label="Location" value={businessLocation} />
        <DetailRow icon="call-outline" label="Phone" value={businessPhone || (businessContact.loading ? "Loading..." : "Not available")} />
        {businessPhone ? <AppButton variant="secondary" style={screenStyles.callButton} onPress={contactBusiness}>Contact Business</AppButton> : null}
      </Card>

      {booking?.notes ? (
        <Card>
          <Text style={screenStyles.sectionTitle}>Notes</Text>
          <BodyText>{booking.notes}</BodyText>
        </Card>
      ) : null}

      {isUpcoming ? (
        <View style={screenStyles.actionsWrap}>
          <AppButton variant="danger" onPress={() => onCancel?.(booking?.id)}>Cancel Booking</AppButton>
          <AppButton variant="secondary" style={screenStyles.reportButton} onPress={() => setReportVisible(true)}>Report Issue</AppButton>
        </View>
      ) : null}

      <Modal animationType="slide" transparent visible={reportVisible} onRequestClose={() => setReportVisible(false)}>
        <View style={screenStyles.modalBackdrop}>
          <Pressable style={screenStyles.modalDismissArea} onPress={() => setReportVisible(false)} />
          <View style={screenStyles.sheetCard}>
            <View style={screenStyles.sheetHandle} />
            <Text style={screenStyles.sheetTitle}>Report issue</Text>
            <Text style={screenStyles.sheetSubtitle}>Tick the issues that match your experience, or write your own details below.</Text>
            <View style={screenStyles.reportOptionsWrap}>
              {REPORT_OPTIONS.map((option) => {
                const active = reportChoices.includes(option);
                return (
                  <Pressable
                    key={option}
                    style={({ pressed }) => [
                      screenStyles.reportOptionRow,
                      active && screenStyles.reportOptionRowActive,
                      pressed && styles.pressed
                    ]}
                    onPress={() => toggleReportChoice(option)}
                  >
                    <Ionicons
                      color={active ? COLORS.accent : COLORS.light}
                      name={active ? "checkbox-outline" : "square-outline"}
                      size={20}
                    />
                    <Text style={screenStyles.reportOptionText}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              multiline
              numberOfLines={5}
              placeholder="Write more details if your issue is not listed above."
              placeholderTextColor={COLORS.light}
              style={screenStyles.reportInput}
              textAlignVertical="top"
              value={reportNotes}
              onChangeText={setReportNotes}
            />
            <View style={screenStyles.sheetActions}>
              <AppButton variant="secondary" style={screenStyles.sheetButton} onPress={() => setReportVisible(false)}>Cancel</AppButton>
              <AppButton style={screenStyles.sheetButton} onPress={submitReport}>Submit</AppButton>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const screenStyles = StyleSheet.create({
  actionsWrap: {
    marginTop: 8
  },
  bookingId: {
    color: COLORS.light,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4
  },
  businessName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900"
  },
  callButton: {
    marginTop: 12
  },
  modalBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.24)",
    flex: 1,
    justifyContent: "flex-end"
  },
  modalDismissArea: {
    flex: 1
  },
  reportButton: {
    marginTop: 10
  },
  reportInput: {
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    minHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 14
  },
  reportOptionRow: {
    alignItems: "center",
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  reportOptionRowActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent
  },
  reportOptionText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  reportOptionsWrap: {
    gap: 8,
    marginTop: 4
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  sheetButton: {
    flex: 1
  },
  sheetCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 22,
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
  sheetSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 14,
    marginTop: 6
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  detailLabel: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  detailLabelWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  detailRow: {
    gap: 10,
    paddingVertical: 10
  },
  detailValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700"
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  headerSpacer: {
    width: 40
  },
  headerTitle: {
    color: COLORS.text,
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center"
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8
  },
  topRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  }
});
