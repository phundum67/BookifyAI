import React, { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { api } from "../api/client";
import { COLORS } from "../constants";
import { AppButton, Card, CustomerAvatar, IconButton, Screen } from "../components/ui";
import { formatDate, formatTime, toLocalISODate } from "../utils/format";

const STATUS_STYLES = {
  confirmed: { backgroundColor: "#E8F7EC", color: "#22A35A", label: "Confirmed" },
  pending: { backgroundColor: "#FFF4DD", color: "#E39A12", label: "Pending" },
  completed: { backgroundColor: "#EAF8EF", color: "#56AF74", label: "Completed" },
  cancelled: { backgroundColor: "#FEECEC", color: "#E25757", label: "Cancelled" }
};

function formatAmount(symbol, value) {
  if (value === null || value === undefined || value === "") return `${symbol || "₹"} 0`;
  return `${symbol || "₹"} ${Number(value).toLocaleString()}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const normalized = typeof value === "string" && !/[zZ]|[+\-]\d{2}:\d{2}$/.test(value)
    ? `${value}Z`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function buildTimeline(booking) {
  const items = [
    {
      key: "created",
      label: "Booking Created",
      time: formatDateTime(booking.created_at),
      icon: "checkmark-circle-outline",
      tone: "#56AF74"
    }
  ];

  if (booking.confirmed_at || booking.status === "confirmed" || booking.status === "completed") {
    items.push({
      key: "confirmed",
      label: "Booking Confirmed",
      time: formatDateTime(booking.confirmed_at || booking.created_at),
      icon: "checkmark-circle",
      tone: "#22A35A"
    });
  }

  if (booking.status === "completed") {
    items.push({
      key: "completed",
      label: "Completed",
      time: formatDateTime(booking.completed_at || booking.updated_at || booking.created_at),
      icon: "flag-outline",
      tone: "#4B83F5"
    });
  } else if (booking.status === "cancelled") {
    items.push({
      key: "cancelled",
      label: "Cancelled",
      time: formatDateTime(booking.cancelled_at || booking.updated_at || booking.created_at),
      icon: "close-circle-outline",
      tone: "#E25757"
    });
  } else {
    items.push({
      key: "upcoming",
      label: "Upcoming",
      time: `${formatDate(booking.slot_date)}, ${formatTime(booking.start_time)}`,
      icon: "ellipse",
      tone: "#22A35A"
    });
  }

  return items;
}

function defaultReschedulePayload(booking) {
  return {
    slot_date: booking.slot_date || toLocalISODate(new Date()),
    duration_hours: booking.duration_hours || 1,
    duration_days: booking.duration_days || 1
  };
}

function BookingStatusBadge({ status }) {
  const normalized = (status || "confirmed").toLowerCase();
  const style = STATUS_STYLES[normalized] || STATUS_STYLES.confirmed;

  return (
    <View style={[screenStyles.statusBadge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[screenStyles.statusBadgeText, { color: style.color }]}>{style.label}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value, multiline }) {
  return (
    <View style={[screenStyles.detailRow, multiline && screenStyles.detailRowTop]}>
      <View style={screenStyles.detailLabelWrap}>
        <Ionicons color="#6D7A90" name={icon} size={18} />
        <Text style={screenStyles.detailLabel}>{label}</Text>
      </View>
      <Text style={[screenStyles.detailValue, multiline && screenStyles.detailValueMultiline]}>{value}</Text>
    </View>
  );
}

function ActionTile({ label, color, fill, icon, onPress, disabled }) {
  return (
    <Pressable
      style={({ pressed }) => [
        screenStyles.actionTile,
        fill ? { backgroundColor: fill, borderColor: fill } : { backgroundColor: COLORS.surface, borderColor: COLORS.border },
        disabled && screenStyles.actionTileDisabled,
        pressed && !disabled && screenStyles.pressed
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Ionicons color={color} name={icon} size={18} />
      <Text style={[screenStyles.actionTileText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function BusinessBookingDetailsScreen({
  booking,
  onBack,
  onError,
  onConfirmBooking,
  onCancelBooking,
  onCompleteBooking,
  onSaveNotes,
  onRescheduleBooking,
  onBlockUser
}) {
  const timeline = buildTimeline(booking);
  const [menuVisible, setMenuVisible] = useState(false);
  const [notesVisible, setNotesVisible] = useState(false);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [blockUserVisible, setBlockUserVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notesDraft, setNotesDraft] = useState(booking.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [blockingUser, setBlockingUser] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotOptions, setSlotOptions] = useState([]);
  const [reschedulePayload, setReschedulePayload] = useState(() => defaultReschedulePayload(booking));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const detailDuration = booking.booking_type === "daily"
    ? `${booking.duration_days || 1} Day${(booking.duration_days || 1) > 1 ? "s" : ""}`
    : `${booking.duration_hours || 1} Hour${(booking.duration_hours || 1) > 1 ? "s" : ""}`;
  const isDailyBooking = (booking.booking_type || "hourly").toLowerCase() === "daily";

  const dailySummary = useMemo(() => {
    const totalDays = reschedulePayload.duration_days || booking.duration_days || 1;
    return `${totalDays} Day${totalDays > 1 ? "s" : ""}`;
  }, [booking.duration_days, reschedulePayload.duration_days]);

  useEffect(() => {
    setNotesDraft(booking.notes || "");
    setReschedulePayload(defaultReschedulePayload(booking));
    setSelectedSlot(null);
    setSlotOptions([]);
  }, [booking]);

  useEffect(() => {
    if (!rescheduleVisible || isDailyBooking) return undefined;
    loadAvailableSlots(reschedulePayload.slot_date);
    return undefined;
  }, [rescheduleVisible, isDailyBooking, reschedulePayload.slot_date, booking.id]);

  async function handleCallCustomer() {
    if (!booking.customer_phone) {
      onError?.(new Error("Customer phone number is not available."));
      return;
    }
    try {
      await Linking.openURL(`tel:${booking.customer_phone}`);
    } catch (_error) {
      onError?.(new Error("Call could not be started right now."));
    }
  }

  async function handleChatCustomer() {
    if (!booking.customer_phone) {
      onError?.(new Error("Customer phone number is not available."));
      return;
    }
    try {
      await Linking.openURL(`sms:${booking.customer_phone}`);
    } catch (_error) {
      onError?.(new Error("Chat could not be opened right now."));
    }
  }

  async function loadAvailableSlots(slotDate) {
    try {
      setLoadingSlots(true);
      const serviceQuery = booking.service_id ? `&service_id=${booking.service_id}` : "";
      const payload = await api(`/businesses/${booking.business_id}/slots?date=${slotDate}&all=true${serviceQuery}`);
      const nextSlots = Array.isArray(payload.data?.slots) ? payload.data.slots : [];
      const availableSlots = nextSlots.filter((slot) => slot.status === "available");

      if (slotDate === booking.slot_date) {
        const currentSlotExists = availableSlots.some((slot) => slot.start_time === booking.start_time && slot.end_time === booking.end_time);
        if (!currentSlotExists) {
          availableSlots.unshift({
            id: `current-${booking.id}`,
            start_time: booking.start_time,
            end_time: booking.end_time,
            status: "available",
            current_booking: true
          });
        }
      }

      setSlotOptions(availableSlots);
      setSelectedSlot((current) => {
        if (current && availableSlots.some((slot) => slot.start_time === current.start_time && slot.end_time === current.end_time)) {
          return current;
        }
        return availableSlots[0] || null;
      });
    } catch (error) {
      onError?.(error);
      setSlotOptions([]);
      setSelectedSlot(null);
    } finally {
      setLoadingSlots(false);
    }
  }

  function openNotesSheet() {
    setMenuVisible(false);
    setNotesDraft(booking.notes || "");
    setNotesVisible(true);
  }

  function openRescheduleSheet() {
    setMenuVisible(false);
    const nextPayload = defaultReschedulePayload(booking);
    setReschedulePayload(nextPayload);
    setSelectedSlot(null);
    setRescheduleVisible(true);
  }

  async function handleSaveNotes() {
    if (!onSaveNotes) return;
    try {
      setSavingNotes(true);
      const updated = await onSaveNotes(booking, notesDraft);
      if (updated) {
        setNotesVisible(false);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleSaveReschedule() {
    if (!onRescheduleBooking) return;
    const body = isDailyBooking
      ? {
          slot_date: reschedulePayload.slot_date,
          duration_days: reschedulePayload.duration_days || booking.duration_days || 1
        }
      : {
          slot_date: reschedulePayload.slot_date,
          start_time: selectedSlot?.start_time,
          duration_hours: reschedulePayload.duration_hours || booking.duration_hours || 1
        };

    if (!isDailyBooking && !body.start_time) {
      onError?.(new Error("Please choose a time slot."));
      return;
    }

    try {
      setSavingReschedule(true);
      const updated = await onRescheduleBooking(booking, body);
      if (updated) {
        setRescheduleVisible(false);
      }
    } finally {
      setSavingReschedule(false);
    }
  }

  function handleBlockUser() {
    setMenuVisible(false);
    setBlockUserVisible(true);
  }

  async function confirmBlockUserAction() {
    if (!onBlockUser) return;
    try {
      setBlockingUser(true);
      const updated = await onBlockUser(booking);
      if (updated) {
        setBlockUserVisible(false);
      }
    } finally {
      setBlockingUser(false);
    }
  }

  function selectedDateObject() {
    const parsed = new Date(`${reschedulePayload.slot_date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function handleDateChange(event, pickedDate) {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }
    if (event?.type === "dismissed" || !pickedDate) return;
    setReschedulePayload((current) => ({
      ...current,
      slot_date: toLocalISODate(pickedDate)
    }));
    setSelectedSlot(null);
  }

  return (
    <Screen>
      <View style={screenStyles.headerRow}>
        <IconButton accessibilityLabel="Back" color={COLORS.text} name="arrow-back-outline" size={20} onPress={onBack} />
        <Text style={screenStyles.headerTitle}>Booking Details</Text>
        <IconButton accessibilityLabel="More" color={COLORS.text} name="ellipsis-vertical" size={18} onPress={() => setMenuVisible(true)} />
      </View>

      <Card style={screenStyles.detailIntroCard}>
        <View style={screenStyles.detailIntroRow}>
          <Text style={screenStyles.detailBookingId}>Booking ID: #{booking.booking_id || booking.id}</Text>
          <BookingStatusBadge status={booking.status} />
        </View>
      </Card>

      <Card style={screenStyles.detailCard}>
        <Text style={screenStyles.detailSectionTitle}>Customer Information</Text>
        <View style={screenStyles.customerRow}>
          <CustomerAvatar
            name={booking.customer_name}
            size={44}
            uri={booking.customer_profile_image}
            style={screenStyles.customerAvatar}
          />
          <View style={screenStyles.customerMeta}>
            <View style={screenStyles.customerLine}>
              <Text style={screenStyles.customerText}>{booking.customer_name}</Text>
            </View>
            <View style={screenStyles.customerLine}>
              <Ionicons color="#6D7A90" name="call-outline" size={18} />
              <Text style={screenStyles.customerSubText}>{booking.customer_phone}</Text>
            </View>
          </View>
          <Pressable style={({ pressed }) => [screenStyles.callButton, pressed && screenStyles.pressed]} onPress={handleCallCustomer}>
            <Ionicons color="#FFFFFF" name="call" size={16} />
            <Text style={screenStyles.callButtonText}>Call Customer</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={screenStyles.detailCard}>
        <Text style={screenStyles.detailSectionTitle}>Booking Information</Text>
        <DetailRow icon="business-outline" label="Business" value={booking.business_name || "-"} />
        <DetailRow icon="construct-outline" label="Service" value={booking.service_name || booking.business_name || "-"} />
        <DetailRow icon="calendar-outline" label="Booking Date" value={formatDate(booking.slot_date)} />
        <DetailRow icon="time-outline" label="Start Time" value={formatTime(booking.start_time)} />
        <DetailRow icon="time-outline" label="End Time" value={formatTime(booking.end_time)} />
        <DetailRow icon="hourglass-outline" label="Duration" value={detailDuration} />
        <DetailRow icon="cash-outline" label="Total Charge" value={formatAmount(booking.currency_symbol, booking.total_price)} />
        <DetailRow icon="document-text-outline" label="Booking Created" value={formatDateTime(booking.created_at)} />
        <DetailRow icon="reader-outline" label="Notes" value={booking.notes || "No notes added."} multiline />
      </Card>

      <Card style={screenStyles.detailCard}>
        <Text style={screenStyles.detailSectionTitle}>Status Timeline</Text>
        <View style={screenStyles.timelineWrap}>
          {timeline.map((item, index) => (
            <View key={item.key} style={screenStyles.timelineRow}>
              <View style={screenStyles.timelineVisual}>
                <View style={[screenStyles.timelineDot, { backgroundColor: item.tone }]}>
                  <Ionicons color="#FFFFFF" name={item.icon} size={12} />
                </View>
                {index < timeline.length - 1 ? <View style={screenStyles.timelineLine} /> : null}
              </View>
              <View style={screenStyles.timelineContent}>
                <Text style={screenStyles.timelineTitle}>{item.label}</Text>
                <Text style={screenStyles.timelineTime}>{item.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <View style={screenStyles.actionGrid}>
        <View style={screenStyles.actionRow}>
          <ActionTile
            label="Confirm Booking"
            color="#22A35A"
            fill="#E8F7EC"
            icon="checkmark-circle-outline"
            disabled={booking.status === "confirmed" || booking.status === "completed" || booking.status === "cancelled"}
            onPress={() => onConfirmBooking?.(booking)}
          />
          <ActionTile
            label="Cancel Booking"
            color="#E25757"
            fill="#FEECEC"
            icon="close-circle-outline"
            disabled={booking.status === "cancelled"}
            onPress={() => onCancelBooking?.(booking)}
          />
        </View>
        <View style={screenStyles.actionRow}>
          <ActionTile
            label="Mark as Completed"
            color="#4B83F5"
            fill="#EEF4FF"
            icon="flag-outline"
            disabled={booking.status === "completed" || booking.status === "cancelled"}
            onPress={() => onCompleteBooking?.(booking)}
          />
          <ActionTile
            label="Chat with Customer"
            color="#44536A"
            icon="chatbubble-ellipses-outline"
            onPress={handleChatCustomer}
          />
        </View>
      </View>

      <Modal animationType="slide" transparent visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <View style={screenStyles.modalBackdrop}>
          <Pressable style={screenStyles.modalDismissArea} onPress={() => setMenuVisible(false)} />
          <View style={screenStyles.sheetCard}>
            <View style={screenStyles.sheetHandle} />
            <Pressable style={({ pressed }) => [screenStyles.sheetItem, pressed && screenStyles.pressed]} onPress={openNotesSheet}>
              <Ionicons color="#334155" name="document-text-outline" size={18} />
              <Text style={screenStyles.sheetItemText}>Add Notes</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [screenStyles.sheetItem, pressed && screenStyles.pressed]} onPress={openRescheduleSheet}>
              <Ionicons color="#334155" name="calendar-outline" size={18} />
              <Text style={screenStyles.sheetItemText}>Reschedule Booking</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [screenStyles.sheetItem, pressed && screenStyles.pressed]} disabled={blockingUser} onPress={handleBlockUser}>
              <Ionicons color="#DC2626" name={booking.customer_is_blocked ? "person-add-outline" : "person-remove-outline"} size={18} />
              <Text style={screenStyles.sheetItemDanger}>{booking.customer_is_blocked ? "Unblock this user" : "Block this user"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={blockUserVisible} onRequestClose={() => setBlockUserVisible(false)}>
        <View style={screenStyles.modalBackdrop}>
          <Pressable style={screenStyles.modalDismissArea} onPress={() => setBlockUserVisible(false)} />
          <View style={[screenStyles.sheetCard, screenStyles.blockSheetCard]}>
            <View style={screenStyles.sheetHandle} />
            <View style={screenStyles.blockHeader}>
              <View style={screenStyles.blockIconWrap}>
                <Ionicons
                  color="#FFFFFF"
                  name={booking.customer_is_blocked ? "person-add-outline" : "person-remove-outline"}
                  size={22}
                />
              </View>
              <Text style={screenStyles.sheetTitle}>{booking.customer_is_blocked ? "Unblock this user?" : "Block this user?"}</Text>
              <Text style={screenStyles.blockText}>
                {booking.customer_is_blocked
                  ? `${booking.customer_name} will be able to book this business again immediately.`
                  : `${booking.customer_name} will be blocked immediately from making future bookings for this business.`}
              </Text>
            </View>
            <View style={screenStyles.blockInfoCard}>
              <Ionicons color="#6B7280" name="shield-checkmark-outline" size={18} />
              <Text style={screenStyles.blockInfoText}>
                {booking.customer_is_blocked
                  ? "You can block this customer again later from any of their booking details."
                  : "This action is saved on the business account, so the block stays active until you choose to remove it."}
              </Text>
            </View>
            <View style={screenStyles.sheetActions}>
              <AppButton variant="secondary" style={screenStyles.sheetButton} onPress={() => setBlockUserVisible(false)}>Cancel</AppButton>
              <AppButton
                variant="secondary"
                style={[screenStyles.sheetButton, screenStyles.blockConfirmButton]}
                textStyle={screenStyles.blockConfirmButtonText}
                disabled={blockingUser}
                onPress={confirmBlockUserAction}
              >
                {blockingUser ? "Updating..." : booking.customer_is_blocked ? "Unblock this user" : "Block this user"}
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={notesVisible} onRequestClose={() => setNotesVisible(false)}>
        <View style={screenStyles.modalBackdrop}>
          <Pressable style={screenStyles.modalDismissArea} onPress={() => setNotesVisible(false)} />
          <View style={screenStyles.sheetCard}>
            <View style={screenStyles.sheetHandle} />
            <Text style={screenStyles.sheetTitle}>Add Notes</Text>
            <TextInput
              multiline
              numberOfLines={4}
              placeholder="Add a note for this booking"
              placeholderTextColor="#94A3B8"
              style={screenStyles.notesInput}
              value={notesDraft}
              onChangeText={setNotesDraft}
            />
            <View style={screenStyles.sheetActions}>
              <AppButton variant="secondary" style={screenStyles.sheetButton} onPress={() => setNotesVisible(false)}>Cancel</AppButton>
              <AppButton style={screenStyles.sheetButton} disabled={savingNotes} onPress={handleSaveNotes}>
                {savingNotes ? "Saving..." : "Save Notes"}
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={rescheduleVisible} onRequestClose={() => setRescheduleVisible(false)}>
        <View style={screenStyles.modalBackdrop}>
          <Pressable style={screenStyles.modalDismissArea} onPress={() => setRescheduleVisible(false)} />
          <View style={screenStyles.sheetCard}>
            <View style={screenStyles.sheetHandle} />
            <Text style={screenStyles.sheetTitle}>Reschedule Booking</Text>
            <Pressable style={({ pressed }) => [screenStyles.rescheduleField, pressed && screenStyles.pressed]} onPress={() => setShowDatePicker(true)}>
              <Ionicons color="#475569" name="calendar-outline" size={18} />
              <View style={{ flex: 1 }}>
                <Text style={screenStyles.rescheduleLabel}>Date</Text>
                <Text style={screenStyles.rescheduleValue}>{formatDate(reschedulePayload.slot_date)}</Text>
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
            {isDailyBooking ? (
              <View style={screenStyles.dailyBookingHint}>
                <Ionicons color="#475569" name="moon-outline" size={16} />
                <Text style={screenStyles.dailyBookingText}>This booking will keep its {dailySummary.toLowerCase()} duration.</Text>
              </View>
            ) : (
              <>
                <Text style={screenStyles.sheetLabel}>Available slots</Text>
                {loadingSlots ? (
                  <Text style={screenStyles.sheetHelper}>Loading available slots...</Text>
                ) : slotOptions.length ? (
                  <View style={screenStyles.slotGrid}>
                    {slotOptions.map((slot) => {
                      const active = selectedSlot?.start_time === slot.start_time && selectedSlot?.end_time === slot.end_time;
                      return (
                        <Pressable
                          key={`${slot.start_time}-${slot.end_time}`}
                          style={({ pressed }) => [
                            screenStyles.slotChip,
                            active && screenStyles.slotChipActive,
                            pressed && screenStyles.pressed
                          ]}
                          onPress={() => setSelectedSlot(slot)}
                        >
                          <Text style={[screenStyles.slotChipText, active && screenStyles.slotChipTextActive]}>
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={screenStyles.sheetHelper}>No open slots for this date.</Text>
                )}
              </>
            )}
            <View style={screenStyles.sheetActions}>
              <AppButton variant="secondary" style={screenStyles.sheetButton} onPress={() => setRescheduleVisible(false)}>Cancel</AppButton>
              <AppButton style={screenStyles.sheetButton} disabled={savingReschedule} onPress={handleSaveReschedule}>
                {savingReschedule ? "Saving..." : "Save"}
              </AppButton>
            </View>
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
  headerTitle: {
    color: COLORS.text,
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center"
  },
  detailIntroCard: {
    marginBottom: 12,
    paddingVertical: 14
  },
  detailIntroRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  detailBookingId: {
    color: "#41516A",
    fontSize: 15,
    fontWeight: "700"
  },
  statusBadge: {
    borderRadius: 999,
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  detailCard: {
    marginBottom: 12
  },
  detailSectionTitle: {
    color: "#23324B",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14
  },
  customerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  customerMeta: {
    flex: 1,
    gap: 10
  },
  customerAvatar: {
    borderColor: "#FFFFFF",
    borderWidth: 2
  },
  customerLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  customerText: {
    color: "#1F2F4A",
    fontSize: 15,
    fontWeight: "700"
  },
  customerSubText: {
    color: "#6D7A90",
    fontSize: 14,
    fontWeight: "600"
  },
  callButton: {
    alignItems: "center",
    backgroundColor: "#2F4364",
    borderRadius: 10,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800"
  },
  detailRow: {
    alignItems: "center",
    borderBottomColor: "#EEF2F6",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 11
  },
  detailRowTop: {
    alignItems: "flex-start"
  },
  detailLabelWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  detailLabel: {
    color: "#55637A",
    fontSize: 14,
    fontWeight: "600"
  },
  detailValue: {
    color: "#23324B",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 12,
    textAlign: "right"
  },
  detailValueMultiline: {
    flex: 1,
    lineHeight: 20
  },
  timelineWrap: {
    gap: 4
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
    minHeight: 54
  },
  timelineVisual: {
    alignItems: "center",
    width: 18
  },
  timelineDot: {
    alignItems: "center",
    borderRadius: 999,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  timelineLine: {
    backgroundColor: "#DCE6DD",
    flex: 1,
    marginTop: 4,
    width: 2
  },
  timelineContent: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 10
  },
  timelineTitle: {
    color: "#23324B",
    fontSize: 15,
    fontWeight: "700"
  },
  timelineTime: {
    color: "#7C8798",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2
  },
  actionGrid: {
    gap: 10,
    marginBottom: 8
  },
  actionRow: {
    flexDirection: "row",
    gap: 10
  },
  actionTile: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 10
  },
  actionTileDisabled: {
    opacity: 0.45
  },
  actionTileText: {
    fontSize: 14,
    fontWeight: "800"
  },
  modalBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.24)",
    flex: 1,
    justifyContent: "flex-end"
  },
  modalDismissArea: {
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
  sheetTitle: {
    color: "#1E293B",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14
  },
  blockSheetCard: {
    backgroundColor: "#D9DEE8"
  },
  blockHeader: {
    alignItems: "center",
    marginBottom: 12
  },
  blockIconWrap: {
    alignItems: "center",
    backgroundColor: "#6B7280",
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    marginBottom: 14,
    width: 56
  },
  blockText: {
    color: "#4B5563",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center"
  },
  blockInfoCard: {
    alignItems: "flex-start",
    backgroundColor: "#E7EBF2",
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  blockInfoText: {
    color: "#5B6472",
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  blockConfirmButton: {
    backgroundColor: "#111111",
    borderColor: "#111111"
  },
  blockConfirmButtonText: {
    color: "#FFFFFF"
  },
  sheetItem: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 16
  },
  sheetItemText: {
    color: "#1E293B",
    fontSize: 15,
    fontWeight: "700"
  },
  sheetItemDanger: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "800"
  },
  notesInput: {
    borderColor: "#D7DFEA",
    borderRadius: 16,
    borderWidth: 1,
    color: "#1E293B",
    fontSize: 15,
    minHeight: 110,
    paddingHorizontal: 14,
    paddingTop: 14,
    textAlignVertical: "top"
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  sheetButton: {
    flex: 1
  },
  rescheduleField: {
    alignItems: "center",
    borderColor: "#D7DFEA",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  rescheduleLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    textTransform: "uppercase"
  },
  rescheduleValue: {
    color: "#1E293B",
    fontSize: 15,
    fontWeight: "700"
  },
  sheetLabel: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
    marginTop: 14
  },
  sheetHelper: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  slotChip: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#D7DFEA",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    width: "48%"
  },
  slotChipActive: {
    backgroundColor: "#E5E7EB",
    borderColor: "#4B5563"
  },
  slotChipText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  slotChipTextActive: {
    color: "#111827"
  },
  dailyBookingHint: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#D7DFEA",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  dailyBookingText: {
    color: "#475569",
    flex: 1,
    fontSize: 13,
    fontWeight: "600"
  }
});
