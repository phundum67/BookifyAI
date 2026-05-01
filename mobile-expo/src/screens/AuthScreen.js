import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useClerk, useSignIn, useSignUp } from "@clerk/expo";
import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { AppButton, Card, Screen, styles } from "../components/ui";
import { COLORS } from "../constants";

WebBrowser.maybeCompleteAuthSession();

function GoogleMark() {
  return (
    <Svg height={18} viewBox="0 0 24 24" width={18}>
      <Path
        d="M21.8 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.04-4.4 3.04-7.47Z"
        fill="#4285F4"
      />
      <Path
        d="M12 22c2.76 0 5.08-.91 6.77-2.48l-3.3-2.56c-.91.61-2.08.98-3.47.98-2.67 0-4.93-1.8-5.74-4.22H2.85v2.64A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <Path
        d="M6.26 13.72A5.99 5.99 0 0 1 5.94 12c0-.6.11-1.17.32-1.72V7.64H2.85A10 10 0 0 0 2 12c0 1.57.37 3.06 1.03 4.36l3.23-2.64Z"
        fill="#FBBC05"
      />
      <Path
        d="M12 6.06c1.5 0 2.84.52 3.89 1.53l2.92-2.92C17.07 3.05 14.76 2 12 2A10 10 0 0 0 3.03 7.64l3.23 2.64C7.07 7.86 9.33 6.06 12 6.06Z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function AuthInput({
  icon,
  keyboardType,
  label,
  onChangeText,
  onTrailingPress,
  placeholder,
  secureTextEntry,
  trailingIcon,
  value
}) {
  return (
    <View style={screenStyles.inputBlock}>
      <Text style={screenStyles.inputLabel}>{label}</Text>
      <View style={screenStyles.inputWrap}>
        <Ionicons color="#4B5563" name={icon} size={21} />
        <TextInput
          autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry}
          style={screenStyles.input}
          value={value}
        />
        {trailingIcon ? (
          <Pressable hitSlop={8} onPress={onTrailingPress}>
            <Ionicons color="#4B5563" name={trailingIcon} size={22} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function getClerkErrorMessage(error, fallbackMessage) {
  const firstError = error?.errors?.[0];
  if (firstError?.longMessage) return firstError.longMessage;
  if (firstError?.message) return firstError.message;
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0];
  if (error?.message) return error.message;
  return fallbackMessage;
}

function assertClerkSuccess(result, fallbackMessage) {
  if (result?.error) {
    throw result.error;
  }
  return result;
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
  if (signIn?.create) {
    return signIn.create({ strategy: "password", identifier: emailAddress, password });
  }
  if (signIn?.password) {
    return signIn.password({ emailAddress, password });
  }
  throw new Error("This Clerk setup could not start sign in.");
}

async function startGoogleAccountPicker({ redirectUrl, signIn, signUp }) {
  if (!signIn?.create) {
    throw new Error("This Clerk setup could not start Google sign-in.");
  }

  await signIn.create({
    strategy: "oauth_google",
    redirectUrl,
    oidcPrompt: "select_account"
  });

  const externalUrl = signIn.firstFactorVerification?.externalVerificationRedirectURL;
  if (!externalUrl) {
    throw new Error("Google sign-in could not open the account picker.");
  }

  const authSessionResult = await WebBrowser.openAuthSessionAsync(externalUrl.toString(), redirectUrl);
  if (authSessionResult.type !== "success" || !authSessionResult.url) {
    return { authSessionResult, createdSessionId: null, signIn, signUp };
  }

  const rotatingTokenNonce = new URL(authSessionResult.url).searchParams.get("rotating_token_nonce") || "";
  await signIn.reload({ rotatingTokenNonce });

  if (signIn.firstFactorVerification?.status === "transferable" && signUp?.create) {
    await signUp.create({ transfer: true });
  }

  return {
    authSessionResult,
    createdSessionId: signUp?.createdSessionId || signIn.createdSessionId,
    signIn,
    signUp
  };
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

async function beginPasswordReset(signIn, emailAddress) {
  if (signIn?.create) {
    assertClerkSuccess(
      await signIn.create({ identifier: emailAddress }),
      "We could not start password reset."
    );
  }

  if (signIn?.resetPasswordEmailCode?.sendCode) {
    return assertClerkSuccess(
      await signIn.resetPasswordEmailCode.sendCode(),
      "We could not send a reset code."
    );
  }
  if (signIn?.sendResetPasswordEmailCode) {
    return assertClerkSuccess(
      await signIn.sendResetPasswordEmailCode(),
      "We could not send a reset code."
    );
  }
  if (signIn?.prepareFirstFactor) {
    return assertClerkSuccess(
      await signIn.prepareFirstFactor({ strategy: "reset_password_email_code" }),
      "We could not send a reset code."
    );
  }
  throw new Error("This Clerk setup could not start password reset.");
}

async function verifyPasswordResetCode(signIn, code) {
  if (signIn?.resetPasswordEmailCode?.verifyCode) {
    return assertClerkSuccess(
      await signIn.resetPasswordEmailCode.verifyCode({ code }),
      "That reset code could not be verified."
    );
  }
  if (signIn?.verifyResetPasswordEmailCode) {
    return assertClerkSuccess(
      await signIn.verifyResetPasswordEmailCode({ code }),
      "That reset code could not be verified."
    );
  }
  if (signIn?.attemptFirstFactor) {
    return assertClerkSuccess(
      await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code }),
      "That reset code could not be verified."
    );
  }
  throw new Error("This Clerk setup could not verify the reset code.");
}

async function submitPasswordReset(signIn, password) {
  if (signIn?.resetPasswordEmailCode?.submitPassword) {
    return assertClerkSuccess(
      await signIn.resetPasswordEmailCode.submitPassword({ password }),
      "Your new password could not be saved."
    );
  }
  if (signIn?.submitResetPassword) {
    return assertClerkSuccess(
      await signIn.submitResetPassword({ password }),
      "Your new password could not be saved."
    );
  }
  throw new Error("This Clerk setup could not save the new password.");
}

export function AuthScreen({ mode, onModeChange, onSignedIn, onError }) {
  const { isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();
  const { setActive } = clerk;
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordResetStep, setPasswordResetStep] = useState(null);
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const emailPasswordReady = authLoaded && (mode === "signup" ? !!signUp : !!signIn);
  const googleReady = authLoaded && !!signIn && !!signUp;
  const passwordResetActive = passwordResetStep !== null;

  useEffect(() => {
    setVerificationCode("");
    setAwaitingVerification(false);
    setShowPassword(false);
    setPasswordResetStep(null);
    setResetCode("");
    setResetNewPassword("");
    setShowResetPassword(false);
  }, [mode]);

  const busyLabel = useMemo(() => {
    if (loading && awaitingVerification) return "Checking code...";
    if (loading) return "Please wait...";
    return null;
  }, [awaitingVerification, loading]);

  function getClientSessions() {
    return clerk.client?.sessions || [];
  }

  function getNewestKnownSession() {
    const sessions = getClientSessions();
    if (!sessions.length) return null;

    return [...sessions].sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    })[0];
  }

  async function resolveSessionId(preferredSessionId, resource) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const newestKnownSession = getNewestKnownSession();
      const sessionId =
        preferredSessionId ||
        resource?.createdSessionId ||
        resource?.existingSession?.sessionId ||
        clerk.client?.lastActiveSessionId ||
        newestKnownSession?.id ||
        clerk.session?.id;

      if (sessionId) {
        return sessionId;
      }

      const clerkAny = clerk;
      if (typeof clerkAny.__internal_reloadInitialResources === "function") {
        await clerkAny.__internal_reloadInitialResources();
      }

      await new Promise((resolve) => setTimeout(resolve, 180));
    }

    return null;
  }

  async function waitForResourceCompletion(resource) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (resource?.status === "complete") {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    return resource?.status === "complete";
  }

  async function finalizeSession(sessionId, resource) {
    const resolvedSessionId = await resolveSessionId(sessionId, resource);
    if (!resolvedSessionId) {
      throw new Error("Authentication completed, but no active session was returned.");
    }

    await setActive({ session: resolvedSessionId });

    let targetSession = null;
    let freshToken = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      targetSession =
        clerk.client?.sessions?.find((session) => session.id === resolvedSessionId) ||
        (clerk.session?.id === resolvedSessionId ? clerk.session : null) ||
        null;

      if (!targetSession) {
        const clerkAny = clerk;
        if (typeof clerkAny.__internal_reloadInitialResources === "function") {
          await clerkAny.__internal_reloadInitialResources();
        }
      }

      freshToken = await targetSession?.getToken?.({ skipCache: true });
      if (freshToken) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 180));
    }

    await onSignedIn({ overrideToken: freshToken || null });
  }

  async function submit() {
    if (loading) return;
    if (!email.trim() || !password.trim() || (mode === "signup" && !name.trim())) {
      onError(new Error("Please fill the required fields."));
      return;
    }

    if (!authLoaded || !emailPasswordReady) {
      onError(new Error("Authentication is still starting. Please wait a moment and try again."));
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
      const completed =
        signInResult?.status === "complete" ||
        signIn?.status === "complete" ||
        await waitForResourceCompletion(signIn);
      if (!completed) {
        throw new Error("Authentication could not be completed with email and password.");
      }
      await finalizeSession(
        signInResult?.createdSessionId ||
          signInResult?.existingSession?.sessionId ||
          signIn?.createdSessionId ||
          signIn?.existingSession?.sessionId,
        signInResult || signIn
      );
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "Could not continue with authentication.")));
    } finally {
      setLoading(false);
    }
  }

  async function submitVerificationCode() {
    if (loading) return;
    if (!verificationCode.trim()) {
      onError(new Error("Please enter the verification code from your email."));
      return;
    }

    setLoading(true);
    try {
      const verificationResult = await verifySignupCode(signUp, verificationCode.trim());
      await finalizeSession(
        verificationResult?.createdSessionId || verificationResult?.existingSession?.sessionId,
        verificationResult || signUp
      );
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "That verification code could not be confirmed.")));
    } finally {
      setLoading(false);
    }
  }

  async function resendVerificationCode() {
    if (loading) return;
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

  async function continueWithGoogle() {
    if (loading) return;
    if (!authLoaded || !googleReady) {
      onError(new Error("Google sign-in is still starting. Please wait a moment and try again."));
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ path: "sso-callback", scheme: "bookifyai" });
      const { createdSessionId, authSessionResult, signIn: googleSignIn, signUp: googleSignUp } = await startGoogleAccountPicker({
        redirectUrl,
        signIn,
        signUp
      });

      if (createdSessionId) {
        await finalizeSession(createdSessionId, googleSignUp || googleSignIn || signIn);
        return;
      }

      if (authSessionResult?.type === "cancel" || authSessionResult?.type === "dismiss") {
        return;
      }

      onError(new Error("Google sign-in could not be completed."));
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "Google sign-in could not be completed.")));
    } finally {
      setLoading(false);
    }
  }

  async function startForgotPassword() {
    if (loading) return;
    if (!email.trim()) {
      onError(new Error("Enter your email address first so we can send the reset code there."));
      return;
    }
    if (!authLoaded || !signIn) {
      onError(new Error("Authentication is still starting. Please wait a moment and try again."));
      return;
    }

    setLoading(true);
    try {
      await beginPasswordReset(signIn, email.trim());
      setPasswordResetStep("code");
      setResetCode("");
      setResetNewPassword("");
      setShowResetPassword(false);
      onError({
        title: "Reset code sent",
        message: "Check your email for the password reset code, then enter it here.",
        tone: "info",
        helperTitle: "Inbox check",
        helperText: "Use the newest email from Clerk if you requested more than one reset code."
      });
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "We could not start password reset.")));
    } finally {
      setLoading(false);
    }
  }

  async function resendResetPasswordCode() {
    if (loading) return;
    if (!email.trim()) {
      onError(new Error("Enter your email address first so we can send the reset code there."));
      return;
    }

    setLoading(true);
    try {
      await beginPasswordReset(signIn, email.trim());
      onError({
        title: "Code sent again",
        message: "A fresh password reset code is on the way to your email.",
        tone: "info",
        helperTitle: "Check your inbox",
        helperText: "Use the newest code if the previous one no longer works."
      });
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "We could not resend the reset code.")));
    } finally {
      setLoading(false);
    }
  }

  async function submitResetCode() {
    if (loading) return;
    if (!resetCode.trim()) {
      onError(new Error("Please enter the password reset code from your email."));
      return;
    }

    setLoading(true);
    try {
      await verifyPasswordResetCode(signIn, resetCode.trim());
      setPasswordResetStep("password");
      onError({
        title: "Code verified",
        message: "Now create a new password for your Booklify account.",
        tone: "success",
        helperTitle: "One more step",
        helperText: "Choose a password you will remember the next time you sign in."
      });
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "That reset code could not be verified.")));
    } finally {
      setLoading(false);
    }
  }

  async function submitNewPassword() {
    if (loading) return;
    if (!resetNewPassword.trim()) {
      onError(new Error("Please enter your new password."));
      return;
    }

    setLoading(true);
    try {
      await submitPasswordReset(signIn, resetNewPassword);
      await finalizeSession(signIn?.createdSessionId || signIn?.existingSession?.sessionId, signIn);
    } catch (error) {
      onError(new Error(getClerkErrorMessage(error, "Your new password could not be saved.")));
    } finally {
      setLoading(false);
    }
  }

  function exitPasswordReset() {
    setPasswordResetStep(null);
    setResetCode("");
    setResetNewPassword("");
    setShowResetPassword(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Screen>
        <View style={screenStyles.topSpacing} />
        <View style={screenStyles.heroSection}>
          <View style={screenStyles.heroCopy}>
            <Text style={screenStyles.heroEyebrow}>BOOKLIFY AI</Text>
            <Text style={screenStyles.heroTitle}>
              {awaitingVerification
                ? "Verify your email"
                : passwordResetActive
                  ? "Reset password"
                  : mode === "signup"
                    ? "Create account"
                    : "Welcome back"}
            </Text>
            <Text numberOfLines={2} style={screenStyles.heroSubtitle}>
              {awaitingVerification
                ? "Enter the code sent to your email to finish setting up your account."
                : passwordResetStep === "code"
                  ? "Enter the reset code from your email so we can safely unlock your account."
                  : passwordResetStep === "password"
                    ? "Create a new password and we will take you right back into Booklify."
                : "Book trusted local businesses and manage your plans from one place."}
            </Text>
          </View>
        </View>
        <Card style={screenStyles.authCard}>
          {!awaitingVerification && !emailPasswordReady ? (
            <Text style={screenStyles.connectingText}>
              Authentication is connecting to Clerk. The buttons will be ready in a moment.
            </Text>
          ) : null}

          {awaitingVerification ? (
            <>
              <AuthInput
                icon="mail-open-outline"
                keyboardType="number-pad"
                label="Verification code"
                onChangeText={setVerificationCode}
                placeholder="Enter the code from your email"
                value={verificationCode}
              />
              <Pressable
                style={({ pressed }) => [screenStyles.primaryAction, pressed && styles.pressed]}
                onPress={submitVerificationCode}
              >
                <Text style={screenStyles.primaryActionText}>{busyLabel || "Verify email"}</Text>
                <View style={screenStyles.primaryActionArrow}>
                  <Ionicons color="#FFFFFF" name="arrow-forward" size={24} />
                </View>
              </Pressable>
              <Pressable
                style={({ pressed }) => [screenStyles.googleButton, pressed && styles.pressed]}
                onPress={resendVerificationCode}
              >
                <Text style={screenStyles.googleButtonText}>Resend code</Text>
              </Pressable>
            </>
          ) : passwordResetActive ? (
            <>
              <Text style={screenStyles.connectingText}>
                {passwordResetStep === "code"
                  ? `We sent a reset code to ${email.trim()}. Enter it below to continue.`
                  : `Create a new password for ${email.trim()}.`}
              </Text>
              {passwordResetStep === "code" ? (
                <>
                  <AuthInput
                    icon="mail-open-outline"
                    keyboardType="number-pad"
                    label="Reset code"
                    onChangeText={setResetCode}
                    placeholder="Enter the code from your email"
                    value={resetCode}
                  />
                  <Pressable
                    style={({ pressed }) => [screenStyles.primaryAction, pressed && styles.pressed]}
                    onPress={submitResetCode}
                  >
                    <Text style={screenStyles.primaryActionText}>{loading ? "Verifying code..." : "Verify code"}</Text>
                    <View style={screenStyles.primaryActionArrow}>
                      <Ionicons color="#FFFFFF" name="arrow-forward" size={24} />
                    </View>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [screenStyles.googleButton, pressed && styles.pressed]}
                    onPress={resendResetPasswordCode}
                  >
                    <Text style={screenStyles.googleButtonText}>Resend reset code</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <AuthInput
                    icon="lock-closed-outline"
                    label="New password"
                    onChangeText={setResetNewPassword}
                    onTrailingPress={() => setShowResetPassword((value) => !value)}
                    placeholder="Create a new password"
                    secureTextEntry={!showResetPassword}
                    trailingIcon={showResetPassword ? "eye-outline" : "eye-off-outline"}
                    value={resetNewPassword}
                  />
                  <Pressable
                    style={({ pressed }) => [screenStyles.primaryAction, pressed && styles.pressed]}
                    onPress={submitNewPassword}
                  >
                    <Text style={screenStyles.primaryActionText}>{loading ? "Saving password..." : "Save new password"}</Text>
                    <View style={screenStyles.primaryActionArrow}>
                      <Ionicons color="#FFFFFF" name="arrow-forward" size={24} />
                    </View>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [screenStyles.googleButton, pressed && styles.pressed]}
                    onPress={() => setPasswordResetStep("code")}
                  >
                    <Text style={screenStyles.googleButtonText}>Back to code entry</Text>
                  </Pressable>
                </>
              )}
            </>
          ) : (
            <>
              {mode === "signup" ? (
                <AuthInput
                  icon="person-outline"
                  label="Full name"
                  onChangeText={setName}
                  placeholder="Your name"
                  value={name}
                />
              ) : null}
              <AuthInput
                icon="mail-outline"
                keyboardType="email-address"
                label="Email address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                value={email}
              />
              <AuthInput
                icon="lock-closed-outline"
                label="Password"
                onChangeText={setPassword}
                onTrailingPress={() => setShowPassword((value) => !value)}
                placeholder={mode === "signup" ? "Enter your password" : "Enter your password"}
                secureTextEntry={!showPassword}
                trailingIcon={showPassword ? "eye-outline" : "eye-off-outline"}
                value={password}
              />
              {mode === "login" ? (
                <Pressable hitSlop={8} onPress={startForgotPassword}>
                  <Text style={screenStyles.forgotPassword}>Forgot password?</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={!emailPasswordReady || loading}
                style={({ pressed }) => [
                  screenStyles.primaryAction,
                  (!emailPasswordReady || loading) && screenStyles.primaryActionDisabled,
                  pressed && styles.pressed
                ]}
                onPress={submit}
              >
                <Text style={screenStyles.primaryActionText}>
                  {!emailPasswordReady ? "Starting authentication..." : busyLabel || (mode === "signup" ? "Create account" : "Sign in")}
                </Text>
                <View style={screenStyles.primaryActionArrow}>
                  <Ionicons color="#FFFFFF" name="arrow-forward" size={24} />
                </View>
              </Pressable>
              <View style={screenStyles.dividerRow}>
                <View style={screenStyles.dividerLine} />
                <Text style={screenStyles.dividerText}>or continue with</Text>
                <View style={screenStyles.dividerLine} />
              </View>
              <Pressable
                disabled={!googleReady || loading}
                style={({ pressed }) => [
                  screenStyles.googleButton,
                  (!googleReady || loading) && screenStyles.googleButtonDisabled,
                  pressed && styles.pressed
                ]}
                onPress={continueWithGoogle}
              >
                <View style={screenStyles.googleBadge}>
                  <GoogleMark />
                </View>
                <Text style={screenStyles.googleButtonText}>
                  {!googleReady ? "Preparing Google..." : loading ? "Opening Google..." : "Continue with Google"}
                </Text>
              </Pressable>
            </>
          )}

          {!awaitingVerification && !passwordResetActive ? (
            <Pressable
              style={({ pressed }) => [screenStyles.modeButton, pressed && styles.pressed]}
              onPress={() => onModeChange(mode === "signup" ? "login" : "signup")}
            >
              <Ionicons color="#4B5563" name={mode === "signup" ? "log-in-outline" : "person-add-outline"} size={24} />
              <Text numberOfLines={1} style={screenStyles.modeButtonText}>
                {mode === "signup" ? "Already have an account? Login" : "New here? Create new account"}
              </Text>
              <Ionicons color="#4B5563" name="chevron-forward" size={24} />
            </Pressable>
          ) : passwordResetActive ? (
            <Pressable style={({ pressed }) => [screenStyles.modeButton, pressed && styles.pressed]} onPress={exitPasswordReset}>
              <Ionicons color="#4B5563" name="arrow-back-outline" size={22} />
              <Text style={screenStyles.modeButtonText}>Back to sign in</Text>
              <Ionicons color="#4B5563" name="chevron-forward" size={24} />
            </Pressable>
          ) : (
            <Pressable style={({ pressed }) => [screenStyles.modeButton, pressed && styles.pressed]} onPress={() => setAwaitingVerification(false)}>
              <Ionicons color="#4B5563" name="arrow-back-outline" size={22} />
              <Text style={screenStyles.modeButtonText}>Back to sign up</Text>
              <Ionicons color="#4B5563" name="chevron-forward" size={24} />
            </Pressable>
          )}
        </Card>
        <View style={screenStyles.securityRow}>
          <Ionicons color="#4B5563" name="shield-checkmark-outline" size={19} />
          <Text numberOfLines={2} style={screenStyles.securityText}>
            Your data is safe and secure with <Text style={screenStyles.securityTextStrong}>Clerk</Text> authentication.
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const screenStyles = StyleSheet.create({
  authCard: {
    borderRadius: 28,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14
  },
  connectingText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 10
  },
  dividerLine: {
    backgroundColor: "#E5E7EB",
    flex: 1,
    height: 1
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    marginBottom: 12
  },
  dividerText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700"
  },
  forgotPassword: {
    alignSelf: "flex-end",
    color: "#4B5563",
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 0
  },
  googleBadge: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 0,
    minHeight: 52,
    paddingHorizontal: 16
  },
  googleButtonDisabled: {
    opacity: 0.72
  },
  googleButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  heroCopy: {
    maxWidth: "100%",
    minHeight: 0,
    paddingTop: 0
  },
  heroEyebrow: {
    color: "#30343F",
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: 2.8,
    marginBottom: 6
  },
  heroSection: {
    marginBottom: 0,
    minHeight: 0,
    position: "relative"
  },
  heroSubtitle: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20
  },
  heroTitle: {
    color: "#111111",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 33,
    marginBottom: 10
  },
  input: {
    color: "#111827",
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    minHeight: 52
  },
  inputBlock: {
    marginBottom: 12
  },
  inputLabel: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 14
  },
  modeButton: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 14,
    minHeight: 54,
    paddingHorizontal: 14
  },
  modeButtonText: {
    color: "#4B5563",
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
    paddingLeft: 4,
    paddingRight: 6
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: "#202225",
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 6,
    minHeight: 54,
    paddingHorizontal: 18,
    position: "relative"
  },
  primaryActionArrow: {
    position: "absolute",
    right: 18
  },
  primaryActionDisabled: {
    opacity: 0.72
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  securityRow: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
    marginLeft: 10,
    paddingBottom: 12,
    paddingHorizontal: 14
  },
  securityText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    maxWidth: "88%"
  },
  securityTextStrong: {
    color: "#30343F",
    fontWeight: "800"
  },
  topSpacing: {
    height: 4
  }
});
