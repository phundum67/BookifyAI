import { ClerkProvider, isClerkRuntimeError, useAuth, useClerk } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { api, setAccessTokenProvider } from "./src/api/client";
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

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

function UnknownAccountTypeScreen({ accountType }) {
  return (
    <SafeAreaView style={styles.center}>
      <View style={styles.unknownAccountCard}>
        <Text style={styles.unknownAccountTitle}>Account setup needed</Text>
        <Text style={styles.unknownAccountText}>
          We could not load this account because the account type is not supported yet.
        </Text>
        <Text style={styles.unknownAccountMeta}>Received: {accountType || "Unknown"}</Text>
      </View>
    </SafeAreaView>
  );
}

function MissingClerkConfigurationScreen() {
  return (
    <SafeAreaView style={styles.center}>
      <View style={styles.unknownAccountCard}>
        <Text style={styles.unknownAccountTitle}>Clerk setup needed</Text>
        <Text style={styles.unknownAccountText}>
          Add your Clerk publishable key to `mobile-expo/.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
          and restart Expo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function AuthSyncFailedScreen({ onRetry, onLogout }) {
  return (
    <SafeAreaView style={styles.center}>
      <View style={styles.unknownAccountCard}>
        <Text style={styles.unknownAccountTitle}>We could not load your account</Text>
        <Text style={styles.unknownAccountText}>
          Clerk signed you in, but Booklify could not finish syncing your account with the backend yet.
        </Text>
        <Pressable style={({ pressed }) => [styles.retryButton, pressed && styles.noticeActionPressed]} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryLinkButton, pressed && styles.noticeActionPressed]} onPress={onLogout}>
          <Text style={styles.secondaryLinkButtonText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function AppShell() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const { signOut } = clerk;
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [authSyncFailed, setAuthSyncFailed] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [customerTab, setCustomerTab] = useState("home");
  const [businessTab, setBusinessTab] = useState("dashboard");
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [browseFilters, setBrowseFilters] = useState({ category: "", subcategory: "" });
  const [browseSnapshot, setBrowseSnapshot] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setAccessTokenProvider(async () => {
      if (!isLoaded || !isSignedIn) return null;
      return getToken({ skipCache: true });
    });

    return () => {
      setAccessTokenProvider(null);
    };
  }, [getToken, isLoaded, isSignedIn]);

  function resetSessionUiState({ authModeValue } = {}) {
    setCustomerTab("home");
    setBusinessTab("dashboard");
    setBusinessProfileOpen(false);
    setSelectedBusinessId(null);
    setRecentlyViewed([]);
    setBrowseFilters({ category: "", subcategory: "" });
    setBrowseSnapshot(null);
    setAuthSyncFailed(false);
    setNotice(null);
    if (authModeValue) {
      setAuthMode(authModeValue);
    }
  }

  const syncCurrentUser = useCallback(async ({ overrideToken = null, showError = true } = {}) => {
    if (!isLoaded || !isSignedIn) {
      setUser(null);
      return null;
    }

    try {
      const freshToken =
        overrideToken ||
        (await clerk.session?.getToken?.({ skipCache: true })) ||
        (await getToken({ skipCache: true }));
      const payload = await api("/auth/me", {
        headers: freshToken ? { Authorization: `Bearer ${freshToken}` } : undefined
      });
      const nextUser = payload.data.user || null;
      setUser(nextUser);
      setAuthSyncFailed(false);
      return nextUser;
    } catch (error) {
      setUser(null);
      setAuthSyncFailed(true);
      if (showError) {
        handleApiError(error);
      }
      return null;
    }
  }, [clerk, getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!isLoaded) return;

      if (!isSignedIn) {
        setUser(null);
        resetSessionUiState({ authModeValue: "login" });
        setBooting(false);
        return;
      }

      setBooting(true);
      const nextUser = await syncCurrentUser({ showError: false });
      if (!cancelled && !nextUser) {
        setAuthSyncFailed(true);
        setNotice(normalizeNotice("We could not finish syncing your account with the backend."));
      }
      setBooting(false);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  async function logout() {
    try {
      const activeSessionId = clerk.session?.id || clerk.client?.lastActiveSessionId || undefined;
      await signOut(activeSessionId ? { sessionId: activeSessionId } : undefined);
      await clerk.client?.removeSessions?.();
      setUser(null);
      resetSessionUiState({ authModeValue: "login" });
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      const isNetworkFailure =
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("internet") ||
        message.includes("timeout");

      if (isNetworkFailure) {
        await clerk.client?.removeSessions?.();
        setUser(null);
        resetSessionUiState({ authModeValue: "login" });
        setNotice(
          normalizeNotice({
            tone: "info",
            title: "Signed out on this device",
            message: "We signed you out locally, but the server sign-out is still waiting for a connection.",
            helperTitle: "You can continue safely",
            helperText: "Once your internet is stable again, Clerk will catch up on the server side."
          })
        );
        return;
      }

      setNotice(
        normalizeNotice({
          tone: "error",
          title: isClerkRuntimeError(error) ? "Could not sign out" : "Sign-out failed",
          message: isClerkRuntimeError(error)
            ? "Clerk could not finish signing you out right now."
            : "We could not sign you out right now.",
          helperTitle: "Please try again",
          helperText: "Your current session is still active until sign-out completes successfully."
        })
      );
    }
  }

  function handleAuth(nextUser) {
    setUser(nextUser);
    resetSessionUiState();
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
  } else if (!isSignedIn) {
    content = <AuthScreen mode={authMode} onModeChange={setAuthMode} onSignedIn={syncCurrentUser} onError={handleApiError} />;
  } else if (!user) {
    content = authSyncFailed ? <AuthSyncFailedScreen onRetry={() => syncCurrentUser()} onLogout={logout} /> : (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={COLORS.accent} />
      </SafeAreaView>
    );
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
          onInitialFiltersApplied={() => setBrowseFilters({ category: "", subcategory: "" })}
          onSnapshotChange={setBrowseSnapshot}
          onTabChange={setCustomerTab}
          onOpenBusiness={openCustomerBusiness}
          onError={handleApiError}
          snapshot={browseSnapshot}
        />
      );
    } else if (customerTab === "bookings") {
      content = <CustomerBookingsScreen activeTab={customerTab} onTabChange={setCustomerTab} onError={handleApiError} />;
    } else if (customerTab === "settings") {
      content = <CustomerSettingsScreen user={user} activeTab={customerTab} onTabChange={setCustomerTab} onAuth={handleAuth} onLogout={logout} onOpenBusiness={openCustomerBusiness} onError={handleApiError} />;
    } else {
      content = <CustomerHomeScreen user={user} activeTab={customerTab} onTabChange={setCustomerTab} onOpenBusiness={openCustomerBusiness} onError={handleApiError} recentlyViewed={recentlyViewed} />;
    }
  } else if (user.account_type === "Business") {
    if (businessProfileOpen) {
      content = <BusinessProfileScreen activeTab="settings" onBack={closeBusinessProfile} onTabChange={setBusinessTab} onError={handleApiError} onSuccess={handleApiError} />;
    } else if (businessTab === "slots") {
      content = <BusinessSlotsScreen activeTab={businessTab} onOpenProfile={openBusinessProfile} onTabChange={setBusinessTab} onError={handleApiError} />;
    } else if (businessTab === "bookings") {
      content = <BusinessBookingsScreen activeTab={businessTab} onTabChange={setBusinessTab} onError={handleApiError} />;
    } else if (businessTab === "settings") {
      content = <BusinessSettingsScreen user={user} activeTab={businessTab} onOpenProfile={openBusinessProfile} onTabChange={setBusinessTab} onLogout={logout} />;
    } else {
      content = <BusinessDashboardScreen activeTab={businessTab} onOpenProfile={openBusinessProfile} onTabChange={setBusinessTab} onError={handleApiError} />;
    }
  } else {
    console.warn("Unexpected account type received in App:", user.account_type);
    content = <UnknownAccountTypeScreen accountType={user.account_type} />;
  }

  return (
    <>
      {content}
      {renderNoticeModal()}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {publishableKey ? (
        <ClerkProvider publishableKey={publishableKey} telemetry={false} tokenCache={tokenCache}>
          <AppShell />
        </ClerkProvider>
      ) : (
        <MissingClerkConfigurationScreen />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flex: 1,
    justifyContent: "center"
  },
  unknownAccountCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 360,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: "100%"
  },
  unknownAccountTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center"
  },
  unknownAccountText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  unknownAccountMeta: {
    color: COLORS.mutedText,
    fontSize: 13,
    marginTop: 16,
    textAlign: "center"
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
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 22,
    minHeight: 50
  },
  retryButtonText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "900"
  },
  secondaryLinkButton: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    minHeight: 42
  },
  secondaryLinkButtonText: {
    color: COLORS.light,
    fontSize: 14,
    fontWeight: "800"
  }
});
