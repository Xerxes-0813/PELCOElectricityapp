import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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

export default function NewConnectionScreen() {
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [connectionType, setConnectionType] = useState<
    "Residential" | "Commercial" | ""
  >("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePhoneNumberChange = (text: string) => {
    const numbersOnly = text.replace(/[^0-9]/g, "");
    setContactNumber(numbersOnly.slice(0, 11));
  };

  const handleSubmit = async () => {
    console.log("SUBMIT BUTTON PRESSED");

    if (submitting) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      Alert.alert(
        "Not Logged In",
        "Your session has expired. Please log in again."
      );
      return;
    }

    if (!fullName.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter your full name."
      );
      return;
    }

    if (contactNumber.length !== 11) {
      Alert.alert(
        "Invalid Mobile Number",
        "Please enter an 11-digit mobile number."
      );
      return;
    }

    if (!address.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter your complete service address."
      );
      return;
    }

    if (!connectionType) {
      Alert.alert(
        "Missing Information",
        "Please select a connection type."
      );
      return;
    }

    if (!confirmed) {
      Alert.alert(
        "Confirmation Required",
        "Please confirm that the information you provided is correct."
      );
      return;
    }

    try {
      setSubmitting(true);

      console.log("Saving application to Firestore...");

      const applicationData = {
        customerId: user.uid,
        customerEmail: user.email || "",
        fullName: fullName.trim(),
        contactNumber: contactNumber,
        serviceAddress: address.trim(),
        connectionType: connectionType,
        status: "pending",
        rejectionReason: "",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const applicationRef = await addDoc(
        collection(db, "applications"),
        applicationData
      );

      console.log(
        "Application successfully saved:",
        applicationRef.id
      );

      /*
       * IMPORTANT:
       * Firebase has already saved the application.
       * Now immediately return to the customer dashboard.
       */
      setSubmitting(false);

      router.replace("/customer" as any);
    } catch (error: any) {
      console.log("APPLICATION SUBMISSION ERROR:", error);
      console.log("Error code:", error?.code);
      console.log("Error message:", error?.message);

      setSubmitting(false);

      Alert.alert(
        "Submission Failed",
        error?.message ||
          "Something went wrong while submitting your application."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/customer" as any)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>NEW CONNECTION</Text>

          <Text style={styles.headerSubtitle}>
            Electricity Service Application
          </Text>
        </View>

        {/* APPLICANT INFORMATION */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Applicant Information
          </Text>

          <Text style={styles.label}>Full Name</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor="#8a9a90"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Mobile Number</Text>

          <TextInput
            style={styles.input}
            placeholder="09XXXXXXXXX"
            placeholderTextColor="#8a9a90"
            value={contactNumber}
            onChangeText={handlePhoneNumberChange}
            keyboardType="phone-pad"
            maxLength={11}
          />

          <Text style={styles.helperText}>
            Enter your 11-digit mobile number.
          </Text>

          <Text style={styles.label}>Email Address</Text>

          <View style={styles.emailBox}>
            <Text style={styles.emailText}>
              {auth.currentUser?.email || "No email available"}
            </Text>
          </View>

          <Text style={styles.label}>
            Complete Service Address
          </Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="House/Building No., Street, Barangay, City"
            placeholderTextColor="#8a9a90"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* CONNECTION DETAILS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Connection Details
          </Text>

          <Text style={styles.label}>Connection Type</Text>

          <View style={styles.typeContainer}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                connectionType === "Residential" &&
                  styles.typeButtonSelected,
              ]}
              onPress={() =>
                setConnectionType("Residential")
              }
            >
              <Text
                style={[
                  styles.typeButtonText,
                  connectionType === "Residential" &&
                    styles.typeButtonTextSelected,
                ]}
              >
                Residential
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                connectionType === "Commercial" &&
                  styles.typeButtonSelected,
              ]}
              onPress={() =>
                setConnectionType("Commercial")
              }
            >
              <Text
                style={[
                  styles.typeButtonText,
                  connectionType === "Commercial" &&
                    styles.typeButtonTextSelected,
                ]}
              >
                Commercial
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CONFIRMATION */}
        <View style={styles.confirmationCard}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setConfirmed(!confirmed)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkbox,
                confirmed && styles.checkboxChecked,
              ]}
            >
              {confirmed && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>

            <Text style={styles.confirmationText}>
              I confirm that the information I provided is
              correct and complete.
            </Text>
          </TouchableOpacity>
        </View>

        {/* SUBMIT */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            submitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <>
              <ActivityIndicator
                size="small"
                color="#ffffff"
              />

              <Text style={styles.submitButtonText}>
                SUBMITTING APPLICATION...
              </Text>
            </>
          ) : (
            <Text style={styles.submitButtonText}>
              SUBMIT APPLICATION
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          Your application will be reviewed by the PELCO
          administrator before proceeding to site inspection.
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

  scrollContent: {
    paddingBottom: 40,
  },

  header: {
    backgroundColor: "#176b3a",
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 25,
  },

  backButton: {
    marginBottom: 18,
    alignSelf: "flex-start",
  },

  backButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  headerSubtitle: {
    color: "#dcefe2",
    fontSize: 14,
    marginTop: 5,
  },

  card: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 18,
    elevation: 2,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  sectionTitle: {
    color: "#176b3a",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 18,
  },

  label: {
    color: "#294334",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: "#c9d9ce",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e2e24",
    backgroundColor: "#fbfdfb",
  },

  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },

  helperText: {
    color: "#718078",
    fontSize: 12,
    marginTop: 5,
  },

  emailBox: {
    borderWidth: 1,
    borderColor: "#d7e3da",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#f1f5f2",
  },

  emailText: {
    color: "#53635a",
    fontSize: 15,
  },

  typeContainer: {
    flexDirection: "row",
    gap: 10,
  },

  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#b9cdbf",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },

  typeButtonSelected: {
    backgroundColor: "#176b3a",
    borderColor: "#176b3a",
  },

  typeButtonText: {
    color: "#31503d",
    fontSize: 14,
    fontWeight: "700",
  },

  typeButtonTextSelected: {
    color: "#ffffff",
  },

  confirmationCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#e1f0e5",
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#6d8977",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    marginTop: 1,
  },

  checkboxChecked: {
    backgroundColor: "#176b3a",
    borderColor: "#176b3a",
  },

  checkmark: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  confirmationText: {
    flex: 1,
    color: "#34503d",
    fontSize: 13,
    lineHeight: 19,
  },

  submitButton: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: "#176b3a",
    borderRadius: 12,
    minHeight: 54,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    elevation: 3,
  },

  submitButtonDisabled: {
    opacity: 0.7,
  },

  submitButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  note: {
    marginHorizontal: 25,
    marginTop: 14,
    textAlign: "center",
    color: "#718078",
    fontSize: 12,
    lineHeight: 18,
  },
});