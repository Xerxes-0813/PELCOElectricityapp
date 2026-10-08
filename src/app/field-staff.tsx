import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
  lastMeterReading?: number;
  lastReadingConsumption?: number;
  lastEstimatedBill?: number;
  billingCycleStartedAt?: any;
  readingUpdatedAt?: any;
};

type ReadingInputs = {
  [applicationId: string]: string;
};

type CustomerAppliance = {
  id: string;
  customerId: string;
  name: string;
  wattage: number;
  status: "on" | "off";
  turnedOnAt?: any;
  totalKwh?: number;
  updatedAt?: any;
};

type AssignedReport = {
  id: string;
  subject: string;
  description: string;
  customerName: string;
  assignedTechnicianId: string;
  assignedTechnicianName: string;
  fieldWorkStatus?: "in_progress" | "done" | "not_done";
  fieldStaffUpdate?: string;
  priority?: string;
  createdAt?: any;
};

type ActionModalState = {
  type: "confirm" | "result";
  title: string;
  message: string;
  actionLabel?: string;
  resultType?: "success" | "error";
  busy?: boolean;
  onConfirm?: () => Promise<string>;
};

const generateMeterNumber = () => {
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `MTR-${year}-${randomNumber}`;
};

export default function FieldStaffScreen() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignedReports, setAssignedReports] = useState<AssignedReport[]>([]);
  const [assignedReportsExpanded, setAssignedReportsExpanded] = useState(false);
  const [expandedAssignedReportIds, setExpandedAssignedReportIds] = useState<
    Set<string>
  >(() => new Set());
  const [reportWorkNotes, setReportWorkNotes] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [readingInputs, setReadingInputs] = useState<ReadingInputs>({});
  const [savingReadingId, setSavingReadingId] = useState<string | null>(
    null
  );
  const [customerAppliances, setCustomerAppliances] = useState<
    CustomerAppliance[]
  >([]);
  const [energyClock, setEnergyClock] = useState(Date.now());
  const [expandedApplicationIds, setExpandedApplicationIds] = useState<
    Set<string>
  >(() => new Set());
  const [actionModal, setActionModal] = useState<ActionModalState | null>(
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

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "appliances"),
      (snapshot) => {
        const applianceList: CustomerAppliance[] = snapshot.docs.map(
          (document) => {
            const data = document.data();
            return {
              id: document.id,
              customerId: data.customerId || "",
              name: data.name || "",
              wattage: Number(data.wattage || 0),
              status: data.status === "on" ? "on" : "off",
              turnedOnAt: data.turnedOnAt,
              totalKwh: Number(data.totalKwh || 0),
              updatedAt: data.updatedAt,
            };
          }
        );
        setCustomerAppliances(applianceList);
      },
      (error) => {
        console.log("Field Staff appliance loading error:", error);
        Alert.alert(
          "Unable to Load Appliance Usage",
          error.message || "Unable to load customer appliance usage."
        );
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    let unsubscribeReports: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeReports?.();
      unsubscribeReports = undefined;
      if (!user) {
        setAssignedReports([]);
        return;
      }

      const assignedReportsQuery = query(
        collection(db, "reports"),
        where("assignedTechnicianId", "==", user.uid)
      );
      unsubscribeReports = onSnapshot(
        assignedReportsQuery,
        (snapshot) => {
          const reports: AssignedReport[] = snapshot.docs.map((reportDoc) => {
            const data = reportDoc.data();
            return {
              id: reportDoc.id,
              subject: String(data.subject || ""),
              description: String(data.description || ""),
              customerName: String(data.customerName || "Customer"),
              assignedTechnicianId: String(data.assignedTechnicianId || ""),
              assignedTechnicianName: String(data.assignedTechnicianName || ""),
              fieldWorkStatus:
                data.fieldWorkStatus === "done" ||
                data.fieldWorkStatus === "not_done" ||
                data.fieldWorkStatus === "in_progress"
                  ? data.fieldWorkStatus
                  : undefined,
              fieldStaffUpdate: String(data.fieldStaffUpdate || ""),
              priority: String(data.priority || "medium"),
              createdAt: data.createdAt,
            };
          });
          reports.sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() || 0) -
              (a.createdAt?.toMillis?.() || 0)
          );
          setAssignedReports(reports);
        },
        (error) => {
          console.log("Assigned customer reports error:", error);
          Alert.alert(
            "Unable to Load Assigned Reports",
            error.message || "Assigned customer reports could not be loaded."
          );
        }
      );
    });
    return () => {
      unsubscribeReports?.();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setEnergyClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleApplicationExpanded = (applicationId: string) => {
    setExpandedApplicationIds((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  };

  const updateAssignedReport = async (
    report: AssignedReport,
    workStatus: NonNullable<AssignedReport["fieldWorkStatus"]>
  ) => {
    if (report.assignedTechnicianId !== auth.currentUser?.uid) {
      Alert.alert(
        "Report Not Assigned",
        "Only the assigned field staff member can update this report."
      );
      return;
    }
    const fieldStaffUpdate = (reportWorkNotes[report.id] || "").trim();
    const updateText = fieldStaffUpdate || report.fieldStaffUpdate || "";
    const now = new Date();
    try {
      await updateDoc(doc(db, "reports", report.id), {
        fieldWorkStatus: workStatus,
        fieldStaffUpdate: updateText,
        fieldStaffUpdatedAt: now,
        updatedAt: now,
      });
      setReportWorkNotes((current) => ({ ...current, [report.id]: "" }));
      Alert.alert(
        "Report Updated",
        `Work status saved as ${workStatus.replace("_", " ")}. Admin and customer report views will update.`
      );
    } catch (error) {
      console.log("Assigned report work update error:", error);
      Alert.alert(
        "Unable to Update Report",
        error instanceof Error
          ? error.message
          : "Your work update could not be saved."
      );
    }
  };

  const requestAction = (
    title: string,
    message: string,
    actionLabel: string,
    onConfirm: () => Promise<string>
  ) => {
    setActionModal({
      type: "confirm",
      title,
      message,
      actionLabel,
      onConfirm,
    });
  };

  const confirmAction = async () => {
    if (!actionModal?.onConfirm || actionModal.busy) {
      return;
    }

    const { onConfirm, title } = actionModal;
    setActionModal({ ...actionModal, busy: true });

    try {
      const message = await onConfirm();
      setActionModal({
        type: "result",
        title: `${title} Complete`,
        message,
        resultType: "success",
      });
    } catch (error) {
      console.log(`${title} error:`, error);
      setActionModal({
        type: "result",
        title: `${title} Failed`,
        message:
          error instanceof Error
            ? error.message
            : "The request could not be completed. Please try again.",
        resultType: "error",
      });
    }
  };

  const getCustomerApplianceUsage = (customerId: string) => {
    const application = applications.find(
      (item) => item.customerId === customerId
    );
    const billingCycleStartedAt =
      getTimestampMillis(application?.billingCycleStartedAt);

    return customerAppliances
      .filter((appliance) => appliance.customerId === customerId)
      .reduce(
        (usage, appliance) => {
          const applianceUpdatedAt = getTimestampMillis(appliance.updatedAt);
          const savedKwh =
            billingCycleStartedAt > 0 &&
            applianceUpdatedAt < billingCycleStartedAt
              ? 0
              : Number(appliance.totalKwh || 0);
          if (appliance.status !== "on" || !appliance.turnedOnAt) {
            return {
              kwh: usage.kwh + savedKwh,
              count: usage.count + 1,
              onCount: usage.onCount,
            };
          }

          let turnedOnAt = 0;
          try {
            if (typeof appliance.turnedOnAt.toMillis === "function") {
              turnedOnAt = appliance.turnedOnAt.toMillis();
            } else if (appliance.turnedOnAt instanceof Date) {
              turnedOnAt = appliance.turnedOnAt.getTime();
            } else if (typeof appliance.turnedOnAt === "number") {
              turnedOnAt = appliance.turnedOnAt;
            }
          } catch (error) {
            console.log("Unable to read appliance start time:", error);
          }

          if (billingCycleStartedAt > 0) {
            turnedOnAt = Math.max(turnedOnAt, billingCycleStartedAt);
          }

          const liveKwh =
            savedKwh +
            (turnedOnAt
              ? (appliance.wattage / 1000) *
                (Math.max(energyClock - turnedOnAt, 0) /
                  (1000 * 60 * 60))
              : 0);

          return {
            kwh: usage.kwh + liveKwh,
            count: usage.count + 1,
            onCount: usage.onCount + 1,
          };
        },
        { kwh: 0, count: 0, onCount: 0 }
      );
  };

  const getTimestampMillis = (timestamp: any) => {
    if (typeof timestamp?.toMillis === "function") {
      return timestamp.toMillis();
    }
    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }
    return typeof timestamp === "number" ? timestamp : 0;
  };

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
    requestAction(
      "Pass Inspection",
      `Mark ${application.fullName}'s inspection as passed?`,
      "Pass Inspection",
      async () => {
      await updateDoc(doc(db, "applications", application.id), {
        status: "inspection_passed",
        inspectionResult: "passed",
        inspectionNotes:
          "Site inspection passed by Kur-yente CO field staff.",
        inspectedAt: new Date(),
        updatedAt: new Date(),
      });

      return `${application.fullName}'s site inspection has been marked as passed.`;
      }
    );
  };

  const handleReinspect = async (
    application: Application
  ) => {
    requestAction(
      "Request Re-Inspection",
      `Return ${application.fullName}'s application for another inspection?`,
      "Re-Inspect",
      async () => {
      const inspectedAt = new Date();
      await updateDoc(doc(db, "applications", application.id), {
        status: "reinspect",
        inspectionResult: "reinspect",
        inspectionNotes:
          "Site requires corrections and another inspection before installation.",
        inspectedAt,
        updatedAt: inspectedAt,
      });

      return `${application.fullName}'s application has been returned for re-inspection.`;
      }
    );
  };

  const handleRejectInspection = async (
    application: Application
  ) => {
    requestAction(
      "Reject Inspection",
      `Reject ${application.fullName}'s site inspection?`,
      "Reject",
      async () => {
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

      return `${application.fullName}'s site inspection has been rejected.`;
      }
    );
  };

  const handleInstallMeter = async (
    application: Application
  ) => {
    requestAction(
      "Install Meter",
      `Record meter installation for ${application.fullName}? An administrator will activate the service separately.`,
      "Install Meter",
      async () => {
      const meterNumber = generateMeterNumber();
      const installedAt = new Date();

      await updateDoc(doc(db, "applications", application.id), {
        status: "meter_installed",
        meterNumber,
        meterStatus: "installed",
        installedAt,

        previousReading: 0,
        currentReading: 0,
        consumption: 0,
        readingRate: ELECTRICITY_RATE,
        estimatedBill: 0,
        readingUpdatedAt: installedAt,

        updatedAt: installedAt,
      });

      return `Meter ${meterNumber} has been installed. The application is awaiting administrator activation.`;
      }
    );
  };

  const handleSaveReading = async (
    application: Application
  ) => {
    const inputValue = readingInputs[application.id]?.trim();

    if (!inputValue) {
      setActionModal({
        type: "result",
        title: "Reading Required",
        message: "Please enter the new meter reading.",
        resultType: "error",
      });
      return;
    }

    const newReading = Number(inputValue);

    if (!Number.isFinite(newReading)) {
      setActionModal({
        type: "result",
        title: "Invalid Reading",
        message: "Please enter a valid numeric meter reading.",
        resultType: "error",
      });
      return;
    }

    if (newReading < 0) {
      setActionModal({
        type: "result",
        title: "Invalid Reading",
        message: "Meter reading cannot be negative.",
        resultType: "error",
      });
      return;
    }

    const previousReading =
      application.currentReading && application.currentReading > 0
        ? application.currentReading
        : application.previousReading ?? 0;

    if (newReading < previousReading) {
      setActionModal({
        type: "result",
        title: "Invalid Reading",
        message: `The new reading (${newReading} kWh) cannot be lower than the previous reading (${previousReading} kWh).`,
        resultType: "error",
      });
      return;
    }

    const consumption = newReading - previousReading;
    const estimatedBill = consumption * ELECTRICITY_RATE;

    requestAction(
      "Save Meter Reading",
      `Save ${newReading.toFixed(2)} kWh as ${application.fullName}'s latest meter reading?`,
      "Save Reading",
      async () => {
      setSavingReadingId(application.id);
      try {
      const readingSavedAt = new Date();
      const batch = writeBatch(db);
      batch.update(doc(db, "applications", application.id), {
        previousReading: newReading,
        currentReading: 0,
        consumption: 0,
        readingRate: ELECTRICITY_RATE,
        estimatedBill: 0,
        lastMeterReading: newReading,
        lastReadingConsumption: consumption,
        lastEstimatedBill: estimatedBill,
        billingCycleStartedAt: readingSavedAt,
        readingUpdatedAt: readingSavedAt,
        updatedAt: readingSavedAt,
      });

      const readingRef = doc(collection(db, "meterReadings"));
      batch.set(readingRef, {
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
        readingDate: readingSavedAt,
        createdAt: readingSavedAt,
      });

      console.log("Saving simulated meter reading:", {
        applicationId: application.id,
        meterNumber: application.meterNumber,
        previousReading,
        currentReading: newReading,
        consumption,
        rate: ELECTRICITY_RATE,
        estimatedBill,
      });

      await batch.commit();

      setReadingInputs((current) => ({
        ...current,
        [application.id]: "",
      }));

      return `Meter reading saved successfully.\n\nPrevious: ${previousReading.toFixed(
          2
        )} kWh\nCurrent: ${newReading.toFixed(
          2
        )} kWh\nEstimated Bill: ${formatCurrency(estimatedBill)}`;
      } finally {
        setSavingReadingId(null);
      }
      }
    );
  };

  const handleLogout = () => {
    requestAction(
      "Log Out",
      "Are you sure you want to log out?",
      "Log Out",
      async () => {
        await auth.signOut();
        router.replace("/");
        return "You have been logged out.";
      }
    );
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
              Kur-yente CO FIELD STAFF PORTAL
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

        {/* ASSIGNED CUSTOMER REPORTS */}
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setAssignedReportsExpanded((expanded) => !expanded)}
          accessibilityRole="button"
          accessibilityState={{ expanded: assignedReportsExpanded }}
        >
          <Text style={styles.sectionTitle}>Assigned Customer Reports</Text>
          <View style={styles.reportSectionHeaderRight}>
            <Text style={styles.sectionCount}>
              {assignedReports.length} report
              {assignedReports.length !== 1 ? "s" : ""}
            </Text>
            <Text style={styles.reportSectionChevron}>
              {assignedReportsExpanded ? "−" : "+"}
            </Text>
          </View>
        </TouchableOpacity>
        {assignedReportsExpanded && assignedReports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Assigned Reports</Text>
            <Text style={styles.emptyText}>
              Reports assigned to you by an administrator will appear here.
            </Text>
          </View>
        ) : null}
        {assignedReportsExpanded && assignedReports.length > 0 ? (
          assignedReports.map((report) => (
            <View key={report.id} style={styles.reportWorkCard}>
              <TouchableOpacity
                style={styles.reportWorkHeader}
                onPress={() =>
                  setExpandedAssignedReportIds((current) => {
                    const next = new Set(current);
                    if (next.has(report.id)) next.delete(report.id);
                    else next.add(report.id);
                    return next;
                  })
                }
                accessibilityRole="button"
                accessibilityState={{
                  expanded: expandedAssignedReportIds.has(report.id),
                }}
              >
                <Text style={styles.reportWorkSubject}>{report.subject}</Text>
                <View style={styles.reportWorkHeaderMeta}>
                  <Text style={styles.reportWorkPriority}>
                    {report.priority?.toUpperCase()}
                  </Text>
                  <Text style={styles.reportSectionChevron}>
                    {expandedAssignedReportIds.has(report.id) ? "−" : "+"}
                  </Text>
                </View>
              </TouchableOpacity>
              {expandedAssignedReportIds.has(report.id) ? (
                <View>
              <Text style={styles.reportWorkCustomer}>{report.customerName}</Text>
              <Text style={styles.reportWorkDescription}>
                {report.description}
              </Text>
              <Text style={styles.reportWorkStatus}>
                Work status:{" "}
                {report.fieldWorkStatus
                  ? report.fieldWorkStatus.replace("_", " ").toUpperCase()
                  : "NOT UPDATED"}
              </Text>
              {report.fieldStaffUpdate ? (
                <Text style={styles.reportWorkUpdate}>
                  Latest update: {report.fieldStaffUpdate}
                </Text>
              ) : null}
              <TextInput
                style={styles.reportWorkInput}
                value={reportWorkNotes[report.id] || ""}
                onChangeText={(value) =>
                  setReportWorkNotes((current) => ({
                    ...current,
                    [report.id]: value,
                  }))
                }
                placeholder="Work performed or reason the work is not done (optional)"
                placeholderTextColor="#829087"
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
              <View style={styles.reportWorkActions}>
                <TouchableOpacity
                  style={[styles.reportWorkButton, styles.reportInProgressButton]}
                  onPress={() =>
                    void updateAssignedReport(report, "in_progress")
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.reportWorkButtonText}>
                    Work in Progress
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportWorkButton, styles.reportDoneButton]}
                  onPress={() => void updateAssignedReport(report, "done")}
                  accessibilityRole="button"
                >
                  <Text style={styles.reportWorkButtonText}>Work Done</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportWorkButton, styles.reportNotDoneButton]}
                  onPress={() => void updateAssignedReport(report, "not_done")}
                  accessibilityRole="button"
                >
                  <Text style={styles.reportWorkButtonText}>Work Not Done</Text>
                </TouchableOpacity>
              </View>
                </View>
              ) : null}
            </View>
          ))
        ) : null}

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
            <TouchableOpacity
              style={styles.applicationIdDropdown}
              onPress={() => toggleApplicationExpanded(application.id)}
              accessibilityRole="button"
              accessibilityLabel={`Application ${application.id}, ${
                expandedApplicationIds.has(application.id)
                  ? "collapse"
                  : "expand"
              } details`}
            >
              <Text style={styles.applicationIdText}>
                APPLICATION ID: {application.id}
              </Text>
              <Text style={styles.dropdownIndicator}>
                {expandedApplicationIds.has(application.id) ? "−" : "+"}
              </Text>
            </TouchableOpacity>
            {expandedApplicationIds.has(application.id) && (
              <>
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
                </>
              )}
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
              <TouchableOpacity
                style={styles.applicationIdDropdown}
                onPress={() => toggleApplicationExpanded(application.id)}
                accessibilityRole="button"
                accessibilityLabel={`Application ${application.id}, ${
                  expandedApplicationIds.has(application.id)
                    ? "collapse"
                    : "expand"
                } details`}
              >
                <Text style={styles.applicationIdText}>
                  APPLICATION ID: {application.id}
                </Text>
                <Text style={styles.dropdownIndicator}>
                  {expandedApplicationIds.has(application.id) ? "−" : "+"}
                </Text>
              </TouchableOpacity>
              {expandedApplicationIds.has(application.id) && (
                <>
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
                    "Site inspection passed by Kur-yente CO field staff."}
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
                  INSTALL METER
                </Text>
              </TouchableOpacity>
                </>
              )}
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
            const currentReading =
              application.currentReading ?? 0;

            const estimatedBill =
              application.estimatedBill ?? 0;

            const lastMeterReading =
              application.lastMeterReading ??
              (application.currentReading && application.currentReading > 0
                ? application.currentReading
                : application.previousReading ?? 0);

            const lastEstimatedBill =
              application.lastEstimatedBill ??
              application.estimatedBill ??
              0;

            const isSaving =
              savingReadingId === application.id;
            const applianceUsage = getCustomerApplianceUsage(
              application.customerId
            );

            return (
              <View
                key={application.id}
                style={styles.activeMeterCard}
              >
                <TouchableOpacity
                  style={styles.applicationIdDropdown}
                  onPress={() => toggleApplicationExpanded(application.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Application ${application.id}, ${
                    expandedApplicationIds.has(application.id)
                      ? "collapse"
                      : "expand"
                  } details`}
                >
                  <Text style={styles.applicationIdText}>
                    APPLICATION ID: {application.id}
                  </Text>
                  <Text style={styles.dropdownIndicator}>
                    {expandedApplicationIds.has(application.id) ? "−" : "+"}
                  </Text>
                </TouchableOpacity>
                {expandedApplicationIds.has(application.id) && (
                  <>
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

                <View style={styles.applianceUsageBox}>
                  <Text style={styles.applianceUsageTitle}>
                    CUSTOMER APPLIANCE USAGE
                  </Text>
                  <Text style={styles.applianceUsageValue}>
                    {applianceUsage.kwh.toFixed(3)} kWh
                  </Text>
                  <Text style={styles.applianceUsageDetail}>
                    {applianceUsage.count} appliance
                    {applianceUsage.count !== 1 ? "s" : ""} ·{" "}
                    {applianceUsage.onCount} currently on
                  </Text>
                  <Text style={styles.applianceUsageDetail}>
                    Updates live from the customer appliance simulator.
                  </Text>
                </View>

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
                    Your Meter Reading:{" "}
                    {formatKwh(lastMeterReading)}
                  </Text>
                </View>

                <View style={styles.readingSummary}>
                  <View style={styles.readingSummaryItem}>
                    <Text style={styles.readingSummaryLabel}>
                      Estimated Bill This Cycle
                    </Text>

                    <Text style={styles.readingBillValue}>
                      {formatCurrency(estimatedBill)}
                    </Text>
                  </View>
                  <View style={styles.readingSummaryItem}>
                    <Text style={styles.readingSummaryLabel}>
                      Previous Bill
                    </Text>
                    <Text style={styles.readingBillValue}>
                      {formatCurrency(lastEstimatedBill)}
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
                        Enter the latest meter reading to calculate the
                        estimated bill.
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
                      Meter reading difference × ₱
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
                  </>
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
          Kur-yente CO Electricity Management System
        </Text>
      </ScrollView>
      <Modal
        visible={actionModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!actionModal?.busy) {
            setActionModal(null);
          }
        }}
      >
        <View style={styles.actionModalOverlay}>
          <View style={styles.actionModalCard}>
            <Text style={styles.actionModalTitle}>
              {actionModal?.title}
            </Text>
            <Text style={styles.actionModalMessage}>
              {actionModal?.message}
            </Text>
            <View style={styles.actionModalButtons}>
              {actionModal?.type === "confirm" && (
                <TouchableOpacity
                  style={styles.actionCancelButton}
                  onPress={() => setActionModal(null)}
                  disabled={actionModal.busy}
                >
                  <Text style={styles.actionCancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.actionPrimaryButton,
                  actionModal?.type === "result" &&
                    actionModal.resultType === "error" &&
                    styles.actionErrorButton,
                ]}
                onPress={() => {
                  if (actionModal?.type === "confirm") {
                    void confirmAction();
                  } else {
                    setActionModal(null);
                  }
                }}
                disabled={actionModal?.busy}
              >
                {actionModal?.busy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.actionPrimaryText}>
                    {actionModal?.type === "confirm"
                      ? actionModal.actionLabel
                      : "Close"}
                  </Text>
                )}
              </TouchableOpacity>
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

  reportSectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  reportSectionChevron: {
    color: "#176b3a",
    fontSize: 18,
    fontWeight: "900",
    minWidth: 18,
    textAlign: "center",
  },

  reportWorkCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#cfe3d4",
  },

  reportWorkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },

  reportWorkHeaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  reportWorkSubject: {
    flex: 1,
    color: "#153d27",
    fontSize: 15,
    fontWeight: "900",
  },

  reportWorkPriority: {
    color: "#8a5b08",
    backgroundColor: "#fff2cf",
    borderRadius: 10,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
  },

  reportWorkCustomer: {
    color: "#176b3a",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 7,
  },

  reportWorkDescription: {
    color: "#526258",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },

  reportWorkStatus: {
    color: "#176b3a",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 10,
  },

  reportWorkUpdate: {
    color: "#526258",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  reportWorkInput: {
    minHeight: 74,
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 10,
    padding: 10,
    color: "#1d3425",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },

  reportWorkActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 9,
  },

  reportWorkButton: {
    minHeight: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  reportInProgressButton: {
    backgroundColor: "#1557a0",
  },

  reportDoneButton: {
    backgroundColor: "#176b3a",
  },

  reportNotDoneButton: {
    backgroundColor: "#a45b08",
  },

  reportWorkButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
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

  applicationIdDropdown: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 9,
    backgroundColor: "#f1f8f3",
    paddingHorizontal: 11,
    marginBottom: 12,
  },

  applicationIdText: {
    flex: 1,
    color: "#176b3a",
    fontSize: 11,
    fontWeight: "800",
  },

  dropdownIndicator: {
    color: "#176b3a",
    fontSize: 22,
    fontWeight: "700",
  },

  applianceUsageBox: {
    backgroundColor: "#f1f8f3",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },

  applianceUsageTitle: {
    color: "#176b3a",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  applianceUsageValue: {
    color: "#123d25",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },

  applianceUsageDetail: {
    color: "#708078",
    fontSize: 11,
    marginTop: 4,
  },

  actionModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  actionModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: 24,
    backgroundColor: "#ffffff",
  },

  actionModalTitle: {
    color: "#176b3a",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },

  actionModalMessage: {
    color: "#34443a",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  actionModalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  actionCancelButton: {
    minHeight: 46,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 10,
  },

  actionCancelText: {
    color: "#34443a",
    fontSize: 14,
    fontWeight: "700",
  },

  actionPrimaryButton: {
    minHeight: 46,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#176b3a",
  },

  actionErrorButton: {
    backgroundColor: "#b3261e",
  },

  actionPrimaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
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