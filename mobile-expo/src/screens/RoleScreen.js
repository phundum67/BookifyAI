import React, { useState } from "react";
import { Text } from "react-native";

import { api } from "../api/client";
import { AppButton, Card, Screen, Title, styles } from "../components/ui";

export function RoleScreen({ onAuth, onError }) {
  const [loading, setLoading] = useState(false);

  async function chooseRole(account_type) {
    setLoading(true);
    try {
      const payload = await api("/auth/role", {
        method: "PATCH",
        body: { account_type }
      });
      onAuth(payload.data.user);
    } catch (error) {
      onError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title eyebrow="Choose your path">How do you want to continue?</Title>
      <Card>
        <Text style={styles.businessName}>Continue as Customer</Text>
        <Text style={[styles.bodyText, { marginVertical: 10 }]}>Browse businesses, save favorites, and book available slots.</Text>
        <AppButton onPress={() => chooseRole("Customer")}>{loading ? "Please wait..." : "Continue as Customer"}</AppButton>
      </Card>
      <Card>
        <Text style={styles.businessName}>Continue as Business</Text>
        <Text style={[styles.bodyText, { marginVertical: 10 }]}>Create your profile, manage slots, and track bookings.</Text>
        <AppButton variant="secondary" onPress={() => chooseRole("Business")}>{loading ? "Please wait..." : "Continue as Business"}</AppButton>
      </Card>
    </Screen>
  );
}
