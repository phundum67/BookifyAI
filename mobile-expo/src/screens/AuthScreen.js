import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import { api } from "../api/client";
import { AppButton, BodyText, Card, Field, Screen, Title, styles } from "../components/ui";

export function AuthScreen({ mode, onModeChange, onAuth, onError }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password.trim() || (mode === "signup" && !name.trim())) {
      onError(new Error("Please fill the required fields."));
      return;
    }

    setLoading(true);
    try {
      const payload = await api(mode === "signup" ? "/auth/signup" : "/auth/login", {
        method: "POST",
        body: { name, phone, email, password }
      });
      onAuth(payload.data.user);
    } catch (error) {
      onError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Screen>
        <View style={{ height: 48 }} />
        <Title eyebrow="Bookify AI">{mode === "signup" ? "Create your account" : "Welcome back"}</Title>
        <Card>
          <BodyText style={{ marginBottom: 14 }}>Book trusted local businesses and manage your plans from one mobile app.</BodyText>
          {mode === "signup" ? (
            <>
              <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
              <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
            </>
          ) : null}
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
          <AppButton onPress={submit}>{loading ? "Please wait..." : mode === "signup" ? "Sign up" : "Login"}</AppButton>
          <AppButton variant="secondary" style={{ marginTop: 10 }} onPress={() => onError(new Error("Google login will be available soon."))}>
            Continue with Google
          </AppButton>
        </Card>
        <AppButton variant="secondary" onPress={() => onModeChange(mode === "signup" ? "login" : "signup")}>
          {mode === "signup" ? "Already have an account? Login" : "New here? Create account"}
        </AppButton>
        <Text style={[styles.bodyText, { marginTop: 20, textAlign: "center" }]}>Powered by your Flask backend on PythonAnywhere.</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
