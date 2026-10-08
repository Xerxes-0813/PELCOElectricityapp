import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter your email and password."
      );
      return;
    }

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

        Alert.alert(
          "Account Setup Error",
          "Your account does not have a user profile yet."
        );

        return;
      }

      const userData = userDoc.data();
      const role = userData.role;

      if (role === "admin") {
        router.replace("../admin");
      } else if (role === "field-staff") {
        router.replace("../field-staff");
      } else if (role === "customer") {
        router.replace("../customer");
      } else {
        await auth.signOut();

        Alert.alert(
          "Invalid Role",
          "Your account does not have a valid system role."
        );
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

      Alert.alert("Login Failed", message);
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

          <Text style={styles.title}>PELCO</Text>

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

          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#8a8a8a"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

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
            New customer? Create your PELCO electricity account.
          </Text>
        </View>

        <Text style={styles.footerText}>
          PELCO Smart Electricity Management System
        </Text>
      </ScrollView>
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