import { router } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
    addDoc,
    collection,
    onSnapshot,
    query,
    serverTimestamp,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { auth, db } from "../../config/firebase";

type Application = {
  id: string;
  customerId: string;
  customerEmail?: string;
  fullName?: string;
  contactNumber?: string;
  serviceAddress?: string;
  connectionType?: string;
  status?: string;
  rejectionReason?: string;
  inspectionNotes?: string;
  meterNumber?: string;
  meterId?: string;
  installedAt?: any;
  submittedAt?: any;
  updatedAt?: any;
  inspectedAt?: any;
  reviewedAt?: any;
  approvedAt?: any;
  activatedAt?: any;
  previousReading?: number;
  currentReading?: number;
  estimatedBill?: number;
  lastMeterReading?: number;
  lastEstimatedBill?: number;
  billingCycleStartedAt?: any;
};

type Appliance = {
  id: string;
  customerId: string;
  name: string;
  category: string;
  wattage: number;
  status: "on" | "off";
  turnedOnAt?: any;
  totalKwh?: number;
  createdAt?: any;
  updatedAt?: any;
};

type MeterReading = {
  id: string;
  applicationId: string;
  currentReading: number;
  consumption: number;
  estimatedBill: number;
  readingDate?: any;
};

type CustomerReport = {
  id: string;
  subject: string;
  description: string;
  status:
    | "pending"
    | "under_review"
    | "assigned"
    | "in_progress"
    | "resolved"
    | "closed"
    | "rejected";
  assignedTechnicianName?: string;
  fieldWorkStatus?: "in_progress" | "done" | "not_done";
  fieldStaffUpdate?: string;
  fieldStaffUpdatedAt?: any;
  customerUpdate?: string;
  resolution?: string;
  createdAt?: any;
  resolvedAt?: any;
};

export default function CustomerScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [application, setApplication] =
    useState<Application | null>(null);

  const [appliances, setAppliances] =
    useState<Appliance[]>([]);
  const [meterReadings, setMeterReadings] =
    useState<MeterReading[]>([]);
  const [customerReports, setCustomerReports] =
    useState<CustomerReport[]>([]);
  const [customerReportsExpanded, setCustomerReportsExpanded] =
    useState(false);
  const [expandedCustomerReportIds, setExpandedCustomerReportIds] = useState<
    Set<string>
  >(() => new Set());

  const [loading, setLoading] = useState(true);
  const [logoutModalVisible, setLogoutModalVisible] =
    useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportSubject, setReportSubject] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportContactEmail, setReportContactEmail] = useState("");
  const [reportContactPhone, setReportContactPhone] = useState("");
  const [reportOtherContacts, setReportOtherContacts] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(
    new Date()
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          setCurrentUserId(user.uid);
        } else {
          setCurrentUserId(null);
          setApplication(null);
          setAppliances([]);
          setMeterReadings([]);
          setCustomerReports([]);
          setLoading(false);
        }
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    setLoading(true);

    const applicationsQuery = query(
      collection(db, "applications"),
      where(
        "customerId",
        "==",
        currentUserId
      )
    );

    const unsubscribe = onSnapshot(
      applicationsQuery,
      (snapshot) => {
        const applications: Application[] =
          snapshot.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Omit<
              Application,
              "id"
            >),
          }));

        applications.sort((a, b) => {
          const aTime =
            a.submittedAt?.toMillis?.() || 0;

          const bTime =
            b.submittedAt?.toMillis?.() || 0;

          return bTime - aTime;
        });

        setApplication(
          applications.length > 0
            ? applications[0]
            : null
        );

        setLoading(false);
      },
      (error) => {
        console.log(
          "Customer application error:",
          error
        );

        setApplication(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const reportsQuery = query(
      collection(db, "reports"),
      where("customerId", "==", currentUserId)
    );
    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const reports: CustomerReport[] = snapshot.docs.map((document) => {
          const data = document.data();
          return {
            id: document.id,
            subject: String(data.subject || ""),
            description: String(data.description || ""),
            status: [
              "pending",
              "under_review",
              "assigned",
              "in_progress",
              "resolved",
              "closed",
              "rejected",
            ].includes(data.status)
              ? data.status
              : "pending",
            assignedTechnicianName: String(data.assignedTechnicianName || ""),
            fieldWorkStatus:
              data.fieldWorkStatus === "in_progress" ||
              data.fieldWorkStatus === "done" ||
              data.fieldWorkStatus === "not_done"
                ? data.fieldWorkStatus
                : undefined,
            fieldStaffUpdate: String(data.fieldStaffUpdate || ""),
            fieldStaffUpdatedAt: data.fieldStaffUpdatedAt,
            customerUpdate: String(data.customerUpdate || ""),
            resolution: String(data.resolution || ""),
            createdAt: data.createdAt,
            resolvedAt: data.resolvedAt,
          };
        });
        reports.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setCustomerReports(reports);
      },
      (error) => {
        console.log("Customer report history error:", error);
        Alert.alert(
          "Unable to Load Your Reports",
          error.message || "Something went wrong while loading your reports."
        );
      }
    );
    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const readingsQuery = query(
      collection(db, "meterReadings"),
      where("customerId", "==", currentUserId)
    );

    const unsubscribe = onSnapshot(
      readingsQuery,
      (snapshot) => {
        const readings: MeterReading[] = snapshot.docs.map(
          (document) => {
            const data = document.data();
            return {
              id: document.id,
              applicationId: String(data.applicationId || ""),
              currentReading: Number(data.currentReading || 0),
              consumption: Number(data.consumption || 0),
              estimatedBill: Number(data.estimatedBill || 0),
              readingDate: data.readingDate || data.createdAt,
            };
          }
        );
        readings.sort((a, b) => {
          const aTime = a.readingDate?.toMillis?.() || 0;
          const bTime = b.readingDate?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setMeterReadings(readings);
      },
      (error) => {
        console.log("Customer meter reading history error:", error);
        Alert.alert(
          "Unable to Load Meter Reading History",
          error.message || "Something went wrong while loading meter readings."
        );
      }
    );

    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const appliancesQuery = query(
      collection(db, "appliances"),
      where(
        "customerId",
        "==",
        currentUserId
      )
    );

    const unsubscribe = onSnapshot(
      appliancesQuery,
      (snapshot) => {
        const applianceList: Appliance[] =
          snapshot.docs.map((document) => {
            const data = document.data();

            return {
              id: document.id,
              customerId:
                data.customerId || "",
              name: data.name || "Appliance",
              category:
                data.category || "Other",
              wattage:
                Number(data.wattage) || 0,
              status:
                data.status === "on"
                  ? "on"
                  : "off",
              turnedOnAt:
                data.turnedOnAt,
              totalKwh:
                Number(data.totalKwh) || 0,
              createdAt:
                data.createdAt,
              updatedAt:
                data.updatedAt,
            };
          });

        applianceList.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        setAppliances(applianceList);
      },
      (error) => {
        console.log(
          "Customer appliances error:",
          error
        );

        setAppliances([]);
      }
    );

    return unsubscribe;
  }, [currentUserId]);

  const normalizedStatus =
    application?.status
      ?.toLowerCase()
      .trim() || "";

  const isMeterActive =
    normalizedStatus === "active" &&
    !!application?.meterNumber;

  const getTimestampMillis = (timestamp: any) => {
    if (typeof timestamp?.toMillis === "function") {
      return timestamp.toMillis();
    }
    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }
    return typeof timestamp === "number" ? timestamp : 0;
  };

  const getLiveKwh = (
    appliance: Appliance
  ) => {
    const billingCycleStartedAt = getTimestampMillis(
      application?.billingCycleStartedAt
    );
    const applianceUpdatedAt = getTimestampMillis(
      appliance.updatedAt
    );
    const savedKwh =
      billingCycleStartedAt > 0 &&
      applianceUpdatedAt < billingCycleStartedAt
        ? 0
        :
      Number(appliance.totalKwh) || 0;

    if (
      appliance.status !== "on" ||
      !appliance.turnedOnAt
    ) {
      return savedKwh;
    }

    let turnedOnTime = 0;

    if (
      typeof appliance.turnedOnAt?.toMillis ===
      "function"
    ) {
      turnedOnTime =
        appliance.turnedOnAt.toMillis();
    } else if (
      appliance.turnedOnAt instanceof Date
    ) {
      turnedOnTime =
        appliance.turnedOnAt.getTime();
    } else if (
      typeof appliance.turnedOnAt ===
      "number"
    ) {
      turnedOnTime = appliance.turnedOnAt;
    }

    if (!turnedOnTime) {
      return savedKwh;
    }

    if (billingCycleStartedAt > 0) {
      turnedOnTime = Math.max(turnedOnTime, billingCycleStartedAt);
    }

    const elapsedMilliseconds =
      currentTime.getTime() -
      turnedOnTime;

    if (elapsedMilliseconds <= 0) {
      return savedKwh;
    }

    const elapsedHours =
      elapsedMilliseconds /
      (1000 * 60 * 60);

    const liveKwh =
      (appliance.wattage / 1000) *
      elapsedHours;

    return savedKwh + liveKwh;
  };

  const currentLoad = appliances.reduce(
    (total, appliance) => {
      if (appliance.status === "on") {
        return (
          total +
          (Number(appliance.wattage) || 0)
        );
      }

      return total;
    },
    0
  );

  const applianceCount =
    appliances.length;

  const activeApplianceCount =
    appliances.filter(
      (appliance) =>
        appliance.status === "on"
    ).length;

  const applianceEnergy = appliances.reduce(
    (total, appliance) => {
      return total + getLiveKwh(appliance);
    },
    0
  );

  const baseMeterReading =
    Number(
      application?.meterNumber
        ? 0
        : 0
    );

  const baseConsumption = 0;

  const liveMeterReading =
    baseMeterReading +
    applianceEnergy;

  const liveConsumption =
    baseConsumption +
    applianceEnergy;

  const electricityRate = 12;

  const liveEstimatedBill =
    liveConsumption *
    electricityRate;

  const formatNumber = (
    value: number,
    decimals = 2
  ) => {
    return value.toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }
    );
  };

  const formatCurrency = (
    value: number
  ) => {
    return `₱${value.toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  const formatDate = (
    timestamp: any
  ) => {
    if (!timestamp) {
      return "N/A";
    }

    try {
      const date =
        typeof timestamp.toDate ===
        "function"
          ? timestamp.toDate()
          : timestamp instanceof Date
          ? timestamp
          : new Date(timestamp);

      return date.toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        }
      );
    } catch {
      return "N/A";
    }
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) {
      return "Date not recorded";
    }

    try {
      const date =
        typeof timestamp.toDate === "function"
          ? timestamp.toDate()
          : timestamp instanceof Date
          ? timestamp
          : new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return "Date not recorded";
      }

      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "Date not recorded";
    }
  };

  const formatTime = (
    date: Date
  ) => {
    return date.toLocaleTimeString(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  };

  const getStatusLabel = () => {
    if (!application) {
      return "No Application";
    }

    if (normalizedStatus === "pending") {
      return "Pending";
    }

    if (
      normalizedStatus ===
      "for inspection"
    ) {
      return "For Inspection";
    }

    if (
      normalizedStatus ===
      "inspected"
    ) {
      return "Inspected";
    }

    if (normalizedStatus === "inspection_passed") {
      return "Inspection Passed";
    }

    if (normalizedStatus === "inspection_rejected") {
      return "Inspection Rejected";
    }

    if (normalizedStatus === "reinspect") {
      return "Re-Inspection Required";
    }

    if (normalizedStatus === "approved") {
      return "Approved";
    }

    if (normalizedStatus === "active") {
      return "Active";
    }

    if (normalizedStatus === "meter_installed") {
      return "Awaiting Service Activation";
    }

    if (normalizedStatus === "rejected") {
      return "Rejected";
    }

    return (
      application.status ||
      "Unknown"
    );
  };

  const getStatusDescription = () => {
    if (!application) {
      return "You have not submitted a connection application yet.";
    }

    if (normalizedStatus === "pending") {
      return "Your application is waiting for review.";
    }

    if (
      normalizedStatus ===
      "for inspection"
    ) {
      return "Your application is ready for field inspection.";
    }

    if (
      normalizedStatus ===
      "inspected"
    ) {
      return "Your site inspection has been completed.";
    }

    if (normalizedStatus === "inspection_passed") {
      return "Your site inspection passed. Your meter is awaiting installation.";
    }

    if (normalizedStatus === "inspection_rejected") {
      return "Your site inspection did not pass. Please review the inspection notes.";
    }

    if (normalizedStatus === "reinspect") {
      return "Your site requires corrections and another inspection.";
    }

    if (normalizedStatus === "approved") {
      return "Your application has been approved.";
    }

    if (normalizedStatus === "active") {
      return "Your electricity connection is active.";
    }

    if (normalizedStatus === "meter_installed") {
      return "Your meter has been installed and is awaiting administrator service activation.";
    }

    if (normalizedStatus === "rejected") {
      return "Your application was rejected.";
    }

    return "Your application is being processed.";
  };

  const applicationApproved = [
    "approved",
    "inspection",
    "reinspect",
    "inspection_passed",
    "inspection_rejected",
    "meter_installed",
    "active",
  ].includes(normalizedStatus);
  const inspectionCompleted = [
    "inspection_passed",
    "inspection_rejected",
    "meter_installed",
    "active",
  ].includes(normalizedStatus);
  const inspectionPassed = [
    "inspection_passed",
    "meter_installed",
    "active",
  ].includes(normalizedStatus);
  const applicationTimeline = application
    ? [
        {
          title: "Application submitted",
          status: "Submitted",
          timestamp: application.submittedAt,
          complete: true,
          rejected: false,
        },
        {
          title: "Application review",
          status:
            normalizedStatus === "rejected"
              ? "Rejected"
              : applicationApproved
              ? "Approved"
              : "Awaiting decision",
          timestamp:
            application.reviewedAt ||
            application.approvedAt,
          complete: applicationApproved,
          rejected: normalizedStatus === "rejected",
        },
        {
          title: "Site inspection",
          status:
            normalizedStatus === "rejected"
              ? "Not started"
              : inspectionCompleted
              ? "Completed"
              : applicationApproved
              ? "Ready for inspection"
              : "Waiting for application review",
          timestamp: inspectionCompleted
            ? application.inspectedAt
            : application.approvedAt,
          complete: inspectionCompleted,
          rejected: false,
        },
        {
          title: "Inspection decision",
          status:
            normalizedStatus === "inspection_rejected"
              ? "Rejected"
              : normalizedStatus === "rejected"
              ? "Not started"
              : normalizedStatus === "reinspect"
              ? "Re-inspection required"
              : inspectionPassed
              ? "Approved"
              : "Awaiting inspection",
          timestamp: application.inspectedAt,
          complete: inspectionCompleted,
          rejected:
            normalizedStatus === "inspection_rejected",
        },
        {
          title: "Meter installation",
          status:
            ["meter_installed", "active"].includes(normalizedStatus)
              ? "Meter installed"
              : inspectionPassed
              ? "Ready for installation"
              : "Not started",
          timestamp: application.installedAt,
          complete: ["meter_installed", "active"].includes(
            normalizedStatus
          ),
          rejected: false,
        },
        {
          title: "Service activation",
          status:
            normalizedStatus === "active"
              ? "Active"
              : normalizedStatus === "meter_installed"
              ? "Awaiting administrator activation"
              : "Not active",
          timestamp: application.activatedAt,
          complete: normalizedStatus === "active",
          rejected: false,
        },
      ]
    : [];

  const showApplication =
    !!application;

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await signOut(auth);
      setLogoutModalVisible(false);
      router.replace("/");
    } catch (error) {
      console.log("Logout error:", error);
      setLoggingOut(false);
      Alert.alert(
        "Logout Error",
        "Unable to log out right now. Please try again."
      );
    }
  };

  const handleSubmitReport = async () => {
    const subject = reportSubject.trim();
    const description = reportDescription.trim();
    const contactEmail =
      reportContactEmail.trim() || auth.currentUser?.email || "";
    const contactPhone =
      reportContactPhone.trim() || application?.contactNumber || "";
    const otherContacts = reportOtherContacts.trim();
    const user = auth.currentUser;

    if (!user) {
      setReportError("Your session has expired. Please log in again.");
      return;
    }
    if (!subject || !description) {
      setReportError("Enter both a subject and a description.");
      return;
    }
    if (!contactEmail || !contactPhone) {
      setReportError("Enter a contact email and phone number.");
      return;
    }

    try {
      setReportError(null);
      setSubmittingReport(true);
      await addDoc(collection(db, "reports"), {
        customerId: user.uid,
        customerName: application?.fullName || user.displayName || "Customer",
        customerEmail: contactEmail,
        contactPhone,
        otherContacts,
        subject,
        description,
        status: "not_resolved",
        resolution: "",
        createdAt: serverTimestamp(),
      });
      setReportSubject("");
      setReportDescription("");
      setReportContactEmail("");
      setReportContactPhone("");
      setReportOtherContacts("");
      setReportModalVisible(false);
      Alert.alert("Report Submitted", "Your report has been sent to the administrator.");
    } catch (error) {
      console.log("Customer report submission error:", error);
      const firebaseError = error as {
        code?: string;
        message?: string;
      };
      const errorCode = firebaseError.code || "unknown";
      const errorMessage =
        firebaseError.message || "Unable to submit your report. Please try again.";
      setReportError(
        errorCode === "permission-denied"
          ? `Firestore rejected the write to the "reports" collection (permission-denied): ${errorMessage} Check that the published rules allow this write in the Firebase project configured for the app.`
          : `Report could not be sent (${errorCode}): ${errorMessage}`
      );
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#176b3a"
        />

        <Text
          style={styles.loadingText}
        >
          Loading customer dashboard...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text
              style={styles.headerSmall}
            >
              Kur-yente CO
            </Text>

            <Text
              style={styles.headerTitle}
            >
              Customer Dashboard
            </Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => setLogoutModalVisible(true)}
          >
            <Text
              style={styles.logoutText}
            >
              Logout
            </Text>
          </TouchableOpacity>
        </View>

        {/* WELCOME CARD */}
        <View style={styles.welcomeCard}>
          <View
            style={styles.welcomeBadge}
          >
            <Text
              style={styles.welcomeBadgeText}
            >
              CUSTOMER PORTAL
            </Text>
          </View>

          <Text
            style={styles.welcomeTitle}
          >
            Welcome
            {application?.fullName
              ? `, ${application.fullName}`
              : ""}
          </Text>

          <Text
            style={styles.welcomeText}
          >
            Monitor your electricity
            connection, appliance usage,
            meter information, and
            estimated electricity bill.
          </Text>

          <Text
            style={styles.clockText}
          >
            {formatTime(currentTime)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => {
            setReportContactEmail(auth.currentUser?.email || "");
            setReportContactPhone(application?.contactNumber || "");
            setReportModalVisible(true);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.reportButtonTitle}>Report an Issue</Text>
          <Text style={styles.reportButtonSubtitle}>
            Send a report to the administrator
          </Text>
        </TouchableOpacity>

        <View style={styles.customerReportsSection}>
          <TouchableOpacity
            style={styles.customerReportsHeader}
            onPress={() =>
              setCustomerReportsExpanded((expanded) => !expanded)
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: customerReportsExpanded }}
          >
            <Text style={styles.customerReportsTitle}>Your Reports</Text>
            <View style={styles.customerReportsHeaderRight}>
              <Text style={styles.customerReportsCount}>
                {customerReports.length}
              </Text>
              <Text style={styles.customerReportsChevron}>
                {customerReportsExpanded ? "−" : "+"}
              </Text>
            </View>
          </TouchableOpacity>
          {customerReportsExpanded && customerReports.length === 0 ? (
            <Text style={styles.customerReportsEmpty}>
              Reports you send and the administrator&apos;s resolution updates will
              appear here.
            </Text>
          ) : null}
          {customerReportsExpanded && customerReports.length > 0 ? (
            customerReports.map((report) => (
              <View key={report.id} style={styles.customerReportCard}>
                <TouchableOpacity
                  style={styles.customerReportHeader}
                  onPress={() =>
                    setExpandedCustomerReportIds((current) => {
                      const next = new Set(current);
                      if (next.has(report.id)) next.delete(report.id);
                      else next.add(report.id);
                      return next;
                    })
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    expanded: expandedCustomerReportIds.has(report.id),
                  }}
                >
                  <Text style={styles.customerReportSubject}>
                    {report.subject}
                  </Text>
                  <View style={styles.customerReportHeaderMeta}>
                    <Text
                      style={[
                        styles.customerReportStatus,
                        report.status === "resolved"
                          ? styles.customerReportResolved
                          : styles.customerReportOpen,
                      ]}
                    >
                      {report.status.replace("_", " ").toUpperCase()}
                    </Text>
                    <Text style={styles.customerReportsChevron}>
                      {expandedCustomerReportIds.has(report.id) ? "−" : "+"}
                    </Text>
                  </View>
                </TouchableOpacity>
                {expandedCustomerReportIds.has(report.id) ? (
                  <View>
                <Text style={styles.customerReportDescription}>
                  {report.description}
                </Text>
                <Text style={styles.customerResolutionDate}>
                  Submitted: {formatDateTime(report.createdAt)}
                </Text>
                {report.assignedTechnicianName ? (
                  <Text style={styles.customerReportAssignee}>
                    Assigned technician: {report.assignedTechnicianName}
                  </Text>
                ) : null}
                <View style={styles.customerResolutionBox}>
                  <Text style={styles.customerResolutionTitle}>
                    Field Staff Work Status:{" "}
                    {report.fieldWorkStatus
                      ? report.fieldWorkStatus.replace("_", " ").toUpperCase()
                      : "NOT UPDATED"}
                  </Text>
                  {report.fieldStaffUpdate ? (
                    <Text style={styles.customerResolutionText}>
                      {report.fieldStaffUpdate}
                    </Text>
                  ) : null}
                  {report.fieldStaffUpdatedAt ? (
                    <Text style={styles.customerResolutionDate}>
                      Updated: {formatDateTime(report.fieldStaffUpdatedAt)}
                    </Text>
                  ) : null}
                </View>
                {report.customerUpdate ? (
                  <View style={styles.customerResolutionBox}>
                    <Text style={styles.customerResolutionTitle}>
                      Administrator&apos;s update
                    </Text>
                    <Text style={styles.customerResolutionText}>
                      {report.customerUpdate}
                    </Text>
                  </View>
                ) : null}
                {report.status === "resolved" ? (
                  <View style={styles.customerResolutionBox}>
                    <Text style={styles.customerResolutionTitle}>
                      How the administrator resolved it
                    </Text>
                    <Text style={styles.customerResolutionText}>
                      {report.resolution ||
                        "The administrator marked this issue resolved without adding details."}
                    </Text>
                    {report.resolvedAt ? (
                      <Text style={styles.customerResolutionDate}>
                        Resolved: {formatDateTime(report.resolvedAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : report.resolution && !report.customerUpdate ? (
                  <View style={styles.customerResolutionBox}>
                    <Text style={styles.customerResolutionTitle}>
                      Administrator&apos;s update
                    </Text>
                    <Text style={styles.customerResolutionText}>
                      {report.resolution}
                    </Text>
                  </View>
                ) : null}
                  </View>
                ) : null}
              </View>
            ))
          ) : null}
        </View>

        {/* APPLICATION STATUS */}
        <View
          style={styles.sectionHeader}
        >
          <Text
            style={styles.sectionTitle}
          >
            Connection Application
          </Text>
        </View>

        {!application ? (
          <View style={styles.emptyCard}>
            <Text
              style={styles.emptyIcon}
            >
              +
            </Text>

            <Text
              style={styles.emptyTitle}
            >
              No Application Yet
            </Text>

            <Text
              style={styles.emptyText}
            >
              Submit a new electricity
              connection application to
              begin the process.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                router.push(
                  "/new-connection" as any
                )
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Apply for New Connection
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View
              style={styles.statusCard}
            >
              <View
                style={
                  styles.statusHeader
                }
              >
                <View
                  style={[
                    styles.statusDot,
                    normalizedStatus ===
                      "active" &&
                      styles.statusDotActive,
                    normalizedStatus ===
                      "rejected" &&
                      styles.statusDotRejected,
                  ]}
                />

                <View
                  style={
                    styles.statusHeaderText
                  }
                >
                  <Text
                    style={
                      styles.statusTitle
                    }
                  >
                    {getStatusLabel()}
                  </Text>

                  <Text
                    style={
                      styles.statusDescription
                    }
                  >
                    {getStatusDescription()}
                  </Text>
                </View>
              </View>

              <View style={styles.timeline}>
                {applicationTimeline.map((step, index) => (
                  <View
                    key={step.title}
                    style={styles.timelineStep}
                  >
                    <View style={styles.timelineMarkerColumn}>
                      <View
                        style={[
                          styles.timelineMarker,
                          step.complete &&
                            styles.timelineMarkerComplete,
                          step.rejected &&
                            styles.timelineMarkerRejected,
                        ]}
                      />
                      {index < applicationTimeline.length - 1 ? (
                        <View style={styles.timelineConnector} />
                      ) : null}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTitle}>
                        {step.title}
                      </Text>
                      <Text
                        style={[
                          styles.timelineStatus,
                          step.complete &&
                            styles.timelineStatusComplete,
                          step.rejected &&
                            styles.timelineStatusRejected,
                        ]}
                      >
                        {step.status}
                      </Text>
                      <Text style={styles.timelineTimestamp}>
                        {formatDateTime(step.timestamp)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* APPLICATION DETAILS */}
            {showApplication ? (
              <View
                style={
                  styles.applicationDetails
                }
              >
                <Text
                  style={
                    styles.detailsTitle
                  }
                >
                  Application Details
                </Text>

                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    Application ID
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {application.id}
                  </Text>
                </View>

                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    Full Name
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {application.fullName ||
                      "N/A"}
                  </Text>
                </View>

                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    Email
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {application.customerEmail ||
                      "N/A"}
                  </Text>
                </View>

                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    Contact Number
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {application.contactNumber ||
                      "N/A"}
                  </Text>
                </View>

                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    Service Address
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {application.serviceAddress ||
                      "N/A"}
                  </Text>
                </View>

                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    Connection Type
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {application.connectionType ||
                      "N/A"}
                  </Text>
                </View>

                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    Submitted
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {formatDate(
                      application.submittedAt
                    )}
                  </Text>
                </View>

                {application.rejectionReason ? (
                  <View
                    style={
                      styles.rejectionBox
                    }
                  >
                    <Text
                      style={
                        styles.rejectionTitle
                      }
                    >
                      Rejection Reason
                    </Text>

                    <Text
                      style={
                        styles.rejectionText
                      }
                    >
                      {
                        application.rejectionReason
                      }
                    </Text>
                  </View>
                ) : null}

                {application.inspectionNotes ? (
                  <View
                    style={
                      styles.notesBox
                    }
                  >
                    <Text
                      style={
                        styles.notesTitle
                      }
                    >
                      Inspection Notes
                    </Text>

                    <Text
                      style={
                        styles.notesText
                      }
                    >
                      {
                        application.inspectionNotes
                      }
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* CONNECTION INFORMATION */}
            {isMeterActive && (
              <View
                style={
                  styles.connectionCard
                }
              >
                <View
                  style={
                    styles.sectionHeaderInside
                  }
                >
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Connection Information
                  </Text>

                  <View
                    style={
                      styles.activeBadge
                    }
                  >
                    <Text
                      style={
                        styles.activeBadgeText
                      }
                    >
                      ACTIVE
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.connectionRow
                  }
                >
                  <View
                    style={
                      styles.connectionItem
                    }
                  >
                    <Text
                      style={
                        styles.connectionLabel
                      }
                    >
                      Meter Number
                    </Text>

                    <Text
                      style={
                        styles.connectionValue
                      }
                    >
                      {application.meterNumber}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.connectionItem
                    }
                  >
                    <Text
                      style={
                        styles.connectionLabel
                      }
                    >
                      Status
                    </Text>

                    <Text
                      style={
                        styles.connectionValueActive
                      }
                    >
                      Connected
                    </Text>
                  </View>
                </View>

                <View style={styles.connectionRow}>
                  <View style={styles.connectionItem}>
                    <Text style={styles.connectionLabel}>
                      Your Meter Reading
                    </Text>
                    <Text style={styles.connectionValue}>
                      {formatNumber(
                        application.lastMeterReading ??
                          (application.currentReading &&
                          application.currentReading > 0
                            ? application.currentReading
                            : application.previousReading ?? 0)
                      )}{" "}
                      kWh
                    </Text>
                  </View>
                  <View style={styles.connectionItem}>
                    <Text style={styles.connectionLabel}>
                      Previous Estimated Bill
                    </Text>
                    <Text style={styles.connectionValue}>
                      {formatCurrency(
                        application.lastEstimatedBill ??
                          application.estimatedBill ??
                          0
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* LIVE ELECTRICITY MONITOR */}
            {isMeterActive && (
              <>
                <View
                  style={
                    styles.sectionHeader
                  }
                >
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Live Electricity Monitor
                  </Text>
                </View>

                <View
                  style={
                    styles.monitorCard
                  }
                >
                  <View
                    style={
                      styles.monitorHeader
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.monitorTitle
                        }
                      >
                        Electricity Usage
                      </Text>

                      <Text
                        style={
                          styles.monitorSubtitle
                        }
                      >
                        Simulated live
                        monitoring
                      </Text>
                    </View>

                    <View
                      style={
                        styles.liveBadge
                      }
                    >
                      <View
                        style={
                          styles.liveDot
                        }
                      />

                      <Text
                        style={
                          styles.liveBadgeText
                        }
                      >
                        LIVE
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.monitorMain
                    }
                  >
                    <Text
                      style={
                        styles.monitorReading
                      }
                    >
                      {formatNumber(
                        liveMeterReading,
                        2
                      )}
                    </Text>

                    <Text
                      style={
                        styles.monitorUnit
                      }
                    >
                      kWh
                    </Text>
                  </View>

                  <View
                    style={
                      styles.monitorGrid
                    }
                  >
                    <View
                      style={
                        styles.monitorStat
                      }
                    >
                      <Text
                        style={
                          styles.monitorStatLabel
                        }
                      >
                        Current Load
                      </Text>

                      <Text
                        style={
                          styles.monitorStatValue
                        }
                      >
                        {formatNumber(
                          currentLoad,
                          0
                        )}{" "}
                        W
                      </Text>
                    </View>

                    <View
                      style={
                        styles.monitorStat
                      }
                    >
                      <Text
                        style={
                          styles.monitorStatLabel
                        }
                      >
                        Appliances
                      </Text>

                      <Text
                        style={
                          styles.monitorStatValue
                        }
                      >
                        {activeApplianceCount}{" "}
                        / {applianceCount}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.monitorStat
                      }
                    >
                      <Text
                        style={
                          styles.monitorStatLabel
                        }
                      >
                        Base Usage
                      </Text>

                      <Text
                        style={
                          styles.monitorStatValue
                        }
                      >
                        {formatNumber(
                          baseConsumption,
                          2
                        )}{" "}
                        kWh
                      </Text>
                    </View>

                    <View
                      style={
                        styles.monitorStat
                      }
                    >
                      <Text
                        style={
                          styles.monitorStatLabel
                        }
                      >
                        Appliance Usage
                      </Text>

                      <Text
                        style={
                          styles.monitorStatValue
                        }
                      >
                        {formatNumber(
                          applianceEnergy,
                          4
                        )}{" "}
                        kWh
                      </Text>
                    </View>
                  </View>
                </View>

                {/* BILL CARD */}
                <View
                  style={styles.billCard}
                >
                  <View>
                    <Text
                      style={
                        styles.billLabel
                      }
                    >
                      Estimated Bill
                    </Text>

                    <Text
                      style={
                        styles.billSubtext
                      }
                    >
                      Based on ₱
                      {formatNumber(
                        electricityRate,
                        2
                      )}{" "}
                      / kWh
                    </Text>
                  </View>

                  <Text
                    style={styles.billAmount}
                  >
                    {formatCurrency(
                      liveEstimatedBill
                    )}
                  </Text>
                </View>

                <View style={styles.readingHistoryCard}>
                  <Text style={styles.readingHistoryTitle}>
                    Meter Reading History
                  </Text>
                  {meterReadings.filter(
                    (reading) => reading.applicationId === application.id
                  ).length === 0 ? (
                    <Text style={styles.readingHistoryEmpty}>
                      No saved meter readings yet.
                    </Text>
                  ) : (
                    meterReadings
                      .filter(
                        (reading) =>
                          reading.applicationId === application.id
                      )
                      .map((reading) => (
                        <View
                          key={reading.id}
                          style={styles.readingHistoryRow}
                        >
                          <View style={styles.readingHistoryDetails}>
                            <Text style={styles.readingHistoryDate}>
                              {formatDateTime(reading.readingDate)}
                            </Text>
                            <Text style={styles.readingHistoryInfo}>
                              Meter reading:{" "}
                              {formatNumber(reading.currentReading)} kWh
                            </Text>
                          </View>
                          <Text style={styles.readingHistoryBill}>
                            {formatCurrency(reading.estimatedBill)}
                          </Text>
                        </View>
                      ))
                  )}
                </View>

                {/* APPLIANCE MONITOR BUTTON */}
                <TouchableOpacity
                  style={
                    styles.applianceButton
                  }
                  onPress={() =>
                    router.push(
                      "/my-appliances" as any
                    )
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.applianceButtonTitle
                      }
                    >
                      My Appliances
                    </Text>

                    <Text
                      style={
                        styles.applianceButtonText
                      }
                    >
                      Monitor appliance
                      usage and electricity
                      consumption
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.applianceButtonArrow
                    }
                  >
                    →
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* NEW CONNECTION */}
            {normalizedStatus ===
              "rejected" && (
              <TouchableOpacity
                style={
                  styles.primaryButton
                }
                onPress={() =>
                  router.push(
                    "/new-connection" as any
                  )
                }
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Submit New Application
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text
            style={styles.footerTitle}
          >
            Kur-yente CO
          </Text>

          <Text
            style={styles.footerText}
          >
            Customer electricity
            monitoring and connection
            management system
          </Text>

          <Text
            style={styles.footerTime}
          >
            Last updated:{" "}
            {formatTime(currentTime)}
          </Text>
        </View>
      </ScrollView>
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submittingReport) {
            setReportModalVisible(false);
            setReportError(null);
          }
        }}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalCard}>
            <Text style={styles.reportModalTitle}>Report an Issue</Text>
            <ScrollView
              style={styles.reportFormScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            <Text style={styles.reportInputLabel}>Subject</Text>
            <TextInput
              style={styles.reportSubjectInput}
              value={reportSubject}
              onChangeText={(value) => {
                setReportSubject(value);
                setReportError(null);
              }}
              placeholder="Briefly describe the issue"
              placeholderTextColor="#8a9a90"
              maxLength={120}
              editable={!submittingReport}
            />
            <Text style={styles.reportInputLabel}>Contact Email</Text>
            <TextInput
              style={styles.reportSubjectInput}
              value={reportContactEmail}
              onChangeText={setReportContactEmail}
              placeholder="Email where we can reach you"
              placeholderTextColor="#8a9a90"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={320}
              editable={!submittingReport}
            />
            <Text style={styles.reportInputLabel}>Phone Number</Text>
            <TextInput
              style={styles.reportSubjectInput}
              value={reportContactPhone}
              onChangeText={setReportContactPhone}
              placeholder="Phone number where we can reach you"
              placeholderTextColor="#8a9a90"
              keyboardType="phone-pad"
              maxLength={40}
              editable={!submittingReport}
            />
            <Text style={styles.reportInputLabel}>Other Contacts (optional)</Text>
            <TextInput
              style={styles.reportSubjectInput}
              value={reportOtherContacts}
              onChangeText={setReportOtherContacts}
              placeholder="Alternative contact or preferred contact time"
              placeholderTextColor="#8a9a90"
              maxLength={500}
              editable={!submittingReport}
            />
            <Text style={styles.reportInputLabel}>Description</Text>
            <TextInput
              style={styles.reportDescriptionInput}
              value={reportDescription}
              onChangeText={(value) => {
                setReportDescription(value);
                setReportError(null);
              }}
              placeholder="Provide details about the issue"
              placeholderTextColor="#8a9a90"
              multiline
              textAlignVertical="top"
              maxLength={2000}
              editable={!submittingReport}
            />
            </ScrollView>
            {reportError ? (
              <Text accessibilityRole="alert" style={styles.reportError}>
                {reportError}
              </Text>
            ) : null}
            <View style={styles.reportModalButtons}>
              <TouchableOpacity
                style={styles.reportCancelButton}
                onPress={() => {
                  setReportModalVisible(false);
                  setReportError(null);
                }}
                disabled={submittingReport}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportSubmitButton}
                onPress={() => void handleSubmitReport()}
                disabled={submittingReport}
              >
                {submittingReport ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.reportSubmitText}>Send Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!loggingOut) {
            setLogoutModalVisible(false);
          }
        }}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalCard}>
            <Text style={styles.logoutModalTitle}>Log Out</Text>
            <Text style={styles.logoutModalMessage}>
              Are you sure you want to log out?
            </Text>
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity
                style={styles.logoutCancelButton}
                onPress={() => setLogoutModalVisible(false)}
                disabled={loggingOut}
              >
                <Text style={styles.logoutCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutConfirmButton}
                onPress={() => void handleLogout()}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.logoutConfirmText}>Log Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef7f0",
  },

  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef7f0",
  },

  loadingText: {
    marginTop: 12,
    color: "#176b3a",
    fontSize: 14,
    fontWeight: "700",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerSmall: {
    color: "#176b3a",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: "#153d27",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },

  logoutButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7e8da",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  logoutText: {
    color: "#b33a3a",
    fontSize: 12,
    fontWeight: "900",
  },

  reportButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7e8da",
    borderRadius: 14,
    padding: 15,
    marginBottom: 18,
  },

  reportButtonTitle: {
    color: "#176b3a",
    fontSize: 15,
    fontWeight: "900",
  },

  reportButtonSubtitle: {
    color: "#718076",
    fontSize: 12,
    marginTop: 4,
  },

  customerReportsSection: {
    marginBottom: 18,
  },

  customerReportsTitle: {
    color: "#153d27",
    fontSize: 18,
    fontWeight: "900",
  },

  customerReportsHeader: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dce9df",
    borderRadius: 12,
    paddingHorizontal: 13,
    marginBottom: 9,
  },

  customerReportsHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  customerReportsCount: {
    color: "#718076",
    fontSize: 11,
    fontWeight: "800",
  },

  customerReportsChevron: {
    color: "#176b3a",
    fontSize: 18,
    fontWeight: "900",
    minWidth: 18,
    textAlign: "center",
  },

  customerReportsEmpty: {
    color: "#718076",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dce9df",
    borderRadius: 14,
    padding: 14,
    fontSize: 12,
    lineHeight: 18,
  },

  customerReportCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dce9df",
    borderRadius: 14,
    padding: 14,
    marginBottom: 9,
  },

  customerReportHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },

  customerReportHeaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  customerReportSubject: {
    flex: 1,
    color: "#153d27",
    fontSize: 14,
    fontWeight: "900",
  },

  customerReportStatus: {
    overflow: "hidden",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
  },

  customerReportResolved: {
    color: "#176b3a",
    backgroundColor: "#dff2e4",
  },

  customerReportOpen: {
    color: "#8a5b08",
    backgroundColor: "#fff2cf",
  },

  customerReportDescription: {
    color: "#526258",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  customerReportAssignee: {
    color: "#526258",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },

  customerResolutionBox: {
    backgroundColor: "#f1f8f3",
    borderRadius: 10,
    padding: 11,
    marginTop: 11,
  },

  customerResolutionTitle: {
    color: "#176b3a",
    fontSize: 11,
    fontWeight: "900",
  },

  customerResolutionText: {
    color: "#34443a",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  customerResolutionDate: {
    color: "#718076",
    fontSize: 10,
    marginTop: 7,
  },

  reportModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  reportModalCard: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "90%",
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#ffffff",
  },

  reportFormScroll: {
    flexShrink: 1,
  },

  reportModalTitle: {
    color: "#176b3a",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 16,
  },

  reportInputLabel: {
    color: "#34443a",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },

  reportSubjectInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#1d3425",
    marginBottom: 14,
  },

  reportDescriptionInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 10,
    padding: 12,
    color: "#1d3425",
    marginBottom: 18,
  },

  reportError: {
    color: "#a12f2f",
    backgroundColor: "#fff0f0",
    borderColor: "#edcaca",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    fontSize: 12,
    lineHeight: 18,
  },

  reportModalButtons: {
    flexDirection: "row",
    gap: 10,
  },

  reportCancelButton: {
    minHeight: 46,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 10,
  },

  reportCancelText: {
    color: "#34443a",
    fontSize: 14,
    fontWeight: "700",
  },

  reportSubmitButton: {
    minHeight: 46,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: "#176b3a",
  },

  reportSubmitText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  logoutModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  logoutModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: 24,
    backgroundColor: "#ffffff",
  },

  logoutModalTitle: {
    color: "#176b3a",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },

  logoutModalMessage: {
    color: "#34443a",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  logoutModalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  logoutCancelButton: {
    minHeight: 46,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 10,
  },

  logoutCancelText: {
    color: "#34443a",
    fontSize: 14,
    fontWeight: "700",
  },

  logoutConfirmButton: {
    minHeight: 46,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#b33a3a",
  },

  logoutConfirmText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },

  welcomeCard: {
    backgroundColor: "#176b3a",
    borderRadius: 20,
    padding: 20,
    marginBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  welcomeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },

  welcomeBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },

  welcomeTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
  },

  welcomeText: {
    color: "#dff3e4",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  clockText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 14,
    opacity: 0.9,
  },

  sectionHeader: {
    marginBottom: 10,
  },

  sectionHeaderInside: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#153d27",
    fontSize: 18,
    fontWeight: "900",
  },

  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dcebdd",
    marginBottom: 20,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e2f2e5",
    color: "#176b3a",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 47,
    marginBottom: 12,
  },

  emptyTitle: {
    color: "#153d27",
    fontSize: 19,
    fontWeight: "900",
  },

  emptyText: {
    color: "#6c7c71",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
    marginBottom: 16,
  },

  primaryButton: {
    backgroundColor: "#176b3a",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 12,
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dcebdd",
  },

  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#e4ad35",
    marginRight: 12,
  },

  statusDotActive: {
    backgroundColor: "#22a052",
  },

  statusDotRejected: {
    backgroundColor: "#c94b4b",
  },

  statusHeaderText: {
    flex: 1,
  },

  statusTitle: {
    color: "#153d27",
    fontSize: 18,
    fontWeight: "900",
  },

  statusDescription: {
    color: "#6b786f",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },

  timeline: {
    marginTop: 22,
  },

  timelineStep: {
    flexDirection: "row",
    minHeight: 68,
  },

  timelineMarkerColumn: {
    width: 24,
    alignItems: "center",
  },

  timelineMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#edf2ee",
    borderWidth: 2,
    borderColor: "#cbd8ce",
    zIndex: 1,
  },

  timelineMarkerComplete: {
    backgroundColor: "#176b3a",
    borderColor: "#176b3a",
  },

  timelineMarkerRejected: {
    backgroundColor: "#c94b4b",
    borderColor: "#c94b4b",
  },

  timelineConnector: {
    position: "absolute",
    top: 14,
    bottom: 0,
    width: 2,
    backgroundColor: "#d8e8db",
  },

  timelineContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 14,
  },

  timelineTitle: {
    color: "#153d27",
    fontSize: 12,
    fontWeight: "900",
  },

  timelineStatus: {
    color: "#6b786f",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },

  timelineStatusComplete: {
    color: "#176b3a",
  },

  timelineStatusRejected: {
    color: "#b53b3b",
  },

  timelineTimestamp: {
    color: "#87938a",
    fontSize: 10,
    marginTop: 3,
  },

  applicationDetails: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#dcebdd",
  },

  detailsTitle: {
    color: "#153d27",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 14,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#edf2ee",
    paddingVertical: 10,
  },

  detailLabel: {
    color: "#718076",
    fontSize: 11,
    fontWeight: "700",
    width: "38%",
  },

  detailValue: {
    color: "#1d3425",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
    width: "58%",
  },

  rejectionBox: {
    backgroundColor: "#fff1f1",
    borderWidth: 1,
    borderColor: "#f0cccc",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },

  rejectionTitle: {
    color: "#9f3030",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
  },

  rejectionText: {
    color: "#783636",
    fontSize: 12,
    lineHeight: 18,
  },

  notesBox: {
    backgroundColor: "#f1f8f3",
    borderWidth: 1,
    borderColor: "#d7eadb",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },

  notesTitle: {
    color: "#176b3a",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
  },

  notesText: {
    color: "#405448",
    fontSize: 12,
    lineHeight: 18,
  },

  connectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#dcebdd",
  },

  activeBadge: {
    backgroundColor: "#dff4e4",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  activeBadgeText: {
    color: "#176b3a",
    fontSize: 9,
    fontWeight: "900",
  },

  connectionRow: {
    flexDirection: "row",
    gap: 10,
  },

  connectionItem: {
    flex: 1,
    backgroundColor: "#f4faf5",
    borderRadius: 12,
    padding: 13,
  },

  connectionLabel: {
    color: "#708076",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 5,
  },

  connectionValue: {
    color: "#1d3425",
    fontSize: 13,
    fontWeight: "900",
  },

  connectionValueActive: {
    color: "#176b3a",
    fontSize: 13,
    fontWeight: "900",
  },

  monitorCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#dcebdd",
    marginBottom: 12,
  },

  monitorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  monitorTitle: {
    color: "#153d27",
    fontSize: 17,
    fontWeight: "900",
  },

  monitorSubtitle: {
    color: "#7a887e",
    fontSize: 11,
    marginTop: 3,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e6f6e9",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#24a34f",
    marginRight: 5,
  },

  liveBadgeText: {
    color: "#176b3a",
    fontSize: 9,
    fontWeight: "900",
  },

  monitorMain: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },

  monitorReading: {
    color: "#176b3a",
    fontSize: 42,
    fontWeight: "900",
  },

  monitorUnit: {
    color: "#6c7c71",
    fontSize: 13,
    fontWeight: "800",
    marginTop: -2,
  },

  monitorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  monitorStat: {
    width: "48%",
    backgroundColor: "#f3f9f4",
    borderRadius: 12,
    padding: 12,
  },

  monitorStatLabel: {
    color: "#718076",
    fontSize: 9,
    fontWeight: "700",
  },

  monitorStatValue: {
    color: "#1d3425",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },

  billCard: {
    backgroundColor: "#176b3a",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  readingHistoryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dcebdd",
  },

  readingHistoryTitle: {
    color: "#153d27",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 8,
  },

  readingHistoryEmpty: {
    color: "#718076",
    fontSize: 12,
    paddingVertical: 8,
  },

  readingHistoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#edf2ee",
    paddingVertical: 10,
  },

  readingHistoryDetails: {
    flex: 1,
  },

  readingHistoryDate: {
    color: "#153d27",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3,
  },

  readingHistoryInfo: {
    color: "#718076",
    fontSize: 11,
    marginTop: 2,
  },

  readingHistoryBill: {
    color: "#176b3a",
    fontSize: 13,
    fontWeight: "900",
  },

  billLabel: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },

  billSubtext: {
    color: "#d9efdf",
    fontSize: 10,
    marginTop: 4,
  },

  billAmount: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },

  applianceButton: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#dcebdd",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  applianceButtonTitle: {
    color: "#153d27",
    fontSize: 16,
    fontWeight: "900",
  },

  applianceButtonText: {
    color: "#728078",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  applianceButtonArrow: {
    color: "#176b3a",
    fontSize: 25,
    fontWeight: "900",
  },

  footer: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 10,
  },

  footerTitle: {
    color: "#176b3a",
    fontSize: 12,
    fontWeight: "900",
  },

  footerText: {
    color: "#87938b",
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
  },

  footerTime: {
    color: "#9aa59e",
    fontSize: 9,
    marginTop: 5,
  },
});