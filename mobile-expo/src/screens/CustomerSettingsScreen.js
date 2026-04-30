import React, { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Bookmark, Camera, CheckCircle, IndianRupee, Info, Mail, Phone, Shield, ShieldCheck, User } from "lucide-react-native";

import { api } from "../api/client";
import { COLORS } from "../constants";
import { AppButton, BottomTabs, BusinessCard, Card, EmptyState, IconButton, LogoutConfirmSheet, Screen, Title, styles } from "../components/ui";

const tabs = [
  { label: "Home", value: "home" },
  { label: "Browse", value: "browse" },
  { label: "Bookings", value: "bookings" },
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

function ProfileInput({ icon: Icon, label, value, onChangeText, keyboardType }) {
  return (
    <View style={screenStyles.profileField}>
      <Text style={screenStyles.profileLabel}>{label}</Text>
      <View style={screenStyles.profileInputShell}>
        <View style={screenStyles.profileInputIcon}>
          <Icon color={COLORS.accent} size={18} strokeWidth={2} />
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholderTextColor={COLORS.light}
          style={screenStyles.profileInput}
        />
      </View>
    </View>
  );
}

export function CustomerSettingsScreen({ user, activeTab, onTabChange, onAuth, onLogout, onOpenBusiness, onError }) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [profileImage, setProfileImage] = useState(user.profile_image || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [saved, setSaved] = useState([]);
  const [section, setSection] = useState("");
  const [logoutVisible, setLogoutVisible] = useState(false);

  useEffect(() => {
    loadSaved();
  }, []);

  useEffect(() => {
    setName(user.name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setProfileImage(user.profile_image || "");
  }, [user.email, user.name, user.phone, user.profile_image]);

  async function loadSaved() {
    try {
      const payload = await api("/favorites");
      setSaved(payload.data.businesses || []);
    } catch (error) {
      onError(error);
    }
  }

  async function saveProfile() {
    if (savingProfile) return;
    try {
      setSavingProfile(true);
      await api("/auth/profile", { method: "PATCH", body: { name, email, phone, profile_image: profileImage } });
      const refreshedPayload = await api("/auth/me");
      const refreshedUser = refreshedPayload.data.user;
      if (!refreshedUser) {
        throw new Error("Profile was saved, but the app could not refresh your account.");
      }
      if (profileImage && !refreshedUser.profile_image) {
        throw new Error("Profile image did not save on the server yet. Please update PythonAnywhere and try again.");
      }
      onAuth(refreshedUser);
      onError(new Error("Profile saved."));
    } catch (error) {
      onError(error);
    } finally {
      setSavingProfile(false);
    }
  }

  async function pickProfileImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError(new Error("Please allow photo access to upload a profile picture."));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      mediaTypes: ["images"],
      quality: 0.25
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    setProfileImage(asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri);
  }

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
    if (section === "Edit Profile") {
      const initial = (name || user.name || "U").trim().charAt(0).toUpperCase();
      return (
        <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />}>
          <View style={screenStyles.editHeader}>
            <IconButton accessibilityLabel="Back" name="arrow-back-outline" onPress={() => setSection("")} />
            <Text style={screenStyles.editTitle}>Edit profile</Text>
          </View>
          <View style={screenStyles.profileCard}>
            <View style={screenStyles.profileHero}>
              <Pressable style={({ pressed }) => [screenStyles.avatarWrap, pressed && styles.pressed]} onPress={pickProfileImage}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={screenStyles.avatarImage} />
                ) : (
                  <Text style={screenStyles.avatarInitial}>{initial}</Text>
                )}
                <View style={screenStyles.cameraBadge}>
                  <Camera color={COLORS.accent} size={15} strokeWidth={2.4} />
                </View>
              </Pressable>
              <Text style={screenStyles.profileName}>{name || user.name}</Text>
              <Text style={screenStyles.profileHint}>Edit your profile details</Text>
            </View>
            <View style={screenStyles.profileFormCard}>
              <ProfileInput icon={User} label="Name" value={name} onChangeText={setName} />
              <ProfileInput icon={Mail} label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <ProfileInput icon={Phone} label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Pressable
                disabled={savingProfile}
                style={({ pressed }) => [screenStyles.saveProfileButton, savingProfile && screenStyles.saveProfileButtonDisabled, pressed && !savingProfile && styles.pressed]}
                onPress={saveProfile}
              >
                <CheckCircle color="#FFFFFF" size={21} strokeWidth={2.4} />
                <Text style={screenStyles.saveProfileText}>{savingProfile ? "Saving..." : "Save Changes"}</Text>
              </Pressable>
              <View style={screenStyles.secureRow}>
                <View style={screenStyles.secureLine} />
                <ShieldCheck color={COLORS.accent} size={16} strokeWidth={2} />
                <Text style={screenStyles.secureText}>Your information is safe and secure</Text>
                <View style={screenStyles.secureLine} />
              </View>
            </View>
          </View>
        </Screen>
      );
    }
    if (section === "Saved Businesses") {
      return (
        <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />}>
          <Title right={<IconButton accessibilityLabel="Back" name="arrow-back-outline" onPress={() => setSection("")} />}>Saved businesses</Title>
          {saved.length ? saved.map((business) => <BusinessCard key={business.id} business={business} onPress={onOpenBusiness} />) : <EmptyState>No saved businesses yet.</EmptyState>}
        </Screen>
      );
    }
    const copy = {
      Payments: "Payments are not required in this version. You can confirm bookings without paying online.",
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
      <Title>Settings</Title>
      {[
        { title: "Edit Profile", subtitle: "Update your details", icon: User },
        { title: "Saved Businesses", subtitle: saved.length ? `${saved.length} saved` : "View saved places", icon: Bookmark },
        { title: "Payments", subtitle: "Payment options", icon: IndianRupee },
        { title: "Policies", subtitle: "View details", icon: Shield },
        { title: "About Us", subtitle: "View details", icon: Info }
      ].map((item) => (
        <SettingsOptionCard
          key={item.title}
          icon={item.icon}
          subtitle={item.subtitle}
          title={item.title}
          onPress={() => setSection(item.title)}
        />
      ))}
      <AppButton variant="danger" onPress={() => setLogoutVisible(true)}>Logout</AppButton>
      <LogoutConfirmSheet
        visible={logoutVisible}
        accountLabel="customer account"
        onClose={() => setLogoutVisible(false)}
        onConfirm={onLogout}
      />
    </Screen>
  );
}

const screenStyles = StyleSheet.create({
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900"
  },
  avatarImage: {
    borderRadius: 999,
    height: "100%",
    width: "100%"
  },
  avatarWrap: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 4,
    height: 76,
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    width: 76
  },
  cameraBadge: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    bottom: 4,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: -2,
    width: 28
  },
  editHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 16
  },
  editTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900"
  },
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
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2
  },
  profileField: {
    gap: 8,
    marginBottom: 12
  },
  profileFormCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    margin: 12,
    marginTop: 0,
    padding: 16
  },
  profileHero: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
    paddingBottom: 20,
    paddingTop: 16
  },
  profileHint: {
    color: COLORS.light,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4
  },
  profileInput: {
    color: COLORS.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 0
  },
  profileInputIcon: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  profileInputShell: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14
  },
  profileLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900"
  },
  profileName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900"
  },
  saveProfileButton: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 54,
    marginTop: 8,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16
  },
  saveProfileButtonDisabled: {
    opacity: 0.72
  },
  saveProfileText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900"
  },
  secureLine: {
    backgroundColor: COLORS.border,
    flex: 1,
    height: 1
  },
  secureRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 16
  },
  secureText: {
    color: COLORS.light,
    fontSize: 12,
    fontWeight: "700"
  }
});
