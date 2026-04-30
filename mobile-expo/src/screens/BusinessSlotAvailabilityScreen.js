import React, { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../api/client";
import { COLORS } from "../constants";
import { AppButton, Card, Chip, EmptyState, IconButton, Screen, SectionTitle, styles } from "../components/ui";
import { formatDate, formatTime, todayISO, toLocalISODate } from "../utils/format";

export function BusinessSlotAvailabilityScreen({ business, onBack, onError }) {
  const services = useMemo(() => {
    const normalized = Array.isArray(business?.services) ? business.services.filter(Boolean) : [];
    if (normalized.length) return normalized;
    return [{ id: null, name: business?.name || "All services", booking_type: "hourly" }];
  }, [business]);

  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id ?? null);
  const [date, setDate] = useState(todayISO());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedServiceId(services[0]?.id ?? null);
  }, [services]);

  useEffect(() => {
    if (!business?.id) return;
    loadSlots();
  }, [business?.id, date, selectedServiceId]);

  async function loadSlots() {
    try {
      setLoading(true);
      const serviceQuery = selectedServiceId ? `&service_id=${selectedServiceId}` : "";
      const payload = await api(`/businesses/${business.id}/slots?date=${date}&all=true${serviceQuery}`);
      setSlots(payload.data.slots || []);
    } catch (error) {
      onError?.(error);
    } finally {
      setLoading(false);
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

  const availableSlots = slots.filter((slot) => slot.status === "available");
  const bookedSlots = slots.filter((slot) => slot.status !== "available");

  return (
    <Screen>
      <View style={screenStyles.headerRow}>
        <IconButton accessibilityLabel="Back" color={COLORS.text} name="arrow-back-outline" size={20} onPress={onBack} />
        <Text style={screenStyles.headerTitle}>Slot Availability</Text>
        <View style={screenStyles.headerSpacer} />
      </View>

      <Card>
        <SectionTitle>Check a service</SectionTitle>
        <Text style={screenStyles.helperText}>Choose a service and date to see what is available or already booked.</Text>
        <Text style={styles.label}>Service</Text>
        <View style={screenStyles.serviceGrid}>
          {services.map((service) => (
            <Chip
              key={service.id ?? "all-services"}
              label={service.name}
              active={selectedServiceId === (service.id ?? null)}
              style={screenStyles.serviceChip}
              onPress={() => setSelectedServiceId(service.id ?? null)}
            />
          ))}
        </View>

        <Text style={styles.label}>Date</Text>
        <Pressable style={({ pressed }) => [styles.datePickerButton, pressed && styles.pressed]} onPress={() => setShowDatePicker(true)}>
          <View style={styles.datePickerRow}>
            <View style={{ flex: 1 }}>
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
      </Card>

      <Card>
        <SectionTitle>Available</SectionTitle>
        {loading ? (
          <EmptyState>Checking available slots...</EmptyState>
        ) : availableSlots.length ? (
          <View style={styles.slotGrid}>
            {availableSlots.map((slot) => (
              <View key={`available-${slot.id}`} style={[styles.slotTile, styles.slotTile_available]}>
                <Text style={[styles.slotTileTime, styles.slotTileTime_available]}>{formatTime(slot.start_time)}</Text>
                <Text style={[styles.slotTileStatus, styles.slotTileStatus_available]}>Available</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState>No available slots on {formatDate(date)}.</EmptyState>
        )}
      </Card>

      <Card>
        <SectionTitle>Booked</SectionTitle>
        {loading ? (
          <EmptyState>Loading booked slots...</EmptyState>
        ) : bookedSlots.length ? (
          <View style={styles.slotGrid}>
            {bookedSlots.map((slot) => {
              const booked = slot.status === "booked";
              return (
                <View
                  key={`booked-${slot.id}`}
                  style={[styles.slotTile, booked ? styles.slotTile_booked : styles.slotTile_blocked]}
                >
                  <Text style={[styles.slotTileTime, booked ? styles.slotTileTime_booked : styles.slotTileTime_blocked]}>
                    {formatTime(slot.start_time)}
                  </Text>
                  <Text style={[styles.slotTileStatus, booked ? styles.slotTileStatus_booked : styles.slotTileStatus_blocked]}>
                    {booked ? "Booked" : "Closed"}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState>No booked or closed slots on {formatDate(date)}.</EmptyState>
        )}
      </Card>

      <AppButton variant="secondary" onPress={loadSlots}>Refresh availability</AppButton>
    </Screen>
  );
}

const screenStyles = StyleSheet.create({
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
  headerSpacer: {
    width: 40
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12
  },
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  serviceChip: {
    minHeight: 38
  }
});
