import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
    doc,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import { useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { auth, db } from "../../config/firebase";

const PENDING_REGISTRATION_KEY = "pending_registration";

type PendingRegistration = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  password: string;
  otp: string;
  expiresAt: number;
};

export default function OtpVerificationScreen() {
  const { email } = useLocalSearchParams<{
    email?: string;
  }>();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  const handleVerifyOtp = async () => {
    setMessage("");
    setMessageType("");

    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      setMessage("Please enter the OTP sent to your email.");
      setMessageType("error");
      return;
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      setMessage("The OTP must contain exactly 6 digits.");
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const storedData = await AsyncStorage.getItem(
        PENDING_REGISTRATION_KEY
      );

      if (!storedData) {
        setMessage(
          "Registration information was not found. Please register again."
        );
        setMessageType("error");
        return;
      }

      const pendingRegistration: PendingRegistration =
        JSON.parse(storedData);

      if (
        email &&
        pendingRegistration.email !== email.toLowerCase()
      ) {
        setMessage(
          "The registration email does not match this verification request."
        );
        setMessageType("error");
        return;
      }

      if (Date.now() > pendingRegistration.expiresAt) {
        await AsyncStorage.removeItem(
          PENDING_REGISTRATION_KEY
        );

        setMessage(
          "This OTP has expired. Please register again to receive a new code."
        );
        setMessageType("error");
        return;
      }

      if (cleanOtp !== pendingRegistration.otp) {
        setMessage(
          "Incorrect OTP. Please check your email and try again."
        );
        setMessageType("error");
        return;
      }

      setMessage(
        "OTP verified. Creating your customer account..."
      );
      setMessageType("success");

      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          pendingRegistration.email,
          pendingRegistration.password
        );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        firstName: pendingRegistration.firstName,
        lastName: pendingRegistration.lastName,
        name: `${pendingRegistration.firstName} ${pendingRegistration.lastName}`,
        phoneNumber: pendingRegistration.phoneNumber,
        email: pendingRegistration.email,
        role: "customer",
        status: "active",
        createdAt: serverTimestamp(),
      });

      await AsyncStorage.removeItem(
        PENDING_REGISTRATION_KEY
      );

      setMessage(
        "Your account has been created successfully!"
      );
      setMessageType("success");

      setTimeout(() => {
        router.replace("/");
      }, 1200);
    } catch (error: any) {
      console.log("OTP verification error:", error);

      let errorMessage =
        "Unable to create your account. Please try again.";

      if (error?.code === "auth/email-already-in-use") {
        errorMessage =
          "This email address is already registered. Please use another email.";
      } else if (error?.code === "auth/invalid-email") {
        errorMessage =
          "The email address is invalid.";
      } else if (error?.code === "auth/weak-password") {
        errorMessage =
          "The password is too weak. Please use at least 6 characters.";
      } else if (
        error?.code === "permission-denied"
      ) {
        errorMessage =
          "Your account was created, but the customer profile could not be saved because of Firestore permissions.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (!loading) {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>P</Text>
        </View>

        <Text style={styles.title}>
          OTP Verification
        </Text>

        <Text style={styles.subtitle}>
          Enter the 6-digit verification code we sent to:
        </Text>

        <Text style={styles.email}>
          {email || "your email"}
        </Text>

        <TextInput
          style={styles.otpInput}
          placeholder="000000"
          placeholderTextColor="#9aa69e"
          value={otp}
          onChangeText={(value) => {
            const numbersOnly = value
              .replace(/\D/g, "")
              .slice(0, 6);

            setOtp(numbersOnly);
          }}
          keyboardType="number-pad"
          maxLength={6}
          editable={!loading}
          textAlign="center"
        />

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
            styles.verifyButton,
            loading && styles.disabledButton,
          ]}
          onPress={handleVerifyOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.verifyButtonText}>
              VERIFY OTP
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>
            BACK TO REGISTRATION
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef7f0",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
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
    marginBottom: 18,
  },

  logoText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#176b3a",
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 14,
    color: "#68756d",
    textAlign: "center",
    lineHeight: 21,
  },

  email: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1c2b21",
    marginTop: 8,
    marginBottom: 25,
    textAlign: "center",
  },

  otpInput: {
    width: "100%",
    height: 58,
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 12,
    backgroundColor: "#fbfdfb",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 8,
    color: "#176b3a",
  },

  messageBox: {
    width: "100%",
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
    textAlign: "center",
  },

  errorText: {
    color: "#a32929",
  },

  successText: {
    color: "#176b3a",
  },

  verifyButton: {
    width: "100%",
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

  verifyButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  backButton: {
    marginTop: 20,
  },

  backButtonText: {
    color: "#176b3a",
    fontSize: 13,
    fontWeight: "700",
  },
});