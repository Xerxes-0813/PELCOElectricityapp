import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
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
  customerEmail: string;
  fullName: string;
  contactNumber: string;
  serviceAddress: string;
  connectionType: "Residential" | "Commercial";
  status: string;
  rejectionReason?: string;
  submittedAt?: any;
  reviewedAt?: any;
  approvedAt?: any;
  inspectedAt?: any;
  updatedAt?: any;

  meterNumber?: string;
  meterStatus?: string;
  installedAt?: any;
  activatedAt?: any;

  previousReading?: number;
  currentReading?: number;
  consumption?: number;
  readingRate?: number;
  estimatedBill?: number;
  lastMeterReading?: number;
  lastReadingConsumption?: number;
  lastEstimatedBill?: number;
  billingCycleStartedAt?: any;
  readingUpdatedAt?: any;
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
  customerId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  status:
    | "pending"
    | "under_review"
    | "assigned"
    | "in_progress"
    | "resolved"
    | "closed"
    | "rejected"
    | "not_resolved";
  priority?: "low" | "medium" | "high" | "emergency";
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  fieldWorkStatus?: "in_progress" | "done" | "not_done";
  fieldStaffUpdate?: string;
  fieldStaffUpdatedAt?: any;
  customerUpdate?: string;
  contactPhone?: string;
  otherContacts?: string;
  resolution?: string;
  createdAt?: any;
};

type ReportInternalNote = {
  id: string;
  text: string;
  author: string;
  createdAt?: any;
};

type ManagedUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  role: string;
  status?: string;
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

export default function AdminScreen() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([]);
  const [customerReports, setCustomerReports] = useState<CustomerReport[]>([]);
  const [reportResolutionInputs, setReportResolutionInputs] = useState<
    Record<string, string>
  >({});
  const [reportCustomerUpdates, setReportCustomerUpdates] = useState<
    Record<string, string>
  >({});
  const [reportInternalNotes, setReportInternalNotes] = useState<
    Record<string, string>
  >({});
  const [savedReportInternalNotes, setSavedReportInternalNotes] = useState<
    Record<string, ReportInternalNote[]>
  >({});
  const [expandedReportIds, setExpandedReportIds] = useState<Set<string>>(
    () => new Set()
  );
  const reportIds = customerReports.map((report) => report.id).join("\u001f");
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userManagementExpanded, setUserManagementExpanded] =
    useState(false);

  const [loadingApplications, setLoadingApplications] =
    useState(true);

  const [loadingAppliances, setLoadingAppliances] =
    useState(true);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);
  const [expandedApplicationIds, setExpandedApplicationIds] = useState<
    Set<string>
  >(() => new Set());
  const [actionModal, setActionModal] = useState<ActionModalState | null>(
    null
  );

  useEffect(() => {
    const usersQuery = query(collection(db, "users"));

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const userList: ManagedUser[] = snapshot.docs.map((document) => {
          const data = document.data();

          return {
            id: document.id,
            firstName: data.firstName,
            lastName: data.lastName,
            name: data.name,
            email: data.email,
            phoneNumber: data.phoneNumber,
            role: String(data.role || ""),
            status: data.status,
          };
        });

        setManagedUsers(userList);
        setLoadingUsers(false);
      },
      (error) => {
        console.log("Admin users loading error:", error);
        setLoadingUsers(false);
        Alert.alert(
          "Unable to Load Users",
          error.message || "Something went wrong while loading users."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /*
   * LIVE CLOCK
   *
   * This updates every second so the admin dashboard
   * can calculate the customer's current live KWh.
   */
  const [clock, setClock] = useState(Date.now());
  const getTimestampMillis = (timestamp: any) => {
    if (typeof timestamp?.toMillis === "function") {
      return timestamp.toMillis();
    }
    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }
    return typeof timestamp === "number" ? timestamp : 0;
  };

  /*
   * ---------------------------------------------------------
   * APPLICATION LISTENER
   * ---------------------------------------------------------
   */
  useEffect(() => {
    console.log("Admin: loading applications...");

    const applicationsQuery = query(
      collection(db, "applications"),
      orderBy("submittedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      applicationsQuery,
      (snapshot) => {
        console.log(
          "Admin: applications found:",
          snapshot.docs.length
        );

        const applicationList: Application[] =
          snapshot.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Omit<
              Application,
              "id"
            >),
          }));

        setApplications(applicationList);
        setLoadingApplications(false);
      },
      (error) => {
        console.log(
          "Admin applications loading error:",
          error
        );

        setLoadingApplications(false);

        Alert.alert(
          "Unable to Load Applications",
          error.message ||
            "Something went wrong while loading applications."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const readingsQuery = query(collection(db, "meterReadings"));

    const unsubscribe = onSnapshot(
      readingsQuery,
      (snapshot) => {
        const readings: MeterReading[] = snapshot.docs.map((document) => {
          const data = document.data();
          return {
            id: document.id,
            applicationId: String(data.applicationId || ""),
            currentReading: Number(data.currentReading || 0),
            consumption: Number(data.consumption || 0),
            estimatedBill: Number(data.estimatedBill || 0),
            readingDate: data.readingDate || data.createdAt,
          };
        });
        readings.sort((a, b) => {
          const aTime = a.readingDate?.toMillis?.() || 0;
          const bTime = b.readingDate?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setMeterReadings(readings);
      },
      (error) => {
        console.log("Admin meter reading history error:", error);
        Alert.alert(
          "Unable to Load Meter Reading History",
          error.message || "Something went wrong while loading meter readings."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const reportsQuery = query(collection(db, "reports"));
    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const reports: CustomerReport[] = snapshot.docs.map((document) => {
          const data = document.data();
          return {
            id: document.id,
            customerId: String(data.customerId || ""),
            customerName: String(data.customerName || "Customer"),
            customerEmail: String(data.customerEmail || ""),
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
            priority: ["low", "medium", "high", "emergency"].includes(
              data.priority
            )
              ? data.priority
              : "medium",
            assignedTechnicianId: String(data.assignedTechnicianId || ""),
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
            contactPhone: String(data.contactPhone || ""),
            otherContacts: String(data.otherContacts || ""),
            resolution: String(data.resolution || ""),
            createdAt: data.createdAt,
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
        console.log("Admin customer reports loading error:", error);
        Alert.alert(
          "Unable to Load Customer Reports",
          error.message || "Something went wrong while loading customer reports."
        );
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!reportIds) {
      return;
    }
    const unsubscribes = reportIds.split("\u001f").map((reportId) =>
      onSnapshot(
        query(
          collection(db, "reports", reportId, "internalNotes"),
          orderBy("createdAt", "asc")
        ),
        (snapshot) => {
          const notes: ReportInternalNote[] = snapshot.docs.map((noteDoc) => {
            const data = noteDoc.data();
            return {
              id: noteDoc.id,
              text: String(data.text || ""),
              author: String(data.author || "Admin"),
              createdAt: data.createdAt,
            };
          });
          setSavedReportInternalNotes((current) => ({
            ...current,
            [reportId]: notes,
          }));
        },
        (error) => {
          console.log("Admin internal report notes error:", error);
          Alert.alert(
            "Unable to Load Internal Notes",
            error.message || "The report's internal notes could not be loaded."
          );
        }
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [reportIds]);

  /*
   * ---------------------------------------------------------
   * APPLIANCE LISTENER
   * ---------------------------------------------------------
   *
   * We listen to ALL customer appliances.
   *
   * The customer app already saves:
   *
   * - customerId
   * - wattage
   * - status
   * - turnedOnAt
   * - totalKwh
   *
   * The admin uses those same values to calculate
   * the live KWh without writing to Firestore every second.
   */
  useEffect(() => {
    console.log("Admin: loading customer appliances...");

    setLoadingAppliances(true);

    const appliancesQuery = query(
      collection(db, "appliances")
    );

    const unsubscribe = onSnapshot(
      appliancesQuery,
      (snapshot) => {
        console.log(
          "Admin: appliances found:",
          snapshot.docs.length
        );

        const applianceList: Appliance[] =
          snapshot.docs.map((document) => {
            const data = document.data();

            return {
              id: document.id,
              customerId: data.customerId || "",
              name: data.name || "",
              category: data.category || "Other",
              wattage: Number(data.wattage || 0),
              status:
                data.status === "on"
                  ? "on"
                  : "off",
              turnedOnAt: data.turnedOnAt,
              totalKwh: Number(
                data.totalKwh || 0
              ),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          });

        setAppliances(applianceList);
        setLoadingAppliances(false);
      },
      (error) => {
        console.log(
          "Admin appliances loading error:",
          error
        );

        setLoadingAppliances(false);

        Alert.alert(
          "Unable to Load Appliances",
          error.message ||
            "Something went wrong while loading customer appliances."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /*
   * ---------------------------------------------------------
   * LIVE CLOCK
   * ---------------------------------------------------------
   *
   * Update every second.
   *
   * This causes the live KWh calculation to refresh
   * every second on the admin dashboard.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /*
   * ---------------------------------------------------------
   * LIVE KWH CALCULATOR
   * ---------------------------------------------------------
   *
   * This follows the same calculation used by the
   * customer appliance simulator.
   *
   * Formula:
   *
   * kWh = watts / 1000 * hours
   *
   * Existing saved KWh is included as well.
   */
  const getLiveKwh = (appliance: Appliance) => {
    const customerCycleStart = getTimestampMillis(
      applications.find(
        (application) => application.customerId === appliance.customerId
      )?.billingCycleStartedAt
    );
    const applianceUpdatedAt = getTimestampMillis(appliance.updatedAt);
    const savedKwh =
      customerCycleStart > 0 && applianceUpdatedAt < customerCycleStart
        ? 0
        : Number(appliance.totalKwh || 0);

    if (
      appliance.status !== "on" ||
      !appliance.turnedOnAt
    ) {
      return savedKwh;
    }

    let turnedOnTime = 0;

    try {
      if (
        typeof appliance.turnedOnAt.toMillis ===
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
        typeof appliance.turnedOnAt === "number"
      ) {
        turnedOnTime =
          appliance.turnedOnAt;
      }
    } catch (error) {
      console.log(
        "Unable to read appliance turnedOnAt:",
        error
      );
    }

    if (!turnedOnTime) {
      return savedKwh;
    }

    if (customerCycleStart > 0) {
      turnedOnTime = Math.max(turnedOnTime, customerCycleStart);
    }

    const elapsedMilliseconds =
      Math.max(
        clock - turnedOnTime,
        0
      );

    const elapsedHours =
      elapsedMilliseconds /
      (1000 * 60 * 60);

    const additionalKwh =
      (Number(appliance.wattage || 0) /
        1000) *
      elapsedHours;

    return savedKwh + additionalKwh;
  };

  /*
   * ---------------------------------------------------------
   * GET CUSTOMER LIVE ENERGY
   * ---------------------------------------------------------
   */
  const getCustomerLiveKwh = (
    customerId: string
  ) => {
    return appliances
      .filter(
        (appliance) =>
          appliance.customerId ===
          customerId
      )
      .reduce(
        (total, appliance) =>
          total + getLiveKwh(appliance),
        0
      );
  };

  /*
   * ---------------------------------------------------------
   * GET CUSTOMER APPLIANCE COUNT
   * ---------------------------------------------------------
   */
  const getCustomerApplianceCount = (
    customerId: string
  ) => {
    return appliances.filter(
      (appliance) =>
        appliance.customerId ===
        customerId
    ).length;
  };

  /*
   * ---------------------------------------------------------
   * GET CUSTOMER ON APPLIANCE COUNT
   * ---------------------------------------------------------
   */
  const getCustomerOnApplianceCount = (
    customerId: string
  ) => {
    return appliances.filter(
      (appliance) =>
        appliance.customerId ===
          customerId &&
        appliance.status === "on"
    ).length;
  };

  /*
   * ---------------------------------------------------------
   * FORMAT KWH
   * ---------------------------------------------------------
   */
  const formatKwh = (value: number) => {
    return value.toFixed(3);
  };

  /*
   * ---------------------------------------------------------
   * FORMAT CURRENCY
   * ---------------------------------------------------------
   */
  const formatCurrency = (value?: number) => {
    return `₱${(value ?? 0).toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  /*
   * ---------------------------------------------------------
   * ELECTRICITY RATE
   * ---------------------------------------------------------
   *
   * Same rate used by the customer simulator.
   */
  const electricityRate = 12;

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
    } finally {
      setProcessingId(null);
    }
  };

  /*
   * ---------------------------------------------------------
   * APPROVE APPLICATION
   * ---------------------------------------------------------
   */
  const handleApprove = async (
    application: Application
  ) => {
    requestAction(
      "Approve Application",
      `Approve ${application.fullName}'s application and send it to site inspection?`,
      "Approve",
      async () => {
        setProcessingId(application.id);
        const reviewedAt = new Date();
        await updateDoc(doc(db, "applications", application.id), {
          status: "approved",
          reviewedAt,
          approvedAt: reviewedAt,
          updatedAt: reviewedAt,
        });
        return `${application.fullName}'s application has been approved and is ready for site inspection.`;
      }
    );
  };

  /*
   * ---------------------------------------------------------
   * REJECT APPLICATION
   * ---------------------------------------------------------
   */
  const handleReject = async (
    application: Application
  ) => {
    requestAction(
      "Reject Application",
      `Reject ${application.fullName}'s application?`,
      "Reject",
      async () => {
        setProcessingId(application.id);
        const reviewedAt = new Date();
        await updateDoc(doc(db, "applications", application.id), {
          status: "rejected",
          rejectionReason:
            "Application was rejected by the Kur-yente CO administrator.",
          reviewedAt,
          updatedAt: reviewedAt,
        });
        return `${application.fullName}'s application has been rejected.`;
      }
    );
  };

  const handleActivateService = async (
    application: Application
  ) => {
    requestAction(
      "Activate Service",
      `Activate electricity service for ${application.fullName}?`,
      "Activate Service",
      async () => {
        setProcessingId(application.id);
        const activatedAt = new Date();
        await updateDoc(doc(db, "applications", application.id), {
          status: "active",
          meterStatus: "active",
          activatedAt,
          updatedAt: activatedAt,
        });
        return `${application.fullName}'s electricity service has been activated.`;
      }
    );
  };

  const isManagedUserActive = (user: ManagedUser) => {
    const status = user.status?.toLowerCase();
    return !["inactive", "disabled", "deactivated"].includes(status || "");
  };

  const getManagedUserName = (user: ManagedUser) =>
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Unnamed user";

  const handleUserStatusChange = (user: ManagedUser) => {
    const currentlyActive = isManagedUserActive(user);
    const nextStatus = currentlyActive ? "inactive" : "active";
    const action = currentlyActive ? "Disable" : "Reactivate";
    const name = getManagedUserName(user);

    requestAction(
      `${action} User`,
      `${action} ${name}'s account?`,
      action,
      async () => {
        await updateDoc(doc(db, "users", user.id), {
          status: nextStatus,
          updatedAt: new Date(),
        });
        return `${name}'s account has been ${currentlyActive ? "disabled" : "reactivated"}.`;
      }
    );
  };

  const handleUserDelete = (user: ManagedUser) => {
    const name = getManagedUserName(user);

    requestAction(
      "Delete User Profile",
      `Delete ${name}'s user profile? This removes the Firestore profile. It does not delete the Firebase Authentication account.`,
      "Delete Profile",
      async () => {
        await deleteDoc(doc(db, "users", user.id));
        return `${name}'s Firestore profile has been deleted. The Firebase Authentication account remains.`;
      }
    );
  };

  const handleReportStatusChange = async (
    report: CustomerReport,
    nextStatus: CustomerReport["status"]
  ) => {
    const resolution = (
      reportResolutionInputs[report.id] ??
      report.resolution ??
      ""
    ).trim();

    if (nextStatus === "resolved" && !resolution) {
      Alert.alert(
        "Resolution Details Required",
        "Describe how the issue was resolved before marking the report as resolved."
      );
      return;
    }

    const customerUpdate = (
      reportCustomerUpdates[report.id] ??
      report.customerUpdate ??
      ""
    ).trim();
    if (nextStatus === "rejected" && !customerUpdate) {
      Alert.alert(
        "Rejection Reason Required",
        "Add a customer update explaining why this report is being rejected."
      );
      return;
    }

    try {
      const now = new Date();
      await updateDoc(doc(db, "reports", report.id), {
        status: nextStatus,
        ...(nextStatus === "resolved" ? { resolution } : {}),
        ...(nextStatus === "resolved" ? { resolvedAt: now } : {}),
        ...(nextStatus === "closed" ? { closedAt: now } : {}),
        ...(nextStatus === "under_review" ? { acceptedAt: now } : {}),
        ...(nextStatus === "rejected" ? { customerUpdate } : {}),
        updatedAt: now,
      });
    } catch (error) {
      console.log("Customer report status update error:", error);
      Alert.alert(
        "Unable to Update Report",
        error instanceof Error
          ? error.message
          : "The report status could not be updated."
      );
    }
  };

  const updateReport = async (
    reportId: string,
    fields: Record<string, unknown>
  ) => {
    try {
      await updateDoc(doc(db, "reports", reportId), {
        ...fields,
        updatedAt: new Date(),
      });
      return true;
    } catch (error) {
      console.log("Customer report update error:", error);
      Alert.alert(
        "Unable to Update Report",
        error instanceof Error
          ? error.message
          : "The report could not be updated."
      );
      return false;
    }
  };

  const addReportInternalNote = async (report: CustomerReport) => {
    const text = (reportInternalNotes[report.id] || "").trim();
    if (!text) {
      Alert.alert("Note Required", "Enter an internal note before saving.");
      return;
    }
    try {
      await addDoc(collection(db, "reports", report.id, "internalNotes"), {
        text,
        author: auth.currentUser?.displayName || auth.currentUser?.email || "Admin",
        createdAt: new Date(),
      });
      setReportInternalNotes((current) => ({ ...current, [report.id]: "" }));
    } catch (error) {
      console.log("Admin internal report note error:", error);
      Alert.alert(
        "Unable to Save Internal Note",
        error instanceof Error
          ? error.message
          : "The internal note could not be saved."
      );
    }
  };

  const sendReportCustomerUpdate = async (report: CustomerReport) => {
    const message = (reportCustomerUpdates[report.id] || "").trim();
    if (!message) {
      Alert.alert(
        "Update Required",
        "Enter the message you want the customer to receive."
      );
      return;
    }
    if (await updateReport(report.id, { customerUpdate: message })) {
      setReportCustomerUpdates((current) => ({ ...current, [report.id]: "" }));
    }
  };

  const handleApplicationDelete = (
    application: Application
  ) => {
    requestAction(
      "Delete Application",
      `Permanently delete ${application.fullName}'s connection application? This cannot be undone.`,
      "Delete Application",
      async () => {
        setProcessingId(application.id);
        await deleteDoc(doc(db, "applications", application.id));
        return `${application.fullName}'s connection application has been deleted.`;
      }
    );
  };

  /*
   * ---------------------------------------------------------
   * LOGOUT
   * ---------------------------------------------------------
   */
  const handleLogout = () => {
    requestAction(
      "Log Out",
      "Are you sure you want to log out?",
      "Log Out",
      async () => {
        setLoggingOut(true);

        try {
          await signOut(auth);
          router.replace("/" as any);
          return "You have been logged out.";
        } catch (error) {
          setLoggingOut(false);
          throw error;
        }
      }
    );
  };

  /*
   * ---------------------------------------------------------
   * APPLICATION FILTERS
   * ---------------------------------------------------------
   */
  const pendingApplications =
    applications.filter(
      (application) =>
        application.status.toLowerCase() ===
        "pending"
    );

  const approvedApplications =
    applications.filter(
      (application) =>
        application.status.toLowerCase() ===
        "approved"
    );

  const activeMeters =
    applications.filter(
      (application) =>
        application.status.toLowerCase() ===
          "active" &&
        !!application.meterNumber
    );

  const connectionApplications = applications.filter(
    (application) =>
      application.status.toLowerCase() !== "active"
  );

  const inspectionApplications =
    applications.filter(
      (application) => {
        const status =
          application.status.toLowerCase();

        return (
          status === "inspection" ||
          status === "reinspect"
        );
      }
    );

  const customerUsers = managedUsers.filter(
    (user) => user.role.toLowerCase() === "customer"
  );
  const staffUsers = managedUsers.filter(
    (user) =>
      user.role.toLowerCase() === "staff" ||
      user.role.toLowerCase() === "field-staff"
  );
  const administratorUsers = managedUsers.filter(
    (user) =>
      user.role.toLowerCase() === "admin" ||
      user.role.toLowerCase() === "administrator"
  );

  const renderUserGroup = (title: string, users: ManagedUser[]) => (
    <View style={styles.userGroup} key={title}>
      <View style={styles.userGroupHeader}>
        <Text style={styles.userGroupTitle}>{title}</Text>
        <Text style={styles.userGroupCount}>{users.length}</Text>
      </View>
      {users.length === 0 ? (
        <Text style={styles.emptyUsersText}>No {title.toLowerCase()} found.</Text>
      ) : (
        users.map((user) => {
          const active = isManagedUserActive(user);
          const isCurrentUser = user.id === auth.currentUser?.uid;

          return (
            <View style={styles.userCard} key={user.id}>
              <View style={styles.userDetails}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>
                    {getManagedUserName(user)}
                  </Text>
                  <Text
                    style={[
                      styles.userStatusBadge,
                      active
                        ? styles.userActiveBadge
                        : styles.userInactiveBadge,
                    ]}
                  >
                    {active ? "ACTIVE" : "DISABLED"}
                  </Text>
                </View>
                <Text style={styles.userEmail}>
                  {user.email || "No email available"}
                </Text>
                {user.phoneNumber ? (
                  <Text style={styles.userPhone}>{user.phoneNumber}</Text>
                ) : null}
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[
                    styles.userStatusButton,
                    isCurrentUser && styles.userActionDisabled,
                  ]}
                  onPress={() => handleUserStatusChange(user)}
                  disabled={isCurrentUser}
                >
                  <Text style={styles.userStatusButtonText}>
                    {active ? "Disable" : "Reactivate"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.userDeleteButton,
                    isCurrentUser && styles.userActionDisabled,
                  ]}
                  onPress={() => handleUserDelete(user)}
                  disabled={isCurrentUser}
                >
                  <Text style={styles.userDeleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
              {isCurrentUser ? (
                <Text style={styles.currentUserNote}>
                  You cannot change your own account.
                </Text>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );

  /*
   * ---------------------------------------------------------
   * FORMAT DATE
   * ---------------------------------------------------------
   */
  const formatDate = (timestamp: any) => {
    if (!timestamp) {
      return "Recently submitted";
    }

    try {
      const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

      return date.toLocaleDateString(
        "en-PH",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      );
    } catch {
      return "Recently submitted";
    }
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) {
      return "Not recorded";
    }

    try {
      const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return "Not recorded";
      }

      return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "Not recorded";
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.smallTitle}>
              Kur-yente CO
            </Text>

            <Text style={styles.title}>
              Admin Dashboard
            </Text>
          </View>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              ADMIN
            </Text>
          </View>
        </View>

        {/* WELCOME */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>
            System Overview
          </Text>

          <Text style={styles.welcomeText}>
            Manage customers, applications,
            inspections, meters, and electricity
            consumption.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.userManagementButton}
          onPress={() => setUserManagementExpanded((expanded) => !expanded)}
          accessibilityRole="button"
          accessibilityState={{ expanded: userManagementExpanded }}
        >
          <View>
            <Text style={styles.userManagementButtonTitle}>
              User Management
            </Text>
            <Text style={styles.userManagementButtonSubtitle}>
              View and manage customer, staff, and administrator accounts
            </Text>
          </View>
          <Text style={styles.userManagementButtonIcon}>
            {userManagementExpanded ? "−" : "+"}
          </Text>
        </TouchableOpacity>

        {userManagementExpanded ? (
          <View style={styles.userManagementCard}>
            {loadingUsers ? (
              <View style={styles.loadingUsers}>
                <ActivityIndicator color="#176b3a" />
                <Text style={styles.emptyUsersText}>Loading users...</Text>
              </View>
            ) : (
              <>
                {renderUserGroup("Customers", customerUsers)}
                {renderUserGroup("Staff", staffUsers)}
                {renderUserGroup("Administrators", administratorUsers)}
              </>
            )}
          </View>
        ) : null}

        <View style={styles.reportsSection}>
          <View style={styles.reportsSectionHeader}>
            <View>
              <Text style={styles.reportsSectionTitle}>Customer Reports</Text>
              <Text style={styles.reportsSectionSubtitle}>
                Reports submitted by customers
              </Text>
            </View>
            <Text style={styles.reportsCount}>{customerReports.length}</Text>
          </View>
          {customerReports.length === 0 ? (
            <View style={styles.reportEmptyCard}>
              <Text style={styles.reportEmptyText}>
                No customer reports have been received.
              </Text>
            </View>
          ) : (
            customerReports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <TouchableOpacity
                  style={styles.reportCardHeader}
                  onPress={() =>
                    setExpandedReportIds((current) => {
                      const next = new Set(current);
                      if (next.has(report.id)) next.delete(report.id);
                      else next.add(report.id);
                      return next;
                    })
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    expanded: expandedReportIds.has(report.id),
                  }}
                >
                  <Text style={styles.reportSubject}>{report.subject}</Text>
                  <View style={styles.reportHeaderMeta}>
                    <Text
                      style={[
                        styles.reportStatus,
                        styles[
                          `reportStatus${report.status
                            .split("_")
                            .map((part) =>
                              part.charAt(0).toUpperCase() + part.slice(1)
                            )
                            .join("")}` as keyof typeof styles
                        ],
                      ]}
                    >
                      {report.status.replace("_", " ").toUpperCase()}
                    </Text>
                    <Text style={styles.reportDate}>
                      Submitted {formatDateTime(report.createdAt)}
                    </Text>
                      <Text style={styles.reportDropdownIcon}>
                      {expandedReportIds.has(report.id) ? "−" : "+"}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.reportWorkPreview}>
                    Field work:{" "}
                    {report.fieldWorkStatus
                      ? report.fieldWorkStatus.replace("_", " ").toUpperCase()
                      : "NOT UPDATED"}
                </Text>
                {expandedReportIds.has(report.id) ? (
                  <View>
                <Text style={styles.reportCustomerName}>
                  {report.customerName}
                  {report.customerEmail ? ` · ${report.customerEmail}` : ""}
                </Text>
                <Text style={styles.reportAssignee}>
                  {report.assignedTechnicianName
                    ? `Assigned to ${report.assignedTechnicianName}`
                    : "No technician assigned"}
                </Text>
                <View style={styles.reportFieldWorkBox}>
                  <Text style={styles.reportControlLabel}>Field Staff Work</Text>
                  <Text style={styles.reportDetailValue}>
                    {report.fieldWorkStatus
                      ? report.fieldWorkStatus.replace("_", " ").toUpperCase()
                      : "NOT UPDATED"}
                    {report.fieldStaffUpdatedAt
                      ? ` · ${formatDateTime(report.fieldStaffUpdatedAt)}`
                      : ""}
                  </Text>
                  {report.fieldStaffUpdate ? (
                    <Text style={styles.reportFieldWorkUpdate}>
                      {report.fieldStaffUpdate}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.reportFieldWorkBox}>
                  <Text style={styles.reportDetailLabel}>Description</Text>
                  <Text style={styles.reportDescription}>
                    {report.description}
                  </Text>
                  <Text style={styles.reportDetailLabel}>Contact Email</Text>
                  <Text style={styles.reportDetailValue}>
                    {report.customerEmail || "Not provided"}
                  </Text>
                  <Text style={styles.reportDetailLabel}>Phone Number</Text>
                  <Text style={styles.reportDetailValue}>
                    {report.contactPhone || "Not provided"}
                  </Text>
                  <Text style={styles.reportDetailLabel}>Other Contacts</Text>
                  <Text style={styles.reportDetailValue}>
                    {report.otherContacts || "None provided"}
                  </Text>
                </View>
                <Text style={styles.reportControlLabel}>Priority</Text>
                <View style={styles.reportOptionRow}>
                  {(["low", "medium", "high", "emergency"] as const).map(
                    (priority) => (
                      <TouchableOpacity
                        key={priority}
                        style={[
                          styles.reportOption,
                          report.priority === priority &&
                            styles.reportOptionSelected,
                        ]}
                        onPress={() =>
                          void updateReport(report.id, { priority })
                        }
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.reportOptionText,
                            report.priority === priority &&
                              styles.reportOptionTextSelected,
                          ]}
                        >
                          {priority.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>

                <Text style={styles.reportControlLabel}>Update Status</Text>
                <View style={styles.reportOptionRow}>
                  {(
                    [
                      "pending",
                      "under_review",
                      "assigned",
                      "in_progress",
                      "resolved",
                      "closed",
                    ] as const
                  ).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.reportOption,
                        report.status === status && styles.reportOptionSelected,
                      ]}
                      onPress={() =>
                        void handleReportStatusChange(report, status)
                      }
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.reportOptionText,
                          report.status === status &&
                            styles.reportOptionTextSelected,
                        ]}
                      >
                        {status.replace("_", " ").toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.reportActionButton, styles.reportAcceptButton]}
                  onPress={() =>
                    void handleReportStatusChange(report, "under_review")
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.reportActionButtonText}>
                    Accept Report
                  </Text>
                </TouchableOpacity>

                <Text style={styles.reportControlLabel}>Assign Technician</Text>
                {staffUsers.filter(
                  (user) =>
                    user.role.toLowerCase() === "field-staff" &&
                    isManagedUserActive(user)
                ).length ? (
                  <View style={styles.reportOptionRow}>
                    {staffUsers
                      .filter(
                        (user) =>
                          user.role.toLowerCase() === "field-staff" &&
                          isManagedUserActive(user)
                      )
                      .map((staff) => {
                        const name = getManagedUserName(staff);
                        const assigned =
                          report.assignedTechnicianId === staff.id;
                        return (
                          <TouchableOpacity
                            key={staff.id}
                            style={[
                              styles.reportOption,
                              assigned && styles.reportOptionSelected,
                            ]}
                            onPress={() =>
                              void updateReport(report.id, {
                                assignedTechnicianId: staff.id,
                                assignedTechnicianName: name,
                                status: "assigned",
                              })
                            }
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.reportOptionText,
                                assigned && styles.reportOptionTextSelected,
                              ]}
                            >
                              {name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                ) : (
                  <Text style={styles.reportDetailValue}>
                    No field technicians are available to assign.
                  </Text>
                )}

                <Text style={styles.reportControlLabel}>
                  Customer Update / Rejection Reason
                </Text>
                <TextInput
                  style={styles.reportResolutionInput}
                  value={
                    reportCustomerUpdates[report.id] ??
                    report.customerUpdate ??
                    ""
                  }
                  onChangeText={(value) =>
                    setReportCustomerUpdates((current) => ({
                      ...current,
                      [report.id]: value,
                    }))
                  }
                  placeholder="Ask for more information or explain a rejection"
                  placeholderTextColor="#8a9a90"
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />
                <View style={styles.reportActionRow}>
                  <TouchableOpacity
                    style={[styles.reportActionButton, styles.reportUpdateButton]}
                    onPress={() => void sendReportCustomerUpdate(report)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.reportActionButtonText}>
                      Request More Information
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reportActionButton, styles.reportRejectButton]}
                    onPress={() =>
                      void handleReportStatusChange(report, "rejected")
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.reportActionButtonText}>
                      Reject Report
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.reportControlLabel}>
                  Resolution Details (required to resolve)
                </Text>
                <TextInput
                  style={styles.reportResolutionInput}
                  value={
                    reportResolutionInputs[report.id] ??
                    report.resolution ??
                    ""
                  }
                  onChangeText={(value) =>
                    setReportResolutionInputs((current) => ({
                      ...current,
                      [report.id]: value,
                    }))
                  }
                  placeholder="Describe how the electricity issue was fixed"
                  placeholderTextColor="#8a9a90"
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />
                <Text style={styles.reportControlLabel}>Internal Notes</Text>
                {(savedReportInternalNotes[report.id] || []).map((note) => (
                  <Text
                    key={note.id}
                    style={styles.reportInternalNote}
                  >
                    {note.author} · {formatDateTime(note.createdAt)}: {note.text}
                  </Text>
                ))}
                <TextInput
                  style={styles.reportResolutionInput}
                  value={reportInternalNotes[report.id] || ""}
                  onChangeText={(value) =>
                    setReportInternalNotes((current) => ({
                      ...current,
                      [report.id]: value,
                    }))
                  }
                  placeholder="Add a note visible to admins only"
                  placeholderTextColor="#8a9a90"
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />
                <View style={styles.reportActionRow}>
                  <TouchableOpacity
                    style={[styles.reportActionButton, styles.reportResolveButton]}
                    onPress={() =>
                      void handleReportStatusChange(report, "resolved")
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.reportActionButtonText}>
                      Mark as Resolved
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reportActionButton, styles.reportCloseButton]}
                    onPress={() =>
                      void handleReportStatusChange(report, "closed")
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.reportCloseButtonText}>
                      Close Report
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reportActionButton, styles.reportUpdateButton]}
                    onPress={() => void addReportInternalNote(report)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.reportActionButtonText}>Add Note</Text>
                  </TouchableOpacity>
                </View>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* STATISTICS */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {applications.length}
            </Text>

            <Text style={styles.statLabel}>
              Applications
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {pendingApplications.length}
            </Text>

            <Text style={styles.statLabel}>
              Pending
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {approvedApplications.length}
            </Text>

            <Text style={styles.statLabel}>
              Approved
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text
              style={
                styles.activeMeterNumber
              }
            >
              {activeMeters.length}
            </Text>

            <Text style={styles.statLabel}>
              Active Meters
            </Text>
          </View>
        </View>

        {/* EXTRA STATUS SUMMARY */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text
              style={styles.summaryNumber}
            >
              {inspectionApplications.length}
            </Text>

            <Text
              style={styles.summaryLabel}
            >
              For Inspection
            </Text>
          </View>

          <View
            style={styles.summaryDivider}
          />

          <View style={styles.summaryItem}>
            <Text
              style={styles.summaryNumber}
            >
              {activeMeters.length}
            </Text>

            <Text
              style={styles.summaryLabel}
            >
              Installed
            </Text>
          </View>
        </View>

        {/* ACTIVE METER SUMMARY */}
        {activeMeters.length > 0 && (
          <>
            <View
              style={styles.sectionHeader}
            >
              <Text
                style={styles.sectionTitle}
              >
                Active Electricity Meters
              </Text>

              <Text
                style={styles.sectionSubtitle}
              >
                Currently active customer meters
              </Text>
            </View>

            {activeMeters.map(
              (application) => {
                const customerLiveKwh =
                  getCustomerLiveKwh(
                    application.customerId
                  );

                const customerApplianceCount =
                  getCustomerApplianceCount(
                    application.customerId
                  );

                const customerOnCount =
                  getCustomerOnApplianceCount(
                    application.customerId
                  );

                const liveBill =
                  customerLiveKwh *
                  electricityRate;
                const lastMeterReading =
                  application.lastMeterReading ??
                  (application.currentReading &&
                  application.currentReading > 0
                    ? application.currentReading
                    : application.previousReading ?? 0);
                const lastEstimatedBill =
                  application.lastEstimatedBill ??
                  application.estimatedBill ??
                  0;

                return (
                  <View
                    key={`active-${application.id}`}
                    style={
                      styles.activeMeterCard
                    }
                  >
                    <TouchableOpacity
                      style={styles.applicationIdDropdown}
                      onPress={() =>
                        toggleApplicationExpanded(application.id)
                      }
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
                        {expandedApplicationIds.has(application.id)
                          ? "−"
                          : "+"}
                      </Text>
                    </TouchableOpacity>
                    {expandedApplicationIds.has(application.id) && (
                      <>
                    {/* CUSTOMER HEADER */}
                    <View
                      style={
                        styles.activeMeterHeader
                      }
                    >
                      <View
                        style={
                          styles.activeMeterTitleArea
                        }
                      >
                        <Text
                          style={
                            styles.activeMeterCustomer
                          }
                        >
                          {application.fullName}
                        </Text>

                        <Text
                          style={
                            styles.activeMeterEmail
                          }
                        >
                          {
                            application.customerEmail
                          }
                        </Text>
                      </View>

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

                    {/* METER NUMBER */}
                    <View
                      style={
                        styles.meterNumberBox
                      }
                    >
                      <Text
                        style={
                          styles.meterNumberLabel
                        }
                      >
                        METER NUMBER
                      </Text>

                      <Text
                        style={
                          styles.meterNumberValue
                        }
                      >
                        {application.meterNumber ||
                          "Not assigned"}
                      </Text>
                    </View>

                    {/* METER DETAILS */}
                    <View
                      style={
                        styles.meterDetailsRow
                      }
                    >
                      <View
                        style={
                          styles.meterDetailColumn
                        }
                      >
                        <Text
                          style={
                            styles.meterDetailLabel
                          }
                        >
                          Installation
                        </Text>

                        <Text
                          style={
                            styles.meterDetailValue
                          }
                        >
                          {formatDate(
                            application.installedAt
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.meterDetailColumn
                        }
                      >
                        <Text
                          style={
                            styles.meterDetailLabel
                          }
                        >
                          Status
                        </Text>

                        <Text
                          style={
                            styles.meterDetailValue
                          }
                        >
                          {application.meterStatus ||
                            "Active"}
                        </Text>
                      </View>
                    </View>

                    {/* RECORDED METER READING */}
                    <View
                      style={
                        styles.meterDetailsRow
                      }
                    >
                      <View
                        style={
                          styles.meterDetailColumn
                        }
                      >
                        <Text
                          style={
                            styles.meterDetailLabel
                          }
                        >
                          Current Reading
                        </Text>

                        <Text
                          style={
                            styles.meterDetailValue
                          }
                        >
                          {(
                            application.currentReading ??
                            0
                          ).toFixed(2)}{" "}
                          kWh
                        </Text>
                      </View>

                      <View
                        style={
                          styles.meterDetailColumn
                        }
                      >
                        <Text
                          style={
                            styles.meterDetailLabel
                          }
                        >
                          Estimated Bill This Cycle
                        </Text>

                        <Text
                          style={
                            styles.meterBillValue
                          }
                        >
                          {formatCurrency(liveBill)}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.meterDetailsRow
                      }
                    >
                      <View
                        style={
                          styles.meterDetailColumn
                        }
                      >
                        <Text
                          style={
                            styles.meterDetailLabel
                          }
                        >
                          Your Meter Reading
                        </Text>

                        <Text
                          style={
                            styles.meterDetailValue
                          }
                        >
                          {(
                            lastMeterReading
                          ).toFixed(2)}{" "}
                          kWh
                        </Text>
                      </View>
                      <View
                        style={
                          styles.meterDetailColumn
                        }
                      >
                        <Text
                          style={
                            styles.meterDetailLabel
                          }
                        >
                          Previous Estimated Bill
                        </Text>

                        <Text
                          style={
                            styles.meterBillValue
                          }
                        >
                          {formatCurrency(lastEstimatedBill)}
                        </Text>
                      </View>
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
                                  {reading.currentReading.toFixed(2)} kWh
                                </Text>
                              </View>
                              <Text style={styles.readingHistoryBill}>
                                {formatCurrency(reading.estimatedBill)}
                              </Text>
                            </View>
                          ))
                      )}
                    </View>

                    {/* LIVE CUSTOMER SIMULATOR */}
                    <View
                      style={
                        styles.liveEnergyCard
                      }
                    >
                      <View
                        style={
                          styles.liveEnergyHeader
                        }
                      >
                        <View>
                          <Text
                            style={
                              styles.liveEnergyLabel
                            }
                          >
                            LIVE ENERGY
                          </Text>

                          <Text
                            style={
                              styles.liveEnergyTitle
                            }
                          >
                            Customer Simulator
                          </Text>
                        </View>

                        <View
                          style={
                            styles.liveIndicator
                          }
                        >
                          <View
                            style={
                              styles.liveDot
                            }
                          />

                          <Text
                            style={
                              styles.liveIndicatorText
                            }
                          >
                            LIVE
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={
                          styles.liveKwhValue
                        }
                      >
                        {formatKwh(
                          customerLiveKwh
                        )}{" "}
                        kWh
                      </Text>

                      <Text
                        style={
                          styles.liveKwhSubtext
                        }
                      >
                        Real-time simulated
                        consumption
                      </Text>

                      <View
                        style={
                          styles.liveEnergyDetails
                        }
                      >
                        <View
                          style={
                            styles.liveEnergyDetail
                          }
                        >
                          <Text
                            style={
                              styles.liveEnergyDetailLabel
                            }
                          >
                            Appliances
                          </Text>

                          <Text
                            style={
                              styles.liveEnergyDetailValue
                            }
                          >
                            {
                              customerApplianceCount
                            }
                          </Text>
                        </View>

                        <View
                          style={
                            styles.liveEnergyDivider
                          }
                        />

                        <View
                          style={
                            styles.liveEnergyDetail
                          }
                        >
                          <Text
                            style={
                              styles.liveEnergyDetailLabel
                            }
                          >
                            Currently ON
                          </Text>

                          <Text
                            style={
                              styles.liveEnergyDetailValue
                            }
                          >
                            {
                              customerOnCount
                            }
                          </Text>
                        </View>

                        <View
                          style={
                            styles.liveEnergyDivider
                          }
                        />

                        <View
                          style={
                            styles.liveEnergyDetail
                          }
                        >
                          <Text
                            style={
                              styles.liveEnergyDetailLabel
                            }
                          >
                            Live Bill
                          </Text>

                          <Text
                            style={
                              styles.liveEnergyBill
                            }
                          >
                            {formatCurrency(
                              liveBill
                            )}
                          </Text>
                        </View>
                      </View>
                    </View>
                        </>
                      )}
                      </View>
                );
              }
            )}
          </>
        )}

        {/* APPLICATIONS */}
        <View
          style={styles.sectionHeader}
        >
          <Text
            style={styles.sectionTitle}
          >
            Connection Application
          </Text>

          <Text
            style={styles.sectionSubtitle}
          >
            Review customer applications
          </Text>
        </View>

        {loadingApplications ? (
          <View
            style={styles.loadingCard}
          >
            <ActivityIndicator
              size="large"
              color="#176b3a"
            />

            <Text
              style={styles.loadingText}
            >
              Loading applications...
            </Text>
          </View>
        ) : connectionApplications.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <Text
              style={styles.emptyTitle}
            >
              {applications.length === 0
                ? "No Applications Yet"
                : "No Connection Applications to Review"}
            </Text>

            <Text
              style={styles.emptyText}
            >
              {applications.length === 0
                ? "Customer new connection applications will appear here."
                : "Active applications are shown in Active Electricity Meters."}
            </Text>
          </View>
        ) : (
          connectionApplications.map(
            (application) => {
              const isPending =
                application.status.toLowerCase() ===
                "pending";

              const isApproved =
                application.status.toLowerCase() ===
                "approved";

              const isRejected =
                application.status.toLowerCase() ===
                "rejected";

              const isActive =
                application.status.toLowerCase() ===
                "active";

              const isMeterInstalled =
                application.status.toLowerCase() ===
                "meter_installed";

              const isInspectionPassed =
                application.status.toLowerCase() ===
                "inspection_passed";

              const status = application.status.toLowerCase();
              const inspectionCompleted = [
                "inspection_passed",
                "inspection_rejected",
                "reinspect",
                "meter_installed",
                "active",
              ].includes(status);
              const meterInstalled =
                isMeterInstalled || isActive;
              const applicationTimeline = [
                {
                  title: "Application submitted",
                  status: "Submitted",
                  timestamp: application.submittedAt,
                  complete: true,
                  rejected: false,
                },
                {
                  title: "Application review",
                  status: isRejected
                    ? "Rejected"
                    : isPending
                    ? "Awaiting decision"
                    : "Approved",
                  timestamp:
                    application.reviewedAt ||
                    application.approvedAt,
                  complete: !isPending,
                  rejected: isRejected,
                },
                {
                  title: "Site inspection",
                  status: isRejected
                    ? "Not started"
                    : inspectionCompleted
                    ? "Completed"
                    : status === "inspection"
                    ? "In progress"
                    : isApproved
                    ? "Ready for inspection"
                    : "Waiting for application review",
                  timestamp: application.inspectedAt,
                  complete: inspectionCompleted,
                  rejected: false,
                },
                {
                  title: "Inspection decision",
                  status:
                    status === "inspection_rejected"
                      ? "Rejected"
                      : status === "reinspect"
                      ? "Re-inspection required"
                      : isInspectionPassed || meterInstalled
                      ? "Passed"
                      : isRejected
                      ? "Not started"
                      : "Awaiting inspection",
                  timestamp: application.inspectedAt,
                  complete: inspectionCompleted,
                  rejected: status === "inspection_rejected",
                },
                {
                  title: "Meter installation",
                  status: meterInstalled
                    ? "Meter installed"
                    : isInspectionPassed
                    ? "Ready for installation"
                    : "Not started",
                  timestamp: application.installedAt,
                  complete: meterInstalled,
                  rejected: false,
                },
                {
                  title: "Service activation",
                  status: isActive
                    ? "Active"
                    : isMeterInstalled
                    ? "Awaiting admin activation"
                    : "Not active",
                  timestamp: application.activatedAt,
                  complete: isActive,
                  rejected: false,
                },
              ];

              const isProcessing =
                processingId ===
                application.id;

              return (
                <View
                  key={application.id}
                  style={
                    styles.applicationCard
                  }
                >
                  <TouchableOpacity
                    style={styles.applicationIdDropdown}
                    onPress={() =>
                      toggleApplicationExpanded(application.id)
                    }
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
                      {expandedApplicationIds.has(application.id)
                        ? "−"
                        : "+"}
                    </Text>
                  </TouchableOpacity>
                  {expandedApplicationIds.has(application.id) && (
                    <>
                  {/* APPLICATION HEADER */}
                  <View
                    style={
                      styles.applicationHeader
                    }
                  >
                    <View
                      style={
                        styles.applicationTitleArea
                      }
                    >
                      <Text
                        style={
                          styles.applicantName
                        }
                      >
                        {application.fullName}
                      </Text>

                      <Text
                        style={
                          styles.applicationEmail
                        }
                      >
                        {
                          application.customerEmail
                        }
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isPending &&
                          styles.pendingBadge,
                        isApproved &&
                          styles.approvedBadge,
                        isRejected &&
                          styles.rejectedBadge,
                        isActive &&
                          styles.activeStatusBadge,
                        isInspectionPassed &&
                          styles.inspectionPassedBadge,
                      ]}
                    >
                      <Text
                        style={
                          styles.statusText
                        }
                      >
                        {application.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* DETAILS */}
                  <View
                    style={styles.detailRow}
                  >
                    <Text
                      style={styles.detailLabel}
                    >
                      Mobile
                    </Text>

                    <Text
                      style={styles.detailValue}
                    >
                      {
                        application.contactNumber
                      }
                    </Text>
                  </View>

                  <View
                    style={styles.detailRow}
                  >
                    <Text
                      style={styles.detailLabel}
                    >
                      Address
                    </Text>

                    <Text
                      style={styles.detailValue}
                    >
                      {
                        application.serviceAddress
                      }
                    </Text>
                  </View>

                  <View
                    style={styles.detailRow}
                  >
                    <Text
                      style={styles.detailLabel}
                    >
                      Connection
                    </Text>

                    <Text
                      style={styles.detailValue}
                    >
                      {
                        application.connectionType
                      }
                    </Text>
                  </View>

                  <View
                    style={styles.detailRow}
                  >
                    <Text
                      style={styles.detailLabel}
                    >
                      Submitted
                    </Text>

                    <Text
                      style={styles.detailValue}
                    >
                      {formatDate(
                        application.submittedAt
                      )}
                    </Text>
                  </View>

                  <View style={styles.applicationTimeline}>
                    <Text style={styles.applicationTimelineTitle}>
                      Application Progress
                    </Text>
                    {applicationTimeline.map((step, index) => (
                      <View
                        key={step.title}
                        style={styles.applicationTimelineStep}
                      >
                        <View style={styles.applicationTimelineMarkerColumn}>
                          <View
                            style={[
                              styles.applicationTimelineMarker,
                              step.complete &&
                                styles.applicationTimelineMarkerComplete,
                              step.rejected &&
                                styles.applicationTimelineMarkerRejected,
                            ]}
                          />
                          {index < applicationTimeline.length - 1 ? (
                            <View
                              style={styles.applicationTimelineConnector}
                            />
                          ) : null}
                        </View>
                        <View style={styles.applicationTimelineContent}>
                          <Text style={styles.applicationTimelineStepTitle}>
                            {step.title}
                          </Text>
                          <Text
                            style={[
                              styles.applicationTimelineStatus,
                              step.complete &&
                                styles.applicationTimelineStatusComplete,
                              step.rejected &&
                                styles.applicationTimelineStatusRejected,
                            ]}
                          >
                            {step.status}
                          </Text>
                          <Text style={styles.applicationTimelineTimestamp}>
                            {formatDateTime(step.timestamp)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* INSTALLED METER INFORMATION */}
                  {(isMeterInstalled || isActive) &&
                    application.meterNumber && (
                      <View
                        style={
                          styles.applicationMeterBox
                        }
                      >
                        <View
                          style={
                            styles.applicationMeterHeader
                          }
                        >
                          <Text
                            style={
                              styles.applicationMeterTitle
                            }
                          >
                            ✓ Meter Installed
                          </Text>

                          <Text
                            style={
                              styles.applicationMeterStatus
                            }
                          >
                            {isActive ? "ACTIVE" : "AWAITING ACTIVATION"}
                          </Text>
                        </View>

                        <Text
                          style={
                            styles.applicationMeterNumber
                          }
                        >
                          {
                            application.meterNumber
                          }
                        </Text>

                        <Text
                          style={
                            styles.applicationMeterDate
                          }
                        >
                          Installed:{" "}
                          {formatDate(
                            application.installedAt
                          )}
                        </Text>
                        {application.activatedAt ? (
                          <Text
                            style={styles.applicationMeterDate}
                          >
                            Activated:{" "}
                            {formatDate(application.activatedAt)}
                          </Text>
                        ) : null}
                      </View>
                    )}

                  {/* INSPECTION PASSED */}
                  {isInspectionPassed && (
                    <View
                      style={
                        styles.nextStepBox
                      }
                    >
                      <Text
                        style={
                          styles.nextStepTitle
                        }
                      >
                        ✓ Inspection Passed
                      </Text>

                      <Text
                        style={
                          styles.nextStepText
                        }
                      >
                        This application passed site
                        inspection and is ready for
                        meter installation by field
                        staff.
                      </Text>
                    </View>
                  )}

                  {/* REJECTION REASON */}
                  {isRejected &&
                  application.rejectionReason ? (
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

                  {/* ACTION BUTTONS */}
                  {isPending ? (
                    <View
                      style={styles.actionRow}
                    >
                      <TouchableOpacity
                        style={[
                          styles.approveButton,
                          isProcessing &&
                            styles.disabledButton,
                        ]}
                        onPress={() =>
                          handleApprove(
                            application
                          )
                        }
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator
                            color="#ffffff"
                            size="small"
                          />
                        ) : (
                          <Text
                            style={
                              styles.approveButtonText
                            }
                          >
                            APPROVE
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.rejectButton,
                          isProcessing &&
                            styles.disabledRejectButton,
                        ]}
                        onPress={() =>
                          handleReject(
                            application
                          )
                        }
                        disabled={isProcessing}
                      >
                        <Text
                          style={
                            styles.rejectButtonText
                          }
                        >
                          REJECT
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : isApproved ? (
                    <View
                      style={
                        styles.nextStepBox
                      }
                    >
                      <Text
                        style={
                          styles.nextStepTitle
                        }
                      >
                        ✓ Ready for Site Inspection
                      </Text>

                      <Text
                        style={
                          styles.nextStepText
                        }
                      >
                        This application has been
                        approved and is ready for field
                        staff inspection.
                      </Text>
                    </View>
                  ) : isMeterInstalled ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[
                          styles.approveButton,
                          isProcessing && styles.disabledButton,
                        ]}
                        onPress={() =>
                          handleActivateService(application)
                        }
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator
                            color="#ffffff"
                            size="small"
                          />
                        ) : (
                          <Text style={styles.approveButtonText}>
                            ACTIVATE SERVICE
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.applicationDeleteButton,
                      isProcessing && styles.disabledButton,
                    ]}
                    onPress={() =>
                      handleApplicationDelete(application)
                    }
                    disabled={isProcessing}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${application.fullName}'s connection application`}
                  >
                    <Text style={styles.applicationDeleteButtonText}>
                      DELETE APPLICATION
                    </Text>
                  </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            }
          )
        )}

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text style={styles.logoutText}>
              LOGOUT
            </Text>
          )}
        </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef7f0",
  },

  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  smallTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#176b3a",
    letterSpacing: 1,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1c2b21",
    marginTop: 3,
  },

  roleBadge: {
    backgroundColor: "#176b3a",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
  },

  roleText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },

  welcomeCard: {
    backgroundColor: "#176b3a",
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
  },

  welcomeTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 8,
  },

  welcomeText: {
    color: "#dcefe2",
    fontSize: 14,
    lineHeight: 21,
  },

  reportsSection: {
    marginBottom: 14,
  },

  reportsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  reportsSectionTitle: {
    color: "#153d27",
    fontSize: 18,
    fontWeight: "900",
  },

  reportsSectionSubtitle: {
    color: "#718076",
    fontSize: 12,
    marginTop: 3,
  },

  reportsCount: {
    minWidth: 30,
    height: 30,
    overflow: "hidden",
    borderRadius: 15,
    textAlign: "center",
    textAlignVertical: "center",
    color: "#176b3a",
    backgroundColor: "#dff2e4",
    fontSize: 13,
    fontWeight: "900",
    paddingTop: 6,
  },

  reportEmptyCard: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce9df",
  },

  reportEmptyText: {
    color: "#718076",
    fontSize: 13,
  },

  reportCard: {
    padding: 15,
    marginBottom: 9,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce9df",
  },

  reportDetailLabel: {
    color: "#176b3a",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
  },

  reportDetailValue: {
    color: "#526258",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  reportCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  reportHeaderMeta: {
    alignItems: "flex-end",
    gap: 5,
  },

  reportDropdownIcon: {
    color: "#176b3a",
    fontSize: 18,
    fontWeight: "900",
  },

  reportWorkPreview: {
    color: "#176b3a",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
  },

  reportSubject: {
    flex: 1,
    color: "#153d27",
    fontSize: 15,
    fontWeight: "900",
  },

  reportDate: {
    color: "#718076",
    fontSize: 10,
    textAlign: "right",
  },

  reportStatus: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
  },

  reportStatusResolved: {
    color: "#176b3a",
    backgroundColor: "#dff2e4",
  },

  reportStatusOpen: {
    color: "#8a5b08",
    backgroundColor: "#fff2cf",
  },

  reportStatusPending: {
    color: "#8a5b08",
    backgroundColor: "#fff2cf",
  },

  reportStatusUnderReview: {
    color: "#1557a0",
    backgroundColor: "#e2efff",
  },

  reportStatusAssigned: {
    color: "#a45b08",
    backgroundColor: "#fff0df",
  },

  reportStatusInProgress: {
    color: "#6840a0",
    backgroundColor: "#f0e8ff",
  },

  reportStatusClosed: {
    color: "#41464b",
    backgroundColor: "#e9ecef",
  },

  reportStatusRejected: {
    color: "#a12f2f",
    backgroundColor: "#fff0f0",
  },

  reportCustomerName: {
    color: "#176b3a",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },

  reportAssignee: {
    color: "#718076",
    fontSize: 11,
    marginTop: 4,
  },

  reportFieldWorkBox: {
    padding: 10,
    backgroundColor: "#f1f8f3",
    borderRadius: 9,
    marginTop: 9,
  },

  reportFieldWorkUpdate: {
    color: "#34443a",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  reportDescription: {
    color: "#34443a",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },

  reportResolutionLabel: {
    color: "#34443a",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 13,
    marginBottom: 6,
  },

  reportResolutionInput: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: "#d6e2d9",
    borderRadius: 10,
    padding: 10,
    color: "#1d3425",
    fontSize: 12,
    lineHeight: 18,
  },

  reportControlLabel: {
    color: "#34443a",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 14,
    marginBottom: 7,
  },

  reportOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  reportOption: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#d6e2d9",
    backgroundColor: "#ffffff",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  reportOptionSelected: {
    borderColor: "#176b3a",
    backgroundColor: "#176b3a",
  },

  reportOptionText: {
    color: "#526258",
    fontSize: 10,
    fontWeight: "800",
  },

  reportOptionTextSelected: {
    color: "#ffffff",
  },

  reportActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  reportActionButton: {
    minHeight: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  reportActionButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  reportAcceptButton: {
    alignSelf: "flex-start",
    backgroundColor: "#1557a0",
    marginTop: 9,
  },

  reportRejectButton: {
    backgroundColor: "#b33a3a",
  },

  reportUpdateButton: {
    backgroundColor: "#176b3a",
  },

  reportCloseButton: {
    backgroundColor: "#e9ecef",
    borderWidth: 1,
    borderColor: "#cbd2d8",
  },

  reportCloseButtonText: {
    color: "#41464b",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  reportInternalNote: {
    color: "#526258",
    fontSize: 11,
    lineHeight: 17,
    padding: 9,
    borderRadius: 8,
    backgroundColor: "#f2f4f3",
    marginBottom: 6,
  },

  reportStatusButton: {
    minHeight: 40,
    alignSelf: "flex-start",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    paddingHorizontal: 12,
    marginTop: 14,
  },

  reportResolveButton: {
    backgroundColor: "#176b3a",
  },

  reportReopenButton: {
    backgroundColor: "#f0f4f1",
    borderWidth: 1,
    borderColor: "#cbd8ce",
  },

  reportStatusButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  userManagementButton: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dce9df",
    padding: 17,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  userManagementButtonTitle: {
    color: "#176b3a",
    fontSize: 16,
    fontWeight: "800",
  },

  userManagementButtonSubtitle: {
    color: "#69766d",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    paddingRight: 12,
  },

  userManagementButtonIcon: {
    color: "#176b3a",
    fontSize: 26,
    fontWeight: "700",
  },

  userManagementCard: {
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#dce9df",
  },

  userGroup: {
    marginTop: 4,
    marginBottom: 14,
  },

  userGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#dce9df",
  },

  userGroupTitle: {
    color: "#1c2b21",
    fontSize: 16,
    fontWeight: "800",
  },

  userGroupCount: {
    color: "#176b3a",
    fontSize: 13,
    fontWeight: "800",
  },

  userCard: {
    padding: 13,
    marginBottom: 10,
    backgroundColor: "#f7faf7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5eee7",
  },

  userDetails: {
    marginBottom: 12,
  },

  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  userName: {
    flex: 1,
    color: "#1c2b21",
    fontSize: 15,
    fontWeight: "800",
  },

  userStatusBadge: {
    overflow: "hidden",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "800",
  },

  userActiveBadge: {
    color: "#176b3a",
    backgroundColor: "#e1f3e6",
  },

  userInactiveBadge: {
    color: "#9c2b25",
    backgroundColor: "#fdebea",
  },

  userEmail: {
    color: "#526158",
    fontSize: 12,
    marginTop: 5,
  },

  userPhone: {
    color: "#69766d",
    fontSize: 12,
    marginTop: 3,
  },

  userActions: {
    flexDirection: "row",
    gap: 8,
  },

  userStatusButton: {
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: "#176b3a",
  },

  userStatusButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  userDeleteButton: {
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#b3261e",
    backgroundColor: "#ffffff",
  },

  userDeleteButtonText: {
    color: "#b3261e",
    fontSize: 12,
    fontWeight: "800",
  },

  userActionDisabled: {
    opacity: 0.45,
  },

  currentUserNote: {
    color: "#69766d",
    fontSize: 11,
    marginTop: 8,
    textAlign: "center",
  },

  emptyUsersText: {
    color: "#69766d",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 10,
  },

  loadingUsers: {
    alignItems: "center",
    paddingVertical: 20,
  },

  statsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 14,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 20,
    minHeight: 105,
    justifyContent: "center",
  },

  statNumber: {
    fontSize: 27,
    fontWeight: "800",
    color: "#176b3a",
  },

  activeMeterNumber: {
    fontSize: 27,
    fontWeight: "800",
    color: "#176b3a",
  },

  statLabel: {
    fontSize: 12,
    color: "#69766d",
    marginTop: 5,
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 18,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dce9df",
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryNumber: {
    color: "#176b3a",
    fontSize: 21,
    fontWeight: "900",
  },

  summaryLabel: {
    color: "#718078",
    fontSize: 11,
    marginTop: 3,
  },

  summaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#e0e9e2",
  },

  sectionHeader: {
    marginTop: 14,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1c2b21",
  },

  sectionSubtitle: {
    fontSize: 13,
    color: "#69766d",
    marginTop: 4,
  },

  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 30,
    alignItems: "center",
  },

  loadingText: {
    color: "#69766d",
    marginTop: 12,
    fontSize: 13,
  },

  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 25,
    alignItems: "center",
  },

  emptyTitle: {
    color: "#1c2b21",
    fontSize: 17,
    fontWeight: "800",
  },

  emptyText: {
    color: "#69766d",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 7,
  },

  activeMeterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#cfe3d4",
  },

  activeMeterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  activeMeterTitleArea: {
    flex: 1,
    paddingRight: 10,
  },

  activeMeterCustomer: {
    color: "#1c2b21",
    fontSize: 17,
    fontWeight: "800",
  },

  activeMeterEmail: {
    color: "#718078",
    fontSize: 12,
    marginTop: 4,
  },

  activeBadge: {
    backgroundColor: "#dff2e4",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  activeBadgeText: {
    color: "#176b3a",
    fontSize: 10,
    fontWeight: "900",
  },

  meterNumberBox: {
    backgroundColor: "#f1f8f3",
    borderRadius: 11,
    padding: 13,
    marginTop: 14,
  },

  meterNumberLabel: {
    color: "#718078",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },

  meterNumberValue: {
    color: "#176b3a",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },

  meterDetailsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 13,
  },

  meterDetailColumn: {
    flex: 1,
  },

  meterDetailLabel: {
    color: "#7a887f",
    fontSize: 10,
    fontWeight: "700",
  },

  meterDetailValue: {
    color: "#304639",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },

  meterBillValue: {
    color: "#176b3a",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },

  readingHistoryCard: {
    backgroundColor: "#f7fbf8",
    borderRadius: 12,
    padding: 13,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#dcebdd",
  },

  readingHistoryTitle: {
    color: "#153d27",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 6,
  },

  readingHistoryEmpty: {
    color: "#718076",
    fontSize: 11,
    paddingVertical: 6,
  },

  readingHistoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5eee7",
    paddingVertical: 9,
  },

  readingHistoryDetails: {
    flex: 1,
  },

  readingHistoryDate: {
    color: "#153d27",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 2,
  },

  readingHistoryInfo: {
    color: "#718076",
    fontSize: 10,
    marginTop: 2,
  },

  readingHistoryBill: {
    color: "#176b3a",
    fontSize: 12,
    fontWeight: "900",
  },

  /*
   * ---------------------------------------------------------
   * LIVE ENERGY STYLES
   * ---------------------------------------------------------
   */

  liveEnergyCard: {
    backgroundColor: "#176b3a",
    borderRadius: 15,
    padding: 17,
    marginTop: 16,
  },

  liveEnergyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  liveEnergyLabel: {
    color: "#bfe3c9",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  liveEnergyTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 3,
  },

  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e4f5e8",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#176b3a",
    marginRight: 5,
  },

  liveIndicatorText: {
    color: "#176b3a",
    fontSize: 9,
    fontWeight: "900",
  },

  liveKwhValue: {
    color: "#ffffff",
    fontSize: 31,
    fontWeight: "900",
    marginTop: 17,
  },

  liveKwhSubtext: {
    color: "#cfe8d6",
    fontSize: 11,
    marginTop: 2,
  },

  liveEnergyDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#4c8b65",
  },

  liveEnergyDetail: {
    flex: 1,
    alignItems: "center",
  },

  liveEnergyDetailLabel: {
    color: "#cfe8d6",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },

  liveEnergyDetailValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3,
  },

  liveEnergyBill: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 5,
  },

  liveEnergyDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#4c8b65",
  },

  applicationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 18,
    marginBottom: 14,
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

  applicationTimeline: {
    backgroundColor: "#f8fbf8",
    borderRadius: 11,
    padding: 13,
    marginTop: 12,
  },

  applicationTimelineTitle: {
    color: "#193c28",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 13,
  },

  applicationTimelineStep: {
    flexDirection: "row",
    minHeight: 62,
  },

  applicationTimelineMarkerColumn: {
    width: 19,
    alignItems: "center",
  },

  applicationTimelineMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#cbd8ce",
    zIndex: 1,
  },

  applicationTimelineMarkerComplete: {
    backgroundColor: "#176b3a",
    borderColor: "#176b3a",
  },

  applicationTimelineMarkerRejected: {
    backgroundColor: "#b3261e",
    borderColor: "#b3261e",
  },

  applicationTimelineConnector: {
    position: "absolute",
    top: 12,
    bottom: 0,
    width: 2,
    backgroundColor: "#d8e8db",
  },

  applicationTimelineContent: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 12,
  },

  applicationTimelineStepTitle: {
    color: "#193c28",
    fontSize: 11,
    fontWeight: "800",
  },

  applicationTimelineStatus: {
    color: "#65756a",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },

  applicationTimelineStatusComplete: {
    color: "#176b3a",
  },

  applicationTimelineStatusRejected: {
    color: "#b3261e",
  },

  applicationTimelineTimestamp: {
    color: "#87938a",
    fontSize: 10,
    marginTop: 2,
  },

  applicationDeleteButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#b3261e",
    backgroundColor: "#ffffff",
    marginTop: 14,
  },

  applicationDeleteButtonText: {
    color: "#b3261e",
    fontSize: 12,
    fontWeight: "800",
  },

  dropdownIndicator: {
    color: "#176b3a",
    fontSize: 22,
    fontWeight: "700",
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
    marginBottom: 15,
  },

  applicationTitleArea: {
    flex: 1,
    paddingRight: 10,
  },

  applicantName: {
    color: "#1c2b21",
    fontSize: 17,
    fontWeight: "800",
  },

  applicationEmail: {
    color: "#718078",
    fontSize: 12,
    marginTop: 4,
  },

  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  pendingBadge: {
    backgroundColor: "#b26a00",
  },

  approvedBadge: {
    backgroundColor: "#176b3a",
  },

  rejectedBadge: {
    backgroundColor: "#b3261e",
  },

  activeStatusBadge: {
    backgroundColor: "#176b3a",
  },

  inspectionPassedBadge: {
    backgroundColor: "#4b7c5a",
  },

  statusText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },

  detailRow: {
    borderTopWidth: 1,
    borderTopColor: "#edf1ee",
    paddingVertical: 10,
  },

  detailLabel: {
    color: "#7a887f",
    fontSize: 11,
    marginBottom: 3,
  },

  detailValue: {
    color: "#304639",
    fontSize: 14,
    fontWeight: "600",
  },

  applicationMeterBox: {
    backgroundColor: "#e8f5eb",
    borderRadius: 11,
    padding: 13,
    marginTop: 12,
  },

  applicationMeterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  applicationMeterTitle: {
    color: "#176b3a",
    fontSize: 13,
    fontWeight: "900",
  },

  applicationMeterStatus: {
    color: "#176b3a",
    fontSize: 10,
    fontWeight: "900",
  },

  applicationMeterNumber: {
    color: "#193c28",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 7,
  },

  applicationMeterDate: {
    color: "#66806e",
    fontSize: 11,
    marginTop: 3,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  approveButton: {
    flex: 1,
    backgroundColor: "#176b3a",
    borderRadius: 10,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },

  approveButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  rejectButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#b3261e",
    borderRadius: 10,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },

  rejectButtonText: {
    color: "#b3261e",
    fontSize: 13,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },

  disabledRejectButton: {
    opacity: 0.5,
  },

  rejectionBox: {
    backgroundColor: "#fdecec",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },

  rejectionTitle: {
    color: "#b3261e",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },

  rejectionText: {
    color: "#7d3a37",
    fontSize: 12,
    lineHeight: 17,
  },

  nextStepBox: {
    backgroundColor: "#e6f3e9",
    borderRadius: 10,
    padding: 13,
    marginTop: 14,
  },

  nextStepTitle: {
    color: "#176b3a",
    fontSize: 13,
    fontWeight: "800",
  },

  nextStepText: {
    color: "#52705d",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  logoutButton: {
    marginTop: 25,
    height: 52,
    backgroundColor: "#b3261e",
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },

  logoutText: {
    color: "#ffffff",
    fontWeight: "800",
    letterSpacing: 1,
  },
});