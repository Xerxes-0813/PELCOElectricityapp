import emailjs from "@emailjs/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
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

const EMAILJS_SERVICE_ID = "service_2atow9p";
const EMAILJS_TEMPLATE_ID = "template_59g30fn";
const EMAILJS_PUBLIC_KEY = "lmE3rGy0K-aQ42W5z";

const PENDING_REGISTRATION_KEY = "pending_registration";
const OTP_EXPIRATION_TIME = 5 * 60 * 1000;

type PendingRegistration = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  password: string;
  otp: string;
  expiresAt: number;
};

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");
  const [modalType, setModalType] = useState<
    "confirm" | "success" | "error" | null
  >(null);
  const [modalMessage, setModalMessage] = useState("");

  const handleRegister = () => {
    setMessage("");
    setMessageType("");

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPhoneNumber = phoneNumber.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirstName) {
      setMessage("Please enter your first name.");
      setMessageType("error");
      return;
    }

    if (!cleanLastName) {
      setMessage("Please enter your last name.");
      setMessageType("error");
      return;
    }

    if (!/^[A-Za-z]+$/.test(cleanFirstName) || !/^[A-Za-z]+$/.test(cleanLastName)) {
      setMessage("First and last names can contain letters only.");
      setMessageType("error");
      return;
    }

    if (!/^09\d{9}$/.test(cleanPhoneNumber)) {
      setMessage(
        "Please enter exactly 11 digits for a Philippine mobile number starting with 09."
      );
      setMessageType("error");
      return;
    }

    if (!cleanEmail) {
      setMessage("Please enter your email address.");
      setMessageType("error");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setMessage("Please enter a valid email address.");
      setMessageType("error");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      setMessageType("error");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    setModalType("confirm");
  };

  const submitRegistration = async () => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPhoneNumber = phoneNumber.trim();
    const cleanEmail = email.trim().toLowerCase();

    setModalType(null);

    try {
      setLoading(true);

      const generatedOtp = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      const expiresAt =
        Date.now() + OTP_EXPIRATION_TIME;

      const pendingRegistration: PendingRegistration = {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        phoneNumber: cleanPhoneNumber,
        email: cleanEmail,
        password,
        otp: generatedOtp,
        expiresAt,
      };

      await AsyncStorage.setItem(
        PENDING_REGISTRATION_KEY,
        JSON.stringify(pendingRegistration)
      );

      const templateParams = {
        to_name: `${cleanFirstName} ${cleanLastName}`,
        to_email: cleanEmail,
        otp: generatedOtp,
      };

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        {
          publicKey: EMAILJS_PUBLIC_KEY,
        }
      );

      setModalMessage(
        "A verification code has been sent to your email."
      );
      setModalType("success");
    } catch (error: any) {
      console.log("EmailJS error:", error);

      await AsyncStorage.removeItem(
        PENDING_REGISTRATION_KEY
      );

      const errorMessage =
        error?.text ||
        error?.message ||
        "Unable to send the verification code. Please try again.";

      setModalMessage(`Unable to send the verification code: ${errorMessage}`);
      setModalType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>P</Text>
          </View>

          <Text style={styles.title}>
            Create Account
          </Text>

          <Text style={styles.subtitle}>
            Register your Kur-yente CO customer account
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>
              First Name
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter first name"
              placeholderTextColor="#9aa69e"
              value={firstName}
              onChangeText={(value) =>
                setFirstName(value.replace(/[^A-Za-z]/g, ""))
              }
              autoCapitalize="words"
              editable={!loading}
            />

            <Text style={styles.label}>
              Last Name
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter last name"
              placeholderTextColor="#9aa69e"
              value={lastName}
              onChangeText={(value) =>
                setLastName(value.replace(/[^A-Za-z]/g, ""))
              }
              autoCapitalize="words"
              editable={!loading}
            />

            <Text style={styles.label}>
              Mobile Number
            </Text>

            <TextInput
              style={styles.input}
              placeholder="09XXXXXXXXX"
              placeholderTextColor="#9aa69e"
              value={phoneNumber}
              onChangeText={(value) =>
                setPhoneNumber(value.replace(/\D/g, "").slice(0, 11))
              }
              keyboardType="phone-pad"
              maxLength={11}
              editable={!loading}
            />

            <Text style={styles.label}>
              Email Address
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              placeholderTextColor="#9aa69e"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.label}>
              Password
            </Text>

            <View style={styles.inputWithAction}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter password"
                placeholderTextColor="#9aa69e"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
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

            <Text style={styles.label}>
              Confirm Password
            </Text>

            <View style={styles.inputWithAction}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm password"
                placeholderTextColor="#9aa69e"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.visibilityButton}
                onPress={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                disabled={loading}
              >
                <Text style={styles.visibilityButtonText}>
                  {showConfirmPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>

            {message ? (
              <View
                style={[
                  styles.messageBox,
                  messageType === "error"
                    ? styles.errorBox
                    : styles.successBox,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    messageType === "error"
                      ? styles.errorText
                      : styles.successText,
                  ]}
                >
                  {message}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.registerButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading
                  ? "SENDING OTP..."
                  : "REGISTER"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>
                Already have an account? Login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
                ? "Confirm Registration"
                : modalType === "success"
                  ? "Verification Email Sent"
                  : "Registration Error"}
            </Text>
            <Text style={styles.modalMessage}>
              {modalType === "confirm"
                ? `Continue with registration for ${firstName} ${lastName} (${email.trim()})? A one-time verification code will be sent to your email.`
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
                    onPress={submitRegistration}
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
                    const shouldContinue = modalType === "success";
                    setModalType(null);
                    if (shouldContinue) {
                      router.push({
                        pathname: "/otp-verification",
                        params: {
                          email: email.trim().toLowerCase(),
                        },
                      });
                    }
                  }}
                >
                  <Text style={styles.modalPrimaryButtonText}>
                    {modalType === "success"
                      ? "Continue to Verification"
                      : "Close"}
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

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },

  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 28,
    elevation: 5,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },

  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#176b3a",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 18,
  },

  logoText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#176b3a",
    textAlign: "center",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: "#68756d",
    textAlign: "center",
    marginBottom: 25,
  },

  form: {
    width: "100%",
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#34443a",
    marginBottom: 7,
    marginTop: 12,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    color: "#1c2b21",
    backgroundColor: "#fbfdfb",
  },

  inputWithAction: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 12,
    paddingLeft: 15,
    paddingRight: 10,
    backgroundColor: "#fbfdfb",
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
    borderColor: "#d6e2d9",
  },

  modalCancelButtonText: {
    color: "#34443a",
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

  messageBox: {
    borderRadius: 10,
    padding: 12,
    marginTop: 18,
  },

  errorBox: {
    backgroundColor: "#fdecec",
    borderWidth: 1,
    borderColor: "#efb4b4",
  },

  successBox: {
    backgroundColor: "#e9f7ed",
    borderWidth: 1,
    borderColor: "#b8ddc2",
  },

  messageText: {
    fontSize: 13,
    lineHeight: 19,
  },

  errorText: {
    color: "#a32929",
  },

  successText: {
    color: "#176b3a",
  },

  registerButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#176b3a",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },

  disabledButton: {
    opacity: 0.6,
  },

  registerButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  backButton: {
    alignItems: "center",
    marginTop: 20,
  },

  backButtonText: {
    color: "#176b3a",
    fontSize: 13,
    fontWeight: "700",
  },
});