import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, Pressable, Text, View } from "react-native";

import { api } from "../api/client";
import { COLORS } from "../constants";
import { formatDate, formatTime, todayISO, toLocalISODate } from "../utils/format";
import { AppButton, BottomTabs, Card, EmptyState, Screen, SectionTitle, Title, styles } from "../components/ui";

const tabs = [
  { label: "Dashboard", value: "dashboard" },
  { label: "Bookings", value: "bookings" },
  { label: "Slots", value: "slots" },
  { label: "Settings", value: "settings" }
];

export function BusinessSlotsScreen({ activeTab, onOpenProfile, onTabChange, onError }) {
  const [business, setBusiness] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadBusiness();
  }, []);

  useEffect(() => {
    if (business) loadSlots();
  }, [date, business]);

  useEffect(() => {
    if (activeTab !== "slots") return;
    loadBusiness();
    if (business) {
      loadSlots();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "slots" || !business) return undefined;
    const timer = setInterval(() => {
      loadSlots();
    }, 15000);
    return () => clearInterval(timer);
  }, [activeTab, business, date]);

  async function loadBusiness() {
    try {
      const payload = await api("/businesses/mine");
      setBusiness(payload.data.business);
    } catch (error) {
      onError(error);
    }
  }

  async function loadSlots() {
    try {
      const payload = await api(`/businesses/${business.id}/slots?date=${date}&all=true`);
      setSlots(payload.data.slots || []);
    } catch (error) {
      onError(error);
    }
  }

  async function prepareDay() {
    if (!business) return;
    const editableSlots = slots.filter((slot) => slot.status !== "booked");
    const blockedSlots = editableSlots.filter((slot) => slot.status === "blocked");

    if (editableSlots.length && blockedSlots.length === editableSlots.length) {
      try {
        await Promise.all(
          blockedSlots.map((slot) =>
            api(`/slots/${slot.id}`, {
              method: "PATCH",
              body: { status: "available", block_reason: "" }
            })
          )
        );
        loadSlots();
        return;
      } catch (error) {
        onError(error);
        return;
      }
    }

    const weekday = new Date(`${date}T00:00:00`).getDay();
    const mondayBased = weekday === 0 ? 6 : weekday - 1;
    try {
      await api(`/businesses/${business.id}/slots/generate`, {
        method: "POST",
        body: { start_date: date, end_date: date, weekdays: [mondayBased] }
      });
      loadSlots();
    } catch (error) {
      if (error.message.includes("Duplicate") || error.message.includes("Overlapping")) {
        loadSlots();
      } else {
        onError(error);
      }
    }
  }

  async function closeDay() {
    try {
      await api(`/businesses/${business.id}/closures`, { method: "POST", body: { dates: [date] } });
      loadSlots();
    } catch (error) {
      onError(error);
    }
  }

  async function toggleSlot(slot) {
    if (slot.status === "booked") {
      onError(new Error("This slot is booked and cannot be changed here."));
      return;
    }
    const next = slot.status === "available" ? "blocked" : "available";
    try {
      await api(`/slots/${slot.id}`, {
        method: "PATCH",
        body: { status: next, block_reason: next === "blocked" ? "Blocked by business" : "" }
      });
      loadSlots();
    } catch (error) {
      onError(error);
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

  function slotStatusLabel(status) {
    if (status === "blocked") return "Closed";
    if (status === "booked") return "Booked";
    return "Available";
  }

  return (
    <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />}>
      <Title>Slot management</Title>
      {!business ? (
        <Card>
          <Text style={styles.businessName}>Create your business profile first.</Text>
          <AppButton style={{ marginTop: 12 }} onPress={onOpenProfile}>Create profile</AppButton>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.eyebrow}>Manage day</Text>
            <Text style={styles.slotDateTitle}>{formatDate(date)}</Text>
            <Pressable style={({ pressed }) => [styles.datePickerButton, pressed && styles.pressed]} onPress={() => setShowDatePicker(true)}>
              <View style={styles.datePickerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Selected date</Text>
                  <Text style={styles.datePickerText}>{date}</Text>
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
            <View style={{ flexDirection: "row", gap: 10 }}>
              <AppButton style={{ flex: 1 }} onPress={prepareDay}>Prepare day</AppButton>
              <AppButton variant="secondary" style={{ flex: 1 }} onPress={closeDay}>Close day</AppButton>
            </View>
          </Card>

          <Card>
            <SectionTitle>Slot status</SectionTitle>
            <View style={styles.slotLegend}>
              <View style={styles.slotLegendItem}>
                <View style={[styles.slotLegendDot, styles.slotLegendDot_available]} />
                <Text style={styles.slotLegendText}>Available</Text>
              </View>
              <View style={styles.slotLegendItem}>
                <View style={[styles.slotLegendDot, styles.slotLegendDot_blocked]} />
                <Text style={styles.slotLegendText}>Closed</Text>
              </View>
              <View style={styles.slotLegendItem}>
                <View style={[styles.slotLegendDot, styles.slotLegendDot_booked]} />
                <Text style={styles.slotLegendText}>Booked</Text>
              </View>
            </View>
            <Text style={styles.slotHelperText}>Tap available slots to close them. Tap closed slots to reopen them. Gray slots are booked.</Text>
            {slots.length ? (
              <View style={styles.slotGrid}>
                {slots.map((slot) => (
                  <Pressable
                    key={slot.id}
                    style={({ pressed }) => [styles.slotTile, styles[`slotTile_${slot.status}`], pressed && styles.pressed]}
                    onPress={() => toggleSlot(slot)}
                  >
                    <Text style={[styles.slotTileTime, styles[`slotTileTime_${slot.status}`]]}>{formatTime(slot.start_time)}</Text>
                    <Text style={[styles.slotTileStatus, styles[`slotTileStatus_${slot.status}`]]}>{slotStatusLabel(slot.status)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState>No slots for this date yet. Tap Prepare day to create bookable times.</EmptyState>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
