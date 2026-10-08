import { router } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
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

const ELECTRICITY_RATE = 12;

type Application = {
  id: string;
  customerId: string;
  customerEmail: string;
  fullName: string;
  contactNumber: string;
  serviceAddress: string;
  connectionType: string;
  status: string;

  rejectionReason?: string;

  inspectionResult?: string;
  inspectionNotes?: string;
  inspectedAt?: any;

  submittedAt?: any;
  updatedAt?: any;

  meterNumber?: string;
  meterStatus?: string;
  installedAt?: any;

  currentReading?: number;
  previousReading?: number;
  consumption?: number;
  readingRate?: number;
  estimatedBill?: number;
  readingUpdatedAt?: any;
};

type ReadingInputs = {
  [applicationId: string]: string;
};

const generateMeterNumber = () => {
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `MTR-${year}-${randomNumber}`;
};

export default function FieldStaffScreen() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingInputs, setReadingInputs] = useState<ReadingInputs>({});
  const [savingReadingId, setSavingReadingId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const applicationsQuery = query(
      collection(db, "applications"),
      orderBy("submittedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      applicationsQuery,
      (snapshot) => {
        const applicationList: Application[] = snapshot.docs.map(
          (document) => ({
            id: document.id,
            ...(document.data() as Omit<Application, "id">),
          })
        );

        setApplications(applicationList);
        setLoading(false);
      },
      (error) => {
        console.log("Field Staff applications error:", error);

        setLoading(false);

        Alert.alert(
          "Unable to Load Applications",
          "There was a problem loading the field staff work queue."
        );
      }
    );

    return unsubscribe;
  }, []);

  const formatDate = (value: any) => {
    if (!value) {
      return "Not available";
    }

    try {
      const date = value?.toDate ? value.toDate() : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "Not available";
      }

      return date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Not available";
    }
  };

  const formatCurrency = (value?: number) => {
    return `₱${(value ?? 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatKwh = (value?: number) => {
    return `${(value ?? 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} kWh`;
  };

  const updateReadingInput = (
    applicationId: string,
    value: string
  ) => {
    const cleanedValue = value.replace(/[^0-9.]/g, "");

    setReadingInputs((current) => ({
      ...current,
      [applicationId]: cleanedValue,
    }));
  };

  const handlePassInspection = async (
    application: Application
  ) => {
    try {
      await updateDoc(doc(db, "applications", application.id), {
        status: "inspection_passed",
        inspectionResult: "passed",
        inspectionNotes:
          "Site inspection passed by PELCO field staff.",
        inspectedAt: new Date(),
        updatedAt: new Date(),
      });

      Alert.alert(
        "Inspection Passed",
        `${application.fullName}'s site inspection has been marked as passed.`
      );
    } catch (error) {
      console.log("Pass inspection error:", error);

      Alert.alert(
        "Error",
        "Unable to update the inspection result."
      );
    }
  };

  const handleReinspect = async (
    application: Application
  ) => {
    try {
      await updateDoc(doc(db, "applications", application.id), {
        status: "reinspect",
        inspectionResult: "reinspect",
        inspectionNotes:
          "Site requires corrections and another inspection before installation.",
        updatedAt: new Date(),
      });

      Alert.alert(
        "Re-Inspection Required",
        `${application.fullName}'s application has been returned for re-inspection.`
      );
    } catch (error) {
      console.log("Reinspection error:", error);

      Alert.alert(
        "Error",
        "Unable to update the application."
      );
    }
  };

  const handleRejectInspection = async (
    application: Application
  ) => {
    try {
      await updateDoc(doc(db, "applications", application.id), {
        status: "inspection_rejected",
        inspectionResult: "rejected",
        inspectionNotes:
          "Site inspection did not pass. Corrections are required before installation.",
        rejectionReason:
          "Site inspection did not pass. Corrections are required before installation.",
        inspectedAt: new Date(),
        updatedAt: new Date(),
      });

      Alert.alert(
        "Inspection Rejected",
        `${application.fullName}'s site inspection has been rejected.`
      );
    } catch (error) {
      console.log("Reject inspection error:", error);

      Alert.alert(
        "Error",
        "Unable to update the inspection result."
      );
    }
  };

  const handleInstallMeter = async (
    application: Application
  ) => {
    try {
      const meterNumber = generateMeterNumber();

      await updateDoc(doc(db, "applications", application.id), {
        status: "active",
        meterNumber,
        meterStatus: "active",
        installedAt: new Date(),

        previousReading: 0,
        currentReading: 0,
        consumption: 0,
        readingRate: ELECTRICITY_RATE,
        estimatedBill: 0,
        readingUpdatedAt: new Date(),

        updatedAt: new Date(),
      });

      Alert.alert(
        "Meter Installed",
        `Meter ${meterNumber} has been installed and the electricity service is now active.`
      );
    } catch (error) {
      console.log("Install meter error:", error);

      Alert.alert(
        "Installation Error",
        "Unable to install the meter. Please try again."
      );
    }
  };

  const handleSaveReading = async (
    application: Application
  ) => {
    const inputValue = readingInputs[application.id]?.trim();

    if (!inputValue) {
      Alert.alert(
        "Reading Required",
        "Please enter the new meter reading."
      );

      return;
    }

    const newReading = Number(inputValue);

    if (!Number.isFinite(newReading)) {
      Alert.alert(
        "Invalid Reading",
        "Please enter a valid numeric meter reading."
      );

      return;
    }

    if (newReading < 0) {
      Alert.alert(
        "Invalid Reading",
        "Meter reading cannot be negative."
      );

      return;
    }

    const previousReading = application.currentReading ?? 0;

    if (newReading < previousReading) {
      Alert.alert(
        "Invalid Reading",
        `The new reading (${newReading} kWh) cannot be lower than the previous reading (${previousReading} kWh).`
      );

      return;
    }

    const consumption = newReading - previousReading;
    const estimatedBill = consumption * ELECTRICITY_RATE;

    setSavingReadingId(application.id);

    try {
      console.log("Saving simulated meter reading:", {
        applicationId: application.id,
        meterNumber: application.meterNumber,
        previousReading,
        currentReading: newReading,
        consumption,
        rate: ELECTRICITY_RATE,
        estimatedBill,
      });

      await updateDoc(doc(db, "applications", application.id), {
        previousReading,
        currentReading: newReading,
        consumption,
        readingRate: ELECTRICITY_RATE,
        estimatedBill,
        readingUpdatedAt: new Date(),
        updatedAt: new Date(),
      });

      await addDoc(collection(db, "meterReadings"), {
        applicationId: application.id,
        customerId: application.customerId,
        customerEmail: application.customerEmail,

        fullName: application.fullName,
        meterNumber: application.meterNumber || "",

        previousReading,
        currentReading: newReading,
        consumption,

        electricityRate: ELECTRICITY_RATE,
        estimatedBill,

        readingDate: new Date(),
        createdAt: new Date(),
      });

      setReadingInputs((current) => ({
        ...current,
        [application.id]: "",
      }));

      Alert.alert(
        "Reading Saved",
        `Meter reading saved successfully.\n\nPrevious: ${previousReading.toFixed(
          2
        )} kWh\nCurrent: ${newReading.toFixed(
          2
        )} kWh\nConsumption: ${consumption.toFixed(
          2
        )} kWh\nEstimated Bill: ${formatCurrency(estimatedBill)}`
      );
    } catch (error) {
      console.log("Save reading error:", error);

      Alert.alert(
        "Save Error",
        "Unable to save the meter reading. Please check your Firebase connection and try again."
      );
    } finally {
      setSavingReadingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace("/");
    } catch (error) {
      console.log("Logout error:", error);

      Alert.alert(
        "Logout Error",
        "Unable to log out right now. Please try again."
      );
    }
  };

  const inspectionApplications = applications.filter(
    (application) =>
      application.status === "approved" ||
      application.status === "inspection" ||
      application.status === "reinspect"
  );

  const passedApplications = applications.filter(
    (application) => application.status === "inspection_passed"
  );

  const installedApplications = applications.filter(
    (application) => application.status === "active"
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176b3a" />

        <Text style={styles.loadingText}>
          Loading field staff dashboard...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>
              PELCO FIELD STAFF PORTAL
            </Text>

            <Text style={styles.headerTitle}>
              Field Staff Dashboard
            </Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* INTRO */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>
            Field Operations
          </Text>

          <Text style={styles.introText}>
            Review approved applications, perform site inspections,
            install meters, and record simulated electricity meter
            readings.
          </Text>
        </View>

        {/* STATS */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {inspectionApplications.length}
            </Text>

            <Text style={styles.statLabel}>
              For Inspection
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {passedApplications.length}
            </Text>

            <Text style={styles.statLabel}>
              Ready for Meter
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {installedApplications.length}
            </Text>

            <Text style={styles.statLabel}>
              Active Meters
            </Text>
          </View>
        </View>

        {/* INSPECTION QUEUE */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Site Inspection Queue
          </Text>

          <Text style={styles.sectionCount}>
            {inspectionApplications.length} application
            {inspectionApplications.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {inspectionApplications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No Inspection Tasks
            </Text>

            <Text style={styles.emptyText}>
              Approved applications will appear here when they are
              ready for site inspection.
            </Text>
          </View>
        ) : (
          inspectionApplications.map((application) => (
            <View
              key={application.id}
              style={styles.applicationCard}
            >
              <View style={styles.applicationHeader}>
                <View style={styles.applicationHeaderText}>
                  <Text style={styles.customerName}>
                    {application.fullName}
                  </Text>

                  <Text style={styles.connectionType}>
                    {application.connectionType} Connection
                  </Text>
                </View>

                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>
                    {application.status === "reinspect"
                      ? "RE-INSPECT"
                      : "FOR INSPECTION"}
                  </Text>
                </View>
              </View>

              <View style={styles.applicationDivider} />

              <Text style={styles.detailLabel}>
                Service Address
              </Text>

              <Text style={styles.detailValue}>
                {application.serviceAddress}
              </Text>

              <View style={styles.detailRow}>
                <View style={styles.detailColumn}>
                  <Text style={styles.detailLabel}>
                    Contact
                  </Text>

                  <Text style={styles.detailValue}>
                    {application.contactNumber}
                  </Text>
                </View>

                <View style={styles.detailColumn}>
                  <Text style={styles.detailLabel}>
                    Submitted
                  </Text>

                  <Text style={styles.detailValue}>
                    {formatDate(application.submittedAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.passButton}
                  onPress={() =>
                    handlePassInspection(application)
                  }
                >
                  <Text style={styles.passButtonText}>
                    PASS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.reinspectButton}
                  onPress={() =>
                    handleReinspect(application)
                  }
                >
                  <Text style={styles.reinspectButtonText}>
                    RE-INSPECT
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() =>
                    handleRejectInspection(application)
                  }
                >
                  <Text style={styles.rejectButtonText}>
                    REJECT
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* READY FOR INSTALLATION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Ready for Meter Installation
          </Text>

          <Text style={styles.sectionCount}>
            {passedApplications.length} passed
          </Text>
        </View>

        {passedApplications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No Meters Ready
            </Text>

            <Text style={styles.emptyText}>
              Applications that pass site inspection will appear here
              for meter installation.
            </Text>
          </View>
        ) : (
          passedApplications.map((application) => (
            <View
              key={application.id}
              style={styles.installCard}
            >
              <View style={styles.applicationHeader}>
                <View style={styles.applicationHeaderText}>
                  <Text style={styles.customerName}>
                    {application.fullName}
                  </Text>

                  <Text style={styles.connectionType}>
                    {application.connectionType} Connection
                  </Text>
                </View>

                <View style={styles.passedBadge}>
                  <Text style={styles.passedBadgeText}>
                    INSPECTION PASSED
                  </Text>
                </View>
              </View>

              <View style={styles.applicationDivider} />

              <Text style={styles.detailLabel}>
                Service Address
              </Text>

              <Text style={styles.detailValue}>
                {application.serviceAddress}
              </Text>

              <View style={styles.inspectionResultBox}>
                <Text style={styles.inspectionResultTitle}>
                  Inspection Result
                </Text>

                <Text style={styles.inspectionResultText}>
                  {application.inspectionNotes ||
                    "Site inspection passed by PELCO field staff."}
                </Text>

                <Text style={styles.inspectionDate}>
                  Inspected:{" "}
                  {formatDate(application.inspectedAt)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.installButton}
                onPress={() =>
                  handleInstallMeter(application)
                }
              >
                <Text style={styles.installButtonText}>
                  INSTALL METER & ACTIVATE SERVICE
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ACTIVE METERS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Active Meters
          </Text>

          <Text style={styles.sectionCount}>
            {installedApplications.length} active
          </Text>
        </View>

        {installedApplications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No Active Meters
            </Text>

            <Text style={styles.emptyText}>
              Installed and activated meters will appear here.
            </Text>
          </View>
        ) : (
          installedApplications.map((application) => {
            const previousReading =
              application.currentReading ?? 0;

            const currentReading =
              application.currentReading ?? 0;

            const consumption =
              application.consumption ?? 0;

            const estimatedBill =
              application.estimatedBill ?? 0;

            const isSaving =
              savingReadingId === application.id;

            return (
              <View
                key={application.id}
                style={styles.activeMeterCard}
              >
                {/* METER HEADER */}
                <View style={styles.meterHeader}>
                  <View style={styles.meterHeaderText}>
                    <Text style={styles.meterLabel}>
                      METER NUMBER
                    </Text>

                    <Text style={styles.meterNumber}>
                      {application.meterNumber}
                    </Text>

                    <Text style={styles.customerNameSmall}>
                      {application.fullName}
                    </Text>
                  </View>

                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>
                      ACTIVE
                    </Text>
                  </View>
                </View>

                <View style={styles.applicationDivider} />

                {/* METER INFORMATION */}
                <View style={styles.detailRow}>
                  <View style={styles.detailColumn}>
                    <Text style={styles.detailLabel}>
                      Installation Date
                    </Text>

                    <Text style={styles.detailValue}>
                      {formatDate(application.installedAt)}
                    </Text>
                  </View>

                  <View style={styles.detailColumn}>
                    <Text style={styles.detailLabel}>
                      Rate
                    </Text>

                    <Text style={styles.detailValue}>
                      {formatCurrency(
                        application.readingRate ??
                          ELECTRICITY_RATE
                      )}
                      /kWh
                    </Text>
                  </View>
                </View>

                {/* CURRENT READING */}
                <View style={styles.currentReadingBox}>
                  <Text style={styles.currentReadingLabel}>
                    CURRENT METER READING
                  </Text>

                  <Text style={styles.currentReadingValue}>
                    {formatKwh(currentReading)}
                  </Text>

                  <Text style={styles.currentReadingSubtext}>
                    Previous reading:{" "}
                    {formatKwh(previousReading)}
                  </Text>
                </View>

                {/* CONSUMPTION */}
                <View style={styles.readingSummary}>
                  <View style={styles.readingSummaryItem}>
                    <Text style={styles.readingSummaryLabel}>
                      Consumption
                    </Text>

                    <Text style={styles.readingSummaryValue}>
                      {formatKwh(consumption)}
                    </Text>
                  </View>

                  <View style={styles.readingSummaryItem}>
                    <Text style={styles.readingSummaryLabel}>
                      Estimated Bill
                    </Text>

                    <Text style={styles.readingBillValue}>
                      {formatCurrency(estimatedBill)}
                    </Text>
                  </View>
                </View>

                {/* SIMULATED READING */}
                <View style={styles.simulationBox}>
                  <View style={styles.simulationHeader}>
                    <View>
                      <Text style={styles.simulationTitle}>
                        Simulated Meter Reading
                      </Text>

                      <Text style={styles.simulationDescription}>
                        Enter the latest meter reading to calculate
                        consumption and estimated bill.
                      </Text>
                    </View>

                    <View style={styles.simulationBadge}>
                      <Text style={styles.simulationBadgeText}>
                        SIMULATION
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>
                    New Meter Reading (kWh)
                  </Text>

                  <TextInput
                    style={styles.readingInput}
                    value={
                      readingInputs[application.id] || ""
                    }
                    onChangeText={(value) =>
                      updateReadingInput(
                        application.id,
                        value
                      )
                    }
                    placeholder="Example: 1194"
                    placeholderTextColor="#9aaa9f"
                    keyboardType="decimal-pad"
                    editable={!isSaving}
                  />

                  <Text style={styles.inputHint}>
                    Current reading must be equal to or higher than
                    the previous reading.
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.saveReadingButton,
                      isSaving &&
                        styles.saveReadingButtonDisabled,
                    ]}
                    onPress={() =>
                      handleSaveReading(application)
                    }
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <View style={styles.savingContainer}>
                        <ActivityIndicator
                          size="small"
                          color="#ffffff"
                        />

                        <Text
                          style={styles.saveReadingButtonText}
                        >
                          Saving Reading...
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={styles.saveReadingButtonText}
                      >
                        SAVE METER READING
                      </Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.calculationBox}>
                    <Text style={styles.calculationTitle}>
                      Automatic Calculation
                    </Text>

                    <Text style={styles.calculationText}>
                      New Reading − Previous Reading = Consumption
                    </Text>

                    <Text style={styles.calculationText}>
                      Consumption × ₱
                      {ELECTRICITY_RATE.toFixed(2)} = Estimated Bill
                    </Text>
                  </View>
                </View>

                {application.readingUpdatedAt && (
                  <Text style={styles.readingUpdatedText}>
                    Last reading updated:{" "}
                    {formatDate(
                      application.readingUpdatedAt
                    )}
                  </Text>
                )}
              </View>
            );
          })
        )}

        {/* INFORMATION */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            Field Staff Workflow
          </Text>

          <Text style={styles.infoText}>
            1. Review approved applications.
          </Text>

          <Text style={styles.infoText}>
            2. Perform the customer's site inspection.
          </Text>

          <Text style={styles.infoText}>
            3. Pass, reject, or request re-inspection.
          </Text>

          <Text style={styles.infoText}>
            4. Install the meter after a successful inspection.
          </Text>

          <Text style={styles.infoText}>
            5. Record simulated meter readings as electricity usage
            is recorded.
          </Text>
        </View>

        <Text style={styles.footerText}>
          PELCO Electricity Management System
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
    padding: 20,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef7f0",
  },

  loadingText: {
    marginTop: 12,
    color: "#176b3a",
    fontSize: 15,
    fontWeight: "600",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  headerLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#176b3a",
    letterSpacing: 1,
  },

  headerTitle: {
    marginTop: 3,
    fontSize: 24,
    fontWeight: "800",
    color: "#123d25",
  },

  logoutButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d4e5d8",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },

  logoutButtonText: {
    color: "#176b3a",
    fontWeight: "700",
    fontSize: 13,
  },

  introCard: {
    backgroundColor: "#176b3a",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },

  introTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },

  introText: {
    color: "#e5f5e9",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 13,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dcebe0",
  },

  statNumber: {
    color: "#176b3a",
    fontSize: 22,
    fontWeight: "900",
  },

  statLabel: {
    color: "#708078",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },

  sectionHeader: {
    marginBottom: 10,
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  sectionTitle: {
    color: "#123d25",
    fontSize: 18,
    fontWeight: "800",
  },

  sectionCount: {
    color: "#789080",
    fontSize: 11,
    fontWeight: "700",
  },

  applicationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#dcebe0",
  },

  installCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#cfe3d4",
  },

  activeMeterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#cfe3d4",
  },

  applicationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  applicationHeaderText: {
    flex: 1,
    paddingRight: 10,
  },

  customerName: {
    color: "#193c28",
    fontSize: 17,
    fontWeight: "800",
  },

  customerNameSmall: {
    color: "#6e7d73",
    fontSize: 12,
    marginTop: 5,
  },

  connectionType: {
    color: "#718078",
    fontSize: 12,
    marginTop: 3,
  },

  pendingBadge: {
    backgroundColor: "#fff4d9",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  pendingBadgeText: {
    color: "#936b13",
    fontSize: 9,
    fontWeight: "900",
  },

  passedBadge: {
    backgroundColor: "#dff2e4",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  passedBadgeText: {
    color: "#176b3a",
    fontSize: 9,
    fontWeight: "900",
  },

  activeBadge: {
    backgroundColor: "#dff2e4",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  activeBadgeText: {
    color: "#176b3a",
    fontSize: 9,
    fontWeight: "900",
  },

  applicationDivider: {
    height: 1,
    backgroundColor: "#e8efe9",
    marginVertical: 14,
  },

  detailLabel: {
    color: "#789080",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },

  detailValue: {
    color: "#193c28",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },

  detailRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 14,
  },

  detailColumn: {
    flex: 1,
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },

  passButton: {
    flex: 1,
    backgroundColor: "#176b3a",
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
  },

  passButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },

  reinspectButton: {
    flex: 1,
    backgroundColor: "#fff4d9",
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
  },

  reinspectButtonText: {
    color: "#8c6819",
    fontSize: 10,
    fontWeight: "900",
  },

  rejectButton: {
    flex: 1,
    backgroundColor: "#fff0f0",
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
  },

  rejectButtonText: {
    color: "#a52a2a",
    fontSize: 10,
    fontWeight: "900",
  },

  inspectionResultBox: {
    backgroundColor: "#f1f8f3",
    borderRadius: 10,
    padding: 13,
    marginTop: 15,
  },

  inspectionResultTitle: {
    color: "#176b3a",
    fontSize: 11,
    fontWeight: "900",
  },

  inspectionResultText: {
    color: "#52645a",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  inspectionDate: {
    color: "#87938b",
    fontSize: 10,
    marginTop: 7,
  },

  installButton: {
    backgroundColor: "#176b3a",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },

  installButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },

  meterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  meterHeaderText: {
    flex: 1,
  },

  meterLabel: {
    color: "#789080",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  meterNumber: {
    color: "#123d25",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 3,
  },

  currentReadingBox: {
    backgroundColor: "#176b3a",
    borderRadius: 13,
    padding: 16,
    marginTop: 16,
  },

  currentReadingLabel: {
    color: "#bde4c8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  currentReadingValue: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 3,
  },

  currentReadingSubtext: {
    color: "#d8eddd",
    fontSize: 11,
    marginTop: 4,
  },

  readingSummary: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  readingSummaryItem: {
    flex: 1,
    backgroundColor: "#f4f9f5",
    borderRadius: 10,
    padding: 12,
  },

  readingSummaryLabel: {
    color: "#789080",
    fontSize: 10,
    fontWeight: "700",
  },

  readingSummaryValue: {
    color: "#176b3a",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  readingBillValue: {
    color: "#176b3a",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  simulationBox: {
    backgroundColor: "#f7faf8",
    borderRadius: 13,
    padding: 15,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#dcebe0",
  },

  simulationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  simulationTitle: {
    color: "#193c28",
    fontSize: 15,
    fontWeight: "900",
  },

  simulationDescription: {
    color: "#748279",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
    flex: 1,
  },

  simulationBadge: {
    backgroundColor: "#e5f3e8",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  simulationBadgeText: {
    color: "#176b3a",
    fontSize: 8,
    fontWeight: "900",
  },

  inputLabel: {
    color: "#52645a",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 15,
    marginBottom: 6,
  },

  readingInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbdccf",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    color: "#193c28",
    fontWeight: "700",
  },

  inputHint: {
    color: "#89968e",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },

  saveReadingButton: {
    backgroundColor: "#176b3a",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 13,
  },

  saveReadingButtonDisabled: {
    opacity: 0.65,
  },

  savingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  saveReadingButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },

  calculationBox: {
    backgroundColor: "#edf7ef",
    borderRadius: 9,
    padding: 11,
    marginTop: 12,
  },

  calculationTitle: {
    color: "#176b3a",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 4,
  },

  calculationText: {
    color: "#627168",
    fontSize: 10,
    lineHeight: 16,
  },

  readingUpdatedText: {
    color: "#89968e",
    fontSize: 10,
    marginTop: 10,
  },

  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 22,
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dcebe0",
  },

  emptyTitle: {
    color: "#193c28",
    fontSize: 16,
    fontWeight: "800",
  },

  emptyText: {
    color: "#7a887f",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },

  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#dcebe0",
  },

  infoTitle: {
    color: "#123d25",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },

  infoText: {
    color: "#69776e",
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 5,
  },

  footerText: {
    color: "#8a978f",
    fontSize: 11,
    textAlign: "center",
    marginTop: 22,
  },
});