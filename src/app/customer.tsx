import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
    collection,
    onSnapshot,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
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
  submittedAt?: any;
  updatedAt?: any;
  inspectedAt?: any;
  approvedAt?: any;
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

export default function CustomerScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [application, setApplication] =
    useState<Application | null>(null);

  const [appliances, setAppliances] =
    useState<Appliance[]>([]);

  const [loading, setLoading] = useState(true);

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

  const getLiveKwh = (
    appliance: Appliance
  ) => {
    const savedKwh =
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

    if (normalizedStatus === "approved") {
      return "Approved";
    }

    if (normalizedStatus === "active") {
      return "Active";
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

    if (normalizedStatus === "approved") {
      return "Your application has been approved.";
    }

    if (normalizedStatus === "active") {
      return "Your electricity connection is active.";
    }

    if (normalizedStatus === "rejected") {
      return "Your application was rejected.";
    }

    return "Your application is being processed.";
  };

  const getProgressStep = () => {
    if (!application) {
      return 0;
    }

    if (normalizedStatus === "pending") {
      return 1;
    }

    if (
      normalizedStatus ===
      "for inspection"
    ) {
      return 2;
    }

    if (
      normalizedStatus ===
      "inspected"
    ) {
      return 3;
    }

    if (
      normalizedStatus ===
      "approved"
    ) {
      return 4;
    }

    if (normalizedStatus === "active") {
      return 5;
    }

    if (normalizedStatus === "rejected") {
      return 0;
    }

    return 1;
  };

  const progressStep =
    getProgressStep();

  const showApplication =
    !!application;

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
              PELCO
            </Text>

            <Text
              style={styles.headerTitle}
            >
              Customer Dashboard
            </Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() =>
              router.replace("/")
            }
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

              {/* APPLICATION PROGRESS */}
              {normalizedStatus !==
                "rejected" && (
                <View
                  style={
                    styles.progressContainer
                  }
                >
                  <View
                    style={
                      styles.progressLine
                    }
                  />

                  {[1, 2, 3, 4, 5].map(
                    (step) => (
                      <View
                        key={step}
                        style={
                          styles.progressStep
                        }
                      >
                        <View
                          style={[
                            styles.progressCircle,
                            progressStep >=
                              step &&
                              styles.progressCircleActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.progressNumber,
                              progressStep >=
                                step &&
                                styles.progressNumberActive,
                            ]}
                          >
                            {step}
                          </Text>
                        </View>

                        <Text
                          style={
                            styles.progressLabel
                          }
                        >
                          {step === 1 &&
                            "Submitted"}

                          {step === 2 &&
                            "Inspection"}

                          {step === 3 &&
                            "Inspected"}

                          {step === 4 &&
                            "Approved"}

                          {step === 5 &&
                            "Active"}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              )}
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
            PELCO Electricity App
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

  progressContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    position: "relative",
  },

  progressLine: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 16,
    height: 2,
    backgroundColor: "#d8e8db",
  },

  progressStep: {
    width: "19%",
    alignItems: "center",
  },

  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#edf2ee",
    borderWidth: 1,
    borderColor: "#d5e1d7",
    alignItems: "center",
    justifyContent: "center",
  },

  progressCircleActive: {
    backgroundColor: "#176b3a",
    borderColor: "#176b3a",
  },

  progressNumber: {
    color: "#7b8a80",
    fontSize: 11,
    fontWeight: "900",
  },

  progressNumberActive: {
    color: "#ffffff",
  },

  progressLabel: {
    color: "#6c7b70",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
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