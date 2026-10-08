import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "../../config/firebase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState<
    "confirm" | "success" | "error" | null
  >(null);
  const [modalMessage, setModalMessage] = useState("");
  const [destination, setDestination] = useState<
    "admin" | "field-staff" | "customer" | null
  >(null);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      setModalMessage("Please enter your email and password.");
      setModalType("error");
      return;
    }

    setModalType("confirm");
  };

  const submitLogin = async () => {
    setModalType(null);

    try {
      setLoading(true);

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await auth.signOut();
        setModalMessage(
          "Your account does not have a user profile yet."
        );
        setModalType("error");
        return;
      }

      const userData = userDoc.data();
      const role = userData.role;
      const accountStatus = String(userData.status || "active").toLowerCase();

      if (
        accountStatus === "inactive" ||
        accountStatus === "disabled" ||
        accountStatus === "deactivated"
      ) {
        await auth.signOut();
        setModalMessage(
          "Your account has been disabled. Please contact an administrator."
        );
        setModalType("error");
        return;
      }

      if (
        role === "admin" ||
        role === "field-staff" ||
        role === "customer"
      ) {
        setDestination(role);
        setModalMessage("You have signed in successfully.");
        setModalType("success");
      } else {
        await auth.signOut();
        setModalMessage(
          "Your account does not have a valid system role."
        );
        setModalType("error");
      }
    } catch (error: any) {
      console.log("Login error:", error);

      let message = "Unable to login. Please try again.";

      if (error.code === "auth/invalid-credential") {
        message = "Incorrect email or password.";
      } else if (error.code === "auth/user-not-found") {
        message = "No account was found with this email.";
      } else if (error.code === "auth/wrong-password") {
        message = "Incorrect password.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many login attempts. Please try again later.";
      }

      setModalMessage(message);
      setModalType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>

          <Text style={styles.title}>Kur-yente CO</Text>

          <Text style={styles.subtitle}>
            Smart Electricity Management
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome Back</Text>

          <Text style={styles.description}>
            Sign in to manage your electricity account.
          </Text>

          <Text style={styles.label}>Email Address</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#8a8a8a"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>

          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#8a8a8a"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.visibilityButton}
              onPress={() => setShowPassword(!showPassword)}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
              disabled={loading}
            >
              <Text style={styles.visibilityButtonText}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.loginButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#ffffff" />

                <Text style={styles.loginButtonText}>
                  Signing in...
                </Text>
              </View>
            ) : (
              <Text style={styles.loginButtonText}>LOGIN</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />

            <Text style={styles.dividerText}>OR</Text>

            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push("/register")}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              REGISTER
            </Text>
          </TouchableOpacity>

          <Text style={styles.registerDescription}>
            New customer? Create your Kur-yente CO electricity account.
          </Text>
        </View>

        <Text style={styles.footerText}>
          Kur-yente CO Smart Electricity Management System
        </Text>
      </ScrollView>
      <Modal
        visible={modalType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalType === "confirm"
                ? "Confirm Login"
                : modalType === "success"
                  ? "Login Successful"
                  : "Login Failed"}
            </Text>
            <Text style={styles.modalMessage}>
              {modalType === "confirm"
                ? `Sign in with ${email.trim()}?`
                : modalMessage}
            </Text>
            <View style={styles.modalActions}>
              {modalType === "confirm" ? (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setModalType(null)}
                    disabled={loading}
                  >
                    <Text style={styles.modalCancelButtonText}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalPrimaryButton]}
                    onPress={submitLogin}
                    disabled={loading}
                  >
                    <Text style={styles.modalPrimaryButtonText}>
                      Continue
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalPrimaryButton]}
                  onPress={() => {
                    const nextDestination = destination;
                    setModalType(null);
                    setDestination(null);

                    if (nextDestination === "admin") {
                      router.replace("../admin");
                    } else if (nextDestination === "field-staff") {
                      router.replace("../field-staff");
                    } else if (nextDestination === "customer") {
                      router.replace("../customer");
                    }
                  }}
                >
                  <Text style={styles.modalPrimaryButtonText}>
                    {modalType === "success" ? "Continue" : "Close"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef7f0",
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 28,
  },

  logoCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#176b3a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  logoIcon: {
    fontSize: 38,
  },

  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#176b3a",
    letterSpacing: 2,
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: "#5d6b61",
    textAlign: "center",
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  welcome: {
    fontSize: 25,
    fontWeight: "800",
    color: "#1c2b21",
    marginBottom: 6,
  },

  description: {
    fontSize: 14,
    color: "#6b756e",
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#344238",
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#d6e3d9",
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    color: "#1c2b21",
    backgroundColor: "#f9fcfa",
    marginBottom: 18,
  },

  passwordInputContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d6e3d9",
    borderRadius: 12,
    paddingLeft: 15,
    paddingRight: 10,
    backgroundColor: "#f9fcfa",
    marginBottom: 18,
  },

  passwordInput: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontSize: 15,
    color: "#1c2b21",
  },

  visibilityButton: {
    paddingHorizontal: 5,
    paddingVertical: 10,
  },

  visibilityButtonText: {
    color: "#176b3a",
    fontSize: 13,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },

  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: 24,
    backgroundColor: "#ffffff",
  },

  modalTitle: {
    marginBottom: 12,
    color: "#176b3a",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },

  modalMessage: {
    color: "#34443a",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
  },

  modalButton: {
    minHeight: 46,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
  },

  modalCancelButton: {
    borderWidth: 1,
    borderColor: "#d6e3d9",
  },

  modalCancelButtonText: {
    color: "#344238",
    fontSize: 14,
    fontWeight: "700",
  },

  modalPrimaryButton: {
    backgroundColor: "#176b3a",
  },

  modalPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  loginButton: {
    height: 54,
    backgroundColor: "#176b3a",
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },

  disabledButton: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#e1e8e3",
  },

  dividerText: {
    marginHorizontal: 12,
    color: "#8a958e",
    fontSize: 11,
    fontWeight: "700",
  },

  registerButton: {
    height: 54,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#176b3a",
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },

  registerButtonText: {
    color: "#176b3a",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },

  registerDescription: {
    textAlign: "center",
    color: "#7b877f",
    fontSize: 11,
    marginTop: 9,
  },

  footerText: {
    textAlign: "center",
    marginTop: 25,
    fontSize: 12,
    color: "#7b877f",
  },
});