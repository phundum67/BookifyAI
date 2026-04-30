import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Info, PenLine, Shield, ShieldQuestionMark, User } from "lucide-react-native";

import { AppButton, BottomTabs, Card, IconButton, LogoutConfirmSheet, Screen, Title, styles } from "../components/ui";

const tabs = [
  { label: "Dashboard", value: "dashboard" },
  { label: "Bookings", value: "bookings" },
  { label: "Slots", value: "slots" },
  { label: "Settings", value: "settings" }
];

const ICON_COLOR = "#4B5563";
const ICON_BG = "#E5E7EB";

function SettingsIcon({ icon: Icon }) {
  return (
    <View style={screenStyles.iconCircle}>
      <Icon color={ICON_COLOR} size={20} strokeWidth={2} />
    </View>
  );
}

function SettingsOptionCard({ icon, title, subtitle, onPress }) {
  return (
    <Pressable style={({ pressed }) => [styles.card, screenStyles.optionCard, pressed && styles.pressed]} onPress={onPress}>
      <SettingsIcon icon={icon} />
      <View style={screenStyles.optionTextBlock}>
        <Text style={styles.businessName}>{title}</Text>
        <Text style={styles.businessLocation}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export function BusinessSettingsScreen({ user, activeTab, onOpenProfile, onTabChange, onLogout }) {
  const [section, setSection] = useState("");
  const [logoutVisible, setLogoutVisible] = useState(false);
  const accountInfoText = [
    `Name: ${user.name || "Not added"}`,
    `Email: ${user.email || "Not added"}`,
    `Phone: ${user.phone || "Not added"}`
  ].join("\n");

  const policyText = `Booklify values your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and protect your data when you use our application.

We may collect basic information such as your name, phone number, email address, and usage data to provide and improve our services. This information is used to manage accounts, process bookings, and enhance user experience.

Booklify does not sell or share your personal information with third parties except when required to provide services or comply with legal obligations. Businesses using the platform may access necessary booking details to fulfill services.

We take reasonable steps to protect your data, but no system is completely secure. By using Booklify, you acknowledge and accept this risk.

You are responsible for maintaining the confidentiality of your account and ensuring that your information is accurate.

Booklify may update this Privacy Policy from time to time. Continued use of the app indicates acceptance of any updates.`;

  const aboutText = `By using Booklify, you agree to comply with these Terms and Conditions.

Booklify is a platform that connects customers with independent businesses offering services. All bookings, pricing, availability, and service quality are controlled by the respective business owners.

Users agree to provide accurate information when creating accounts and making bookings. Businesses agree to provide correct details about their services, pricing, and availability.

Booklify is not responsible for any disputes, cancellations, service issues, damages, or losses arising between users and businesses. Any such matters must be resolved directly between the involved parties.

Users must not misuse the platform, provide false information, or engage in harmful or illegal activities. Booklify reserves the right to suspend or terminate accounts that violate these terms.

Booklify may modify or update these Terms at any time. Continued use of the platform means you accept the updated terms.`;

  function renderSection() {
    if (!section) return null;
    const copy = {
      "Account Info": accountInfoText,
      "Help / Support": "At Booklify, we’re committed to helping you run your business effortlessly. From managing bookings and checking real-time slot availability to handling customer interactions and service listings, everything is designed to be simple and reliable. If you encounter any issues or need assistance with bookings, cancellations, or your business setup, our support team is always ready to help. We focus on fast, dependable support so you can stay focused on growing your business and delivering a seamless experience to your customers.",
      Policies: policyText,
      "About Us": aboutText
    };

    return (
      <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />}>
        <Title right={<IconButton accessibilityLabel="Back" name="arrow-back-outline" onPress={() => setSection("")} />}>{section}</Title>
        <Card>
          <Text style={styles.bodyText}>{copy[section]}</Text>
        </Card>
      </Screen>
    );
  }

  if (section) {
    return renderSection();
  }

  return (
    <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />}>
      <Title>Business settings</Title>
      {[
        ["Edit Profile", "Update business details and pricing", PenLine, onOpenProfile],
        ["Account Info", user.email, User, () => setSection("Account Info")],
        ["Help / Support", "Get help managing your business", ShieldQuestionMark, () => setSection("Help / Support")],
        ["Policies", "Booking and cancellation information", Shield, () => setSection("Policies")],
        ["About Us", "Built for easy local booking", Info, () => setSection("About Us")]
      ].map(([title, subtitle, icon, action]) => (
        <SettingsOptionCard key={title} icon={icon} title={title} subtitle={subtitle} onPress={action} />
      ))}
      <AppButton variant="danger" onPress={() => setLogoutVisible(true)}>Logout</AppButton>
      <LogoutConfirmSheet
        visible={logoutVisible}
        accountLabel="business account"
        onClose={() => setLogoutVisible(false)}
        onConfirm={onLogout}
      />
    </Screen>
  );
}

const screenStyles = StyleSheet.create({
  iconCircle: {
    alignItems: "center",
    backgroundColor: ICON_BG,
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  optionCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  optionTextBlock: {
    flex: 1,
    minWidth: 0
  }
});
