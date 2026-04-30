import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Bell, CalendarCheck, CalendarClock, CalendarX, MapPin } from "lucide-react-native";

import { api } from "../api/client";
import { COLORS } from "../constants";
import { AppButton, BottomTabs, BusinessCard, Card, EmptyState, IconButton, Screen, SectionTitle, Title, styles } from "../components/ui";
import { BookingDetailsScreen } from "./BookingDetailsScreen";

const tabs = [
  { label: "Home", value: "home" },
  { label: "Browse", value: "browse" },
  { label: "Bookings", value: "bookings" },
  { label: "Settings", value: "settings" }
];

function getNotificationTone(type) {
  if (type === "booking_cancelled") {
    return {
      Icon: CalendarX,
      backgroundColor: "#FBECEC",
      borderColor: "#F3C7C7",
      color: "#B94A48"
    };
  }
  if (type === "booking_rescheduled") {
    return {
      Icon: CalendarClock,
      backgroundColor: "#FFF4E5",
      borderColor: "#F4D6A6",
      color: "#A66A18"
    };
  }
  if (type === "booking_confirmed" || type === "new_booking") {
    return {
      Icon: CalendarCheck,
      backgroundColor: "#EAF1ED",
      borderColor: "#C9D8CF",
      color: "#4B6B57"
    };
  }
  return {
    Icon: Bell,
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.border,
    color: COLORS.accent
  };
}

export function CustomerHomeScreen({ user, activeTab, onTabChange, onOpenBusiness, onError, recentlyViewed = [] }) {
  const [featured, setFeatured] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    loadFeatured();
    loadNotifications({ silent: true });
  }, []);

  async function loadFeatured() {
    try {
      setLoadingFeatured(true);
      const payload = await api("/businesses?featured=true");
      setFeatured(payload.data.businesses || []);
    } catch (error) {
      onError(error);
    } finally {
      setLoadingFeatured(false);
    }
  }

  async function askBooklifyAi() {
    const message = aiQuestion.trim();
    if (!message) {
      setAiError("Type a question for Booklify AI first.");
      return;
    }

    try {
      Keyboard.dismiss();
      setAiLoading(true);
      setAiAnswer("");
      setAiError("");
      const payload = await api("/ai-test", { method: "POST", body: { message } });
      const answer = payload?.data?.answer;
      setAiAnswer(answer || "Booklify AI did not return an answer. Try asking in a different way.");
    } catch (error) {
      const messageText = error.message || "";
      if (error.status === 404) {
        setAiError("Booklify AI is not active on the server yet. Please update and reload the PythonAnywhere backend.");
      } else if (!error.responseWasReadable || messageText.includes("unreadable response")) {
        setAiError("Booklify AI could not read the server response. Please try again after reloading the backend.");
      } else {
        setAiError(messageText || "Booklify AI is unavailable right now.");
      }
    } finally {
      setAiLoading(false);
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
      // The list is still useful even if read receipts fail.
    }
  }

  async function openNotificationBooking(notification) {
    if (!notification?.booking_id) return;
    try {
      const payload = await api("/bookings/customer");
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

  async function cancelBooking(id) {
    try {
      await api(`/bookings/${id}/cancel`, { method: "PATCH", body: {} });
      const payload = await api("/bookings/customer");
      const refreshed = (payload.data.bookings || []).find((item) => item.id === id) || null;
      setSelectedBooking(refreshed);
      await loadNotifications({ silent: true });
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
      <Title
        eyebrow={`Hi, ${user.name || "there"} 👋`}
        right={
          <View style={screenStyles.notificationButtonWrap}>
            <IconButton accessibilityLabel="Notifications" name="notifications-outline" onPress={openNotifications} />
            {unreadCount ? (
              <View style={screenStyles.notificationDot}>
                <Text style={screenStyles.notificationDotText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            ) : null}
          </View>
        }
      >
        {"Let's find your next place today"}
      </Title>
      <Card style={styles.aiPanel}>
        <Text style={styles.aiPanelEyebrow}>Booklify AI</Text>
        <Text style={styles.aiPanelTitle}>Ask for a place or booking idea</Text>
        <View style={styles.aiInputRow}>
          <TextInput
            value={aiQuestion}
            onChangeText={(value) => {
              setAiQuestion(value);
              setAiError("");
            }}
            placeholder="Try: turf near me at 6 PM"
            placeholderTextColor="#8A8A8A"
            returnKeyType="send"
            onSubmitEditing={askBooklifyAi}
            style={styles.aiInput}
          />
          <AppButton style={styles.aiSendButton} onPress={askBooklifyAi}>{aiLoading ? "..." : "Ask"}</AppButton>
        </View>
        {aiLoading ? <Text style={styles.aiThinkingText}>Thinking...</Text> : null}
        {aiError ? <Text style={styles.aiErrorText}>{aiError}</Text> : null}
        {aiAnswer ? (
          <View style={styles.aiAnswerBox}>
            <Text style={styles.aiAnswerText}>{aiAnswer}</Text>
          </View>
        ) : null}
      </Card>
      <SectionTitle action={<AppButton variant="secondary" style={screenStyles.sectionActionButton} onPress={() => onTabChange("browse")}>View all</AppButton>}>Featured</SectionTitle>
      {loadingFeatured ? (
        <Card>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={[styles.emptyText, { marginTop: 10 }]}>Loading featured places...</Text>
        </Card>
      ) : null}
      {!loadingFeatured && featured.length ? featured.slice(0, 5).map((business) => <BusinessCard key={business.id} business={business} enhanced onPress={onOpenBusiness} />) : null}
      {!loadingFeatured && !featured.length ? <EmptyState>Featured businesses will appear here soon.</EmptyState> : null}
      <SectionTitle action={<AppButton variant="secondary" style={screenStyles.sectionActionButton} onPress={() => onTabChange("browse")}>View all</AppButton>}>Recently viewed</SectionTitle>
      {recentlyViewed.length ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={screenStyles.recentList}
          data={recentlyViewed}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const image = item.image_url || item.profile_image || item.gallery_images?.[0];
            const subtitle = item.custom_category || item.subcategory || item.category || item.location;
            return (
              <Pressable style={({ pressed }) => [screenStyles.recentCard, pressed && styles.pressed]} onPress={() => onOpenBusiness(item.id, item)}>
                <View style={screenStyles.recentImageWrap}>
                  <BusinessCardImageFallback uri={image} />
                </View>
                <Text numberOfLines={1} style={screenStyles.recentTitle}>{item.name}</Text>
                <View style={screenStyles.recentMetaRow}>
                  <MapPin color={COLORS.light} size={12} strokeWidth={2} />
                  <Text numberOfLines={1} style={screenStyles.recentSubtitle}>{subtitle}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : <EmptyState>Businesses you view will appear here for quick access.</EmptyState>}
      <Modal animationType="slide" transparent visible={notificationsVisible} onRequestClose={() => setNotificationsVisible(false)}>
        <View style={screenStyles.notificationBackdrop}>
          <Pressable style={screenStyles.notificationDismissArea} onPress={() => setNotificationsVisible(false)} />
          <View style={screenStyles.notificationSheet}>
            <View style={screenStyles.sheetHandle} />
            <View style={screenStyles.notificationHeader}>
              <Text style={screenStyles.notificationTitle}>Notifications</Text>
              <Pressable style={({ pressed }) => [screenStyles.closeButton, pressed && styles.pressed]} onPress={() => setNotificationsVisible(false)}>
                <Text style={screenStyles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
            {loadingNotifications ? (
              <View style={screenStyles.notificationLoading}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={screenStyles.notificationMuted}>Loading notifications...</Text>
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
                  const Icon = tone.Icon;
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        screenStyles.notificationItem,
                        { borderLeftColor: tone.borderColor },
                        clickable && screenStyles.notificationPressable,
                        pressed && clickable && styles.pressed
                      ]}
                      disabled={!clickable}
                      onPress={() => openNotificationBooking(item)}
                    >
                      <View style={[screenStyles.notificationIcon, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
                        <Icon color={item.is_read ? COLORS.light : tone.color} size={17} strokeWidth={2} />
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
            {!loadingNotifications && !notifications.length ? <Text style={screenStyles.notificationMuted}>No notifications yet.</Text> : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function BusinessCardImageFallback({ uri }) {
  if (!uri) {
    return (
      <View style={screenStyles.recentImageFallback}>
        <Bell color={COLORS.light} size={20} strokeWidth={2} />
      </View>
    );
  }

  return <Image source={{ uri }} style={screenStyles.recentImage} />;
}

const screenStyles = StyleSheet.create({
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
  notificationButtonWrap: {
    position: "relative"
  },
  notificationContent: {
    flex: 1,
    gap: 4
  },
  notificationDismissArea: {
    flex: 1
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
  notificationHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  notificationIcon: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  notificationItem: {
    alignItems: "center",
    borderLeftWidth: 3,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingLeft: 10,
    paddingVertical: 12
  },
  notificationItemMessage: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  notificationItemTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900"
  },
  notificationPressable: {
    paddingRight: 6
  },
  notificationChevron: {
    color: COLORS.light,
    fontSize: 24,
    fontWeight: "700",
    marginLeft: 6
  },
  notificationList: {
    maxHeight: 420
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
  notificationSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 10
  },
  notificationTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900"
  },
  recentCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    width: 160
  },
  recentImageWrap: {
    backgroundColor: COLORS.border,
    borderRadius: 16,
    height: 112,
    marginBottom: 10,
    overflow: "hidden"
  },
  recentImageFallback: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    flex: 1,
    justifyContent: "center"
  },
  recentImage: {
    height: "100%",
    width: "100%"
  },
  recentList: {
    gap: 12,
    paddingBottom: 8
  },
  recentMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4
  },
  recentSubtitle: {
    color: COLORS.light,
    flex: 1,
    fontSize: 12,
    fontWeight: "700"
  },
  recentTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6
  },
  sectionActionButton: {
    minHeight: 36,
    paddingHorizontal: 14
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#D6DEE8",
    borderRadius: 999,
    height: 4,
    marginBottom: 14,
    width: 42
  }
});
