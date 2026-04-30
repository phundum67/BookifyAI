import { useClerk, useSignIn, useSignUp } from "@clerk/expo";
import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import { AppButton, BodyText, Card, Field, Screen, Title, styles } from "../components/ui";

function getClerkErrorMessage(error, fallbackMessage) {
  const firstError = error?.errors?.[0];
  if (firstError?.longMessage) return firstError.longMessage;
  if (firstError?.message) return firstError.message;
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0];
  if (error?.message) return error.message;
  return fallbackMessage;
}

async function sendSignupCode(signUp) {
  if (signUp?.verifications?.sendEmailCode) {
    return signUp.verifications.sendEmailCode();
  }
  if (signUp?.sendEmailCode) {
    return signUp.sendEmailCode();
  }
  if (signUp?.prepareEmailAddressVerification) {
    return signUp.prepareEmailAddressVerification({ strategy: "email_code" });
  }
  throw new Error("This Clerk setup could not start email verification.");
}

async function createSignupAttempt(signUp, { emailAddress, firstName, password }) {
  if (signUp?.password) {
    return signUp.password({ emailAddress, firstName, password });
  }
  if (signUp?.create) {
    return signUp.create({ emailAddress, firstName, password });
  }
  throw new Error("This Clerk setup could not start sign up.");
}

async function createSignInAttempt(signIn, { emailAddress, password }) {
  if (signIn?.password) {
    return signIn.password({ emailAddress, password });
  }
  if (signIn?.create) {
    return signIn.create({ identifier: emailAddress, password });
  }
  throw new Error("This Clerk setup could not start sign in.");
}

async function verifySignupCode(signUp, code) {
  if (signUp?.verifications?.verifyEmailCode) {
    return signUp.verifications.verifyEmailCode({ code });
  }
  if (signUp?.verifyEmailCode) {
    return signUp.verifyEmailCode({ code });
  }
  if (signUp?.attemptEmailAddressVerification) {
    return signUp.attemptEmailAddressVerification({ code });
  }
  throw new Error("This Clerk setup could not verify the email code.");
}

export function AuthScreen({ mode, onModeChange, onSignedIn, onError }) {
  const { setActive } = useClerk();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  useEffect(() => {
    setVerificationCode("");
    setAwaitingVerification(false);
  }, [mode]);

  const busyLabel = useMemo(() => {
    if (loading && awaitingVerification) return "Checking code...";
    if (loading) return "Please wait...";
    return null;
  }, [awaitingVerification, loading]);

  async function finalizeSession(sessionId) {
    if (!sessionId) {
      throw new Error("Authentication completed, but no active session was returned.");
    }
    await setActive({ session: sessionId });
    await onSignedIn();
  }

  async function submit() {
    if (!email.trim() || !password.trim() || (mode === "signup" && !name.trim())) {
      onError(new Error("Please fill the required fields."));
      return;
    }

    if (!signInLoaded || !signUpLoaded) {
      onError(new Error("Authentication is still loading. Please try again."));
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await createSignupAttempt(signUp, {
          emailAddress: email.trim(),
          password,
          firstName: name.trim()
        });
        await sendSignupCode(signUp);
        setAwaitingVerification(true);
        onError({
          title: "Verify your email",
          message: "We sent a verification code to your email. Enter it below to finish creating your account.",
          tone: "info",
          helperTitle: "Almost done",
          helperText: "Use the latest code from your inbox to activate your Booklify account."
        });
        return;
      }

      const signInResult = await createSignInAttempt(signIn, {
        emailAddress: email.trim(),
        password
      });
      await finalizeSession(signInResult?.createdSessionId || signIn?.createdSessionId);
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "Could not continue with authentication.")));
    } finally {
      setLoading(false);
    }
  }

  async function submitVerificationCode() {
    if (!verificationCode.trim()) {
      onError(new Error("Please enter the verification code from your email."));
      return;
    }

    setLoading(true);
    try {
      const verificationResult = await verifySignupCode(signUp, verificationCode.trim());
      await finalizeSession(verificationResult?.createdSessionId || signUp?.createdSessionId);
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "That verification code could not be confirmed.")));
    } finally {
      setLoading(false);
    }
  }

  async function resendVerificationCode() {
    setLoading(true);
    try {
      await sendSignupCode(signUp);
      onError({
        title: "Code sent again",
        message: "A fresh verification code is on the way to your email.",
        tone: "info",
        helperTitle: "Check your inbox",
        helperText: "Use the newest code if the previous one no longer works."
      });
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "We could not resend the verification code.")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Screen>
        <View style={{ height: 48 }} />
        <Title eyebrow="Bookify AI">
          {awaitingVerification ? "Verify your email" : mode === "signup" ? "Create your account" : "Welcome back"}
        </Title>
        <Card>
          <BodyText style={{ marginBottom: 14 }}>
            {awaitingVerification
              ? "Enter the code that Clerk sent to your email to finish signing up."
              : "Book trusted local businesses and manage your plans from one mobile app."}
          </BodyText>

          {awaitingVerification ? (
            <>
              <Field
                label="Verification code"
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="Enter the code from your email"
                keyboardType="number-pad"
              />
              <AppButton onPress={submitVerificationCode}>{busyLabel || "Verify email"}</AppButton>
              <AppButton variant="secondary" style={{ marginTop: 10 }} onPress={resendVerificationCode}>
                Resend code
              </AppButton>
            </>
          ) : (
            <>
              {mode === "signup" ? (
                <>
                  <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
                  <Field
                    label="Phone"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                  />
                </>
              ) : null}
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                secureTextEntry
              />
              <AppButton onPress={submit}>{busyLabel || (mode === "signup" ? "Sign up" : "Login")}</AppButton>
            </>
          )}
        </Card>
        {!awaitingVerification ? (
          <AppButton variant="secondary" onPress={() => onModeChange(mode === "signup" ? "login" : "signup")}>
            {mode === "signup" ? "Already have an account? Login" : "New here? Create account"}
          </AppButton>
        ) : (
          <AppButton variant="secondary" onPress={() => setAwaitingVerification(false)}>
            Back to sign up
          </AppButton>
        )}
        <Text style={[styles.bodyText, { marginTop: 20, textAlign: "center" }]}>
          Powered by Clerk authentication and your Flask backend on PythonAnywhere.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
