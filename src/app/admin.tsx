import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
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
  ScrollView,
  StyleSheet,
  Text,
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
  updatedAt?: any;

  meterNumber?: string;
  meterStatus?: string;
  installedAt?: any;

  previousReading?: number;
  currentReading?: number;
  consumption?: number;
  readingRate?: number;
  estimatedBill?: number;
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

export default function AdminScreen() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [appliances, setAppliances] = useState<Appliance[]>([]);

  const [loadingApplications, setLoadingApplications] =
    useState(true);

  const [loadingAppliances, setLoadingAppliances] =
    useState(true);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);

  /*
   * LIVE CLOCK
   *
   * This updates every second so the admin dashboard
   * can calculate the customer's current live KWh.
   */
  const [clock, setClock] = useState(Date.now());

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
    const savedKwh = Number(
      appliance.totalKwh || 0
    );

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

  /*
   * ---------------------------------------------------------
   * APPROVE APPLICATION
   * ---------------------------------------------------------
   */
  const handleApprove = async (
    application: Application
  ) => {
    try {
      setProcessingId(application.id);

      console.log(
        "Approving application:",
        application.id
      );

      await updateDoc(
        doc(
          db,
          "applications",
          application.id
        ),
        {
          status: "approved",
          updatedAt: new Date(),
        }
      );

      console.log("Application approved.");

      setProcessingId(null);

      Alert.alert(
        "Application Approved",
        `${application.fullName}'s application has been approved.\n\nThe application is now ready for site inspection.`
      );
    } catch (error: any) {
      console.log(
        "Approve application error:",
        error
      );

      setProcessingId(null);

      Alert.alert(
        "Approval Failed",
        error?.message ||
          "Unable to approve the application."
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * REJECT APPLICATION
   * ---------------------------------------------------------
   */
  const handleReject = async (
    application: Application
  ) => {
    Alert.alert(
      "Reject Application",
      `Are you sure you want to reject ${application.fullName}'s application?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingId(application.id);

              console.log(
                "Rejecting application:",
                application.id
              );

              await updateDoc(
                doc(
                  db,
                  "applications",
                  application.id
                ),
                {
                  status: "rejected",
                  rejectionReason:
                    "Application was rejected by the PELCO administrator.",
                  updatedAt: new Date(),
                }
              );

              console.log(
                "Application rejected."
              );

              setProcessingId(null);

              Alert.alert(
                "Application Rejected",
                `${application.fullName}'s application has been rejected.`
              );
            } catch (error: any) {
              console.log(
                "Reject application error:",
                error
              );

              setProcessingId(null);

              Alert.alert(
                "Rejection Failed",
                error?.message ||
                  "Unable to reject the application."
              );
            }
          },
        },
      ]
    );
  };

  /*
   * ---------------------------------------------------------
   * LOGOUT
   * ---------------------------------------------------------
   */
  const handleLogout = async () => {
    try {
      setLoggingOut(true);

      await signOut(auth);

      router.replace("/" as any);
    } catch (error) {
      console.log(
        "Logout error:",
        error
      );

      Alert.alert(
        "Error",
        "Unable to logout."
      );

      setLoggingOut(false);
    }
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
              PELCO SYSTEM
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

                return (
                  <View
                    key={`active-${application.id}`}
                    style={
                      styles.activeMeterCard
                    }
                  >
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
                          Recorded Bill
                        </Text>

                        <Text
                          style={
                            styles.meterBillValue
                          }
                        >
                          {formatCurrency(
                            application.estimatedBill
                          )}
                        </Text>
                      </View>
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
            New Connection Applications
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
        ) : applications.length ===
          0 ? (
          <View
            style={styles.emptyCard}
          >
            <Text
              style={styles.emptyTitle}
            >
              No Applications Yet
            </Text>

            <Text
              style={styles.emptyText}
            >
              Customer new connection
              applications will appear here.
            </Text>
          </View>
        ) : (
          applications.map(
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

              const isInspectionPassed =
                application.status.toLowerCase() ===
                "inspection_passed";

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

                  {/* ACTIVE METER INFORMATION */}
                  {isActive &&
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
                            ACTIVE
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
                  ) : null}
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