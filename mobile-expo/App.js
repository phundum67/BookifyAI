import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api, clearAuthToken, loadAuthToken } from "./src/api/client";
import { COLORS } from "./src/constants";
import { AuthScreen } from "./src/screens/AuthScreen";
import { BrowseScreen } from "./src/screens/BrowseScreen";
import { BusinessBookingsScreen } from "./src/screens/BusinessBookingsScreen";
import { BusinessDashboardScreen } from "./src/screens/BusinessDashboardScreen";
import { BusinessDetailScreen } from "./src/screens/BusinessDetailScreen";
import { BusinessProfileScreen } from "./src/screens/BusinessProfileScreen";
import { BusinessSettingsScreen } from "./src/screens/BusinessSettingsScreen";
import { BusinessSlotsScreen } from "./src/screens/BusinessSlotsScreen";
import { CustomerBookingsScreen } from "./src/screens/CustomerBookingsScreen";
import { CustomerHomeScreen } from "./src/screens/CustomerHomeScreen";
import { CustomerSettingsScreen } from "./src/screens/CustomerSettingsScreen";
import { RoleScreen } from "./src/screens/RoleScreen";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [customerTab, setCustomerTab] = useState("home");
  const [businessTab, setBusinessTab] = useState("dashboard");
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [browseFilters, setBrowseFilters] = useState({ category: "", subcategory: "" });
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      await loadAuthToken();
      const payload = await api("/auth/me");
      setUser(payload.data.user);
    } catch (_error) {
      setUser(null);
    } finally {
      setBooting(false);
    }
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } catch (_error) {
      // Token may already be invalid. Clearing local state is still correct.
    }
    await clearAuthToken();
    setUser(null);
    setSelectedBusinessId(null);
    setBusinessProfileOpen(false);
    setAuthMode("login");
  }

  function handleAuth(nextUser) {
    setUser(nextUser);
    setSelectedBusinessId(null);
    setBusinessProfileOpen(false);
  }

  function openCustomerBusiness(id, business) {
    setSelectedBusinessId(id);
    if (business) {
      setRecentlyViewed((items) => [business, ...items.filter((item) => item.id !== business.id)].slice(0, 5));
    }
  }

  function openBrowseForCategory(filters) {
    setBrowseFilters({
      category: filters?.category || "",
      subcategory: filters?.subcategory || ""
    });
    setSelectedBusinessId(null);
    setCustomerTab("browse");
  }

  function openBusinessProfile() {
    setBusinessProfileOpen(true);
  }

  function closeBusinessProfile() {
    setBusinessProfileOpen(false);
    setBusinessTab("settings");
  }

  function handleApiError(error) {
    const nextNotice = normalizeNotice(error);
    setNotice(nextNotice);
  }

  function closeNotice() {
    setNotice(null);
  }

  function normalizeNotice(input) {
    const fallbackMessage = "Something went wrong.";
    const payload = typeof input === "string"
      ? { message: input }
      : input && typeof input === "object" && !("message" in input && input instanceof Error)
        ? input
        : { message: input?.message || fallbackMessage };

    const message = payload.message || fallbackMessage;
    const lower = message.toLowerCase();
    let tone = payload.tone || "error";
    if (!payload.tone) {
      if (
        lower.includes("saved") ||
        lower.includes("submitted") ||
        lower.includes("sent") ||
        lower.includes("reported") ||
        lower.includes("confirmed") ||
        lower.includes("updated")
      ) {
        tone = "success";
      } else if (lower.includes("available soon") || lower.includes("loading")) {
        tone = "info";
      }
    }

    let nextTitle = payload.title;
    let helperTitle = payload.helperTitle;
    let helperText = payload.helperText;
    let eyebrow = payload.eyebrow;
    let buttonText = payload.buttonText;

    if (!nextTitle) {
      if (lower.includes("short review")) {
        nextTitle = "Review needed";
      } else if (lower.includes("issue sent") || lower.includes("issue report submitted") || lower.includes("issue reported")) {
        nextTitle = "Issue reported";
      } else if (lower.includes("saved")) {
        nextTitle = "Changes saved";
      } else if (lower.includes("allow photo access")) {
        nextTitle = "Permission needed";
      } else if (lower.includes("available soon")) {
        nextTitle = "Coming soon";
      }
    }

    if (!helperTitle || !helperText) {
      if (lower.includes("short review")) {
        helperTitle = helperTitle || "Before you continue";
        helperText = helperText || "Add a few words about your experience so the review can be submitted properly.";
      } else if (lower.includes("issue sent") || lower.includes("issue report submitted") || lower.includes("issue reported")) {
        helperTitle = helperTitle || "What happens next?";
        helperText = helperText || "The business owner will receive your report with the reason and details you shared.";
      } else if (lower.includes("saved")) {
        helperTitle = helperTitle || "All set";
        helperText = helperText || "Your latest changes are now stored and ready to use across the app.";
      } else if (lower.includes("allow photo access")) {
        helperTitle = helperTitle || "Access required";
        helperText = helperText || "Allow gallery permission on your phone so Booklify can pick and upload the image.";
      } else if (tone === "error") {
        helperTitle = helperTitle || "Try again";
        helperText = helperText || "Please check the information and try again in a moment.";
      } else if (tone === "info") {
        helperTitle = helperTitle || "Heads up";
        helperText = helperText || "This feature or update is still being prepared.";
      }
    }

    if (!eyebrow) {
      eyebrow = tone === "success" ? "Success" : tone === "info" ? "Notice" : "Attention";
    }

    if (!buttonText) {
      buttonText = tone === "success" ? "Continue" : "Got it";
    }

    const toneMeta = {
      success: {
        icon: "checkmark-circle-outline",
        iconBg: "#6B7280",
        iconColor: "#FFFFFF",
        lineColor: "#D5D9E2",
        helperBg: "#E0E4EC",
        helperIcon: "sparkles-outline",
        helperIconBg: "#D2D7E0",
        helperIconColor: "#4B5563",
        title: nextTitle || "Done"
      },
      info: {
        icon: "information-circle-outline",
        iconBg: "#6B7280",
        iconColor: "#FFFFFF",
        lineColor: "#D5D9E2",
        helperBg: "#E0E4EC",
        helperIcon: "time-outline",
        helperIconBg: "#D2D7E0",
        helperIconColor: "#4B5563",
        title: nextTitle || "Notice"
      },
      error: {
        icon: "alert-circle-outline",
        iconBg: "#6B7280",
        iconColor: "#FFFFFF",
        lineColor: "#D5D9E2",
        helperBg: "#E0E4EC",
        helperIcon: "shield-outline",
        helperIconBg: "#D2D7E0",
        helperIconColor: "#4B5563",
        title: nextTitle || "Something went wrong"
      }
    }[tone] || {
      icon: "information-circle-outline",
      iconBg: "#6B7280",
      iconColor: "#FFFFFF",
      lineColor: "#D5D9E2",
      helperBg: "#E0E4EC",
      helperIcon: "information-circle-outline",
      helperIconBg: "#D2D7E0",
      helperIconColor: "#4B5563",
      title: nextTitle || "Notice"
    };

    return {
      buttonText,
      eyebrow,
      helperText,
      helperTitle,
      message,
      tone,
      ...toneMeta
    };
  }

  function renderNoticeModal() {
    if (!notice) return null;
    return (
      <Modal animationType="fade" transparent visible onRequestClose={closeNotice}>
        <View style={styles.noticeBackdrop}>
          <Pressable style={styles.noticeDismissArea} onPress={closeNotice} />
          <View style={styles.noticeCard}>
            <Pressable hitSlop={8} style={styles.noticeCloseButton} onPress={closeNotice}>
              <Ionicons color="#D1D5DB" name="close-outline" size={22} />
            </Pressable>
            <View style={styles.noticeEyebrowWrap}>
              <Text style={styles.noticeEyebrow}>{notice.eyebrow}</Text>
            </View>
            <View style={[styles.noticeIconCircle, { backgroundColor: notice.iconBg }]}>
              <Ionicons color={notice.iconColor} name={notice.icon} size={24} />
            </View>
            <Text style={styles.noticeTitle}>{notice.title}</Text>
            <Text style={styles.noticeMessage}>{notice.message}</Text>
            <View style={[styles.noticeDivider, { backgroundColor: notice.lineColor }]} />
            <View style={[styles.noticeHelperCard, { backgroundColor: notice.helperBg }]}>
              <View style={[styles.noticeHelperIconCircle, { backgroundColor: notice.helperIconBg }]}>
                <Ionicons color={notice.helperIconColor} name={notice.helperIcon} size={18} />
              </View>
              <View style={styles.noticeHelperContent}>
                <Text style={styles.noticeHelperTitle}>{notice.helperTitle}</Text>
                <Text style={styles.noticeHelperText}>{notice.helperText}</Text>
              </View>
            </View>
            <Pressable style={({ pressed }) => [styles.noticeActionButton, pressed && styles.noticeActionPressed]} onPress={closeNotice}>
              <Text style={styles.noticeActionText}>{notice.buttonText}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  let content = null;

  if (booting) {
    content = (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={COLORS.accent} />
      </SafeAreaView>
    );
  } else if (!user) {
    content = <AuthScreen mode={authMode} onModeChange={setAuthMode} onAuth={handleAuth} onError={handleApiError} />;
  } else if (!user.account_type) {
    content = <RoleScreen onAuth={handleAuth} onError={handleApiError} />;
  } else if (user.account_type === "Customer") {
    if (selectedBusinessId) {
      content = (
        <BusinessDetailScreen
          businessId={selectedBusinessId}
          user={user}
          onBack={() => setSelectedBusinessId(null)}
          onOpenCategory={openBrowseForCategory}
          onBooked={() => {
            setSelectedBusinessId(null);
            setCustomerTab("bookings");
          }}
          onError={handleApiError}
        />
      );
    } else if (customerTab === "browse") {
      content = (
        <BrowseScreen
          activeTab={customerTab}
          initialCategory={browseFilters.category}
          initialSubcategory={browseFilters.subcategory}
          onTabChange={setCustomerTab}
          onOpenBusiness={openCustomerBusiness}
          onError={handleApiError}
        />
      );
    } else if (customerTab === "bookings") {
      content = <CustomerBookingsScreen activeTab={customerTab} onTabChange={setCustomerTab} onError={handleApiError} />;
    } else if (customerTab === "settings") {
      content = <CustomerSettingsScreen user={user} activeTab={customerTab} onTabChange={setCustomerTab} onAuth={setUser} onLogout={logout} onOpenBusiness={openCustomerBusiness} onError={handleApiError} />;
    } else {
      content = <CustomerHomeScreen user={user} activeTab={customerTab} onTabChange={setCustomerTab} onOpenBusiness={openCustomerBusiness} onError={handleApiError} recentlyViewed={recentlyViewed} />;
    }
  } else if (businessProfileOpen) {
    content = <BusinessProfileScreen activeTab="settings" onBack={closeBusinessProfile} onTabChange={setBusinessTab} onError={handleApiError} />;
  } else if (businessTab === "slots") {
    content = <BusinessSlotsScreen activeTab={businessTab} onOpenProfile={openBusinessProfile} onTabChange={setBusinessTab} onError={handleApiError} />;
  } else if (businessTab === "bookings") {
    content = <BusinessBookingsScreen activeTab={businessTab} onTabChange={setBusinessTab} onError={handleApiError} />;
  } else if (businessTab === "settings") {
    content = <BusinessSettingsScreen user={user} activeTab={businessTab} onOpenProfile={openBusinessProfile} onTabChange={setBusinessTab} onLogout={logout} />;
  } else {
    content = <BusinessDashboardScreen activeTab={businessTab} onOpenProfile={openBusinessProfile} onTabChange={setBusinessTab} onError={handleApiError} />;
  }

  return (
    <>
      {content}
      {renderNoticeModal()}
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flex: 1,
    justifyContent: "center"
  },
  noticeBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.24)",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  noticeDismissArea: {
    ...StyleSheet.absoluteFillObject
  },
  noticeCard: {
    backgroundColor: "#D9DEE8",
    borderColor: "#C7CEDA",
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 360,
    paddingBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    width: "100%"
  },
  noticeCloseButton: {
    alignSelf: "flex-end",
    marginBottom: 4
  },
  noticeEyebrowWrap: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#C7CEDA",
    borderRadius: 999,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  noticeEyebrow: {
    color: "#5B6472",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  noticeIconCircle: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 999,
    height: 58,
    justifyContent: "center",
    marginBottom: 16,
    width: 58
  },
  noticeTitle: {
    color: "#111111",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center"
  },
  noticeMessage: {
    color: "#4B5563",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center"
  },
  noticeDivider: {
    height: 1,
    marginTop: 18,
    width: "100%"
  },
  noticeHelperCard: {
    borderRadius: 18,
    flexDirection: "row",
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  noticeHelperIconCircle: {
    alignItems: "center",
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    marginRight: 12,
    width: 42
  },
  noticeHelperContent: {
    flex: 1
  },
  noticeHelperTitle: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4
  },
  noticeHelperText: {
    color: "#5B6472",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  noticeActionButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 22,
    minHeight: 50
  },
  noticeActionPressed: {
    opacity: 0.86
  },
  noticeActionText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "900"
  }
});
