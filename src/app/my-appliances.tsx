import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "../../config/firebase";

type Application = {
  id: string;
  customerId: string;
  status?: string;
  meterNumber?: string;
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

const categories = [
  "Lighting",
  "Cooling",
  "Entertainment",
  "Kitchen",
  "Appliance",
  "Laundry",
  "Other",
];

export default function MyAppliancesScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [application, setApplication] = useState<Application | null>(null);

  const [appliances, setAppliances] = useState<Appliance[]>([]);

  const [loading, setLoading] = useState(true);

  const [clock, setClock] = useState(Date.now());

  const [modalVisible, setModalVisible] = useState(false);

  const [name, setName] = useState("");

  const [category, setCategory] = useState("Appliance");

  const [wattage, setWattage] = useState("");

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appliance | null>(null);
  const [deleteModalType, setDeleteModalType] = useState<
    "confirm" | "success" | "error" | null
  >(null);
  const [deleteModalMessage, setDeleteModalMessage] = useState("");

  /*
   * AUTH LISTENER
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Authenticated user:", user.uid);
        setCurrentUserId(user.uid);
      } else {
        console.log("No authenticated user.");
        setCurrentUserId(null);
        setApplication(null);
        setAppliances([]);
      }
    });

    return unsubscribe;
  }, []);

  /*
   * LIVE CLOCK
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /*
   * APPLICATION LISTENER
   */
  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    console.log(
      "Loading application for customer:",
      currentUserId
    );

    const applicationsRef = collection(
      db,
      "applications"
    );

    const applicationsQuery = query(
      applicationsRef,
      where("customerId", "==", currentUserId)
    );

    const unsubscribe = onSnapshot(
      applicationsQuery,
      (snapshot) => {
        const results: Application[] = snapshot.docs.map(
          (item) => ({
            id: item.id,
            ...(item.data() as Omit<Application, "id">),
          })
        );

        results.sort((a, b) => {
          return b.id.localeCompare(a.id);
        });

        setApplication(results[0] || null);
      },
      (error) => {
        console.log(
          "Application loading error:",
          error
        );
      }
    );

    return unsubscribe;
  }, [currentUserId]);

  /*
   * APPLIANCE LISTENER
   */
  useEffect(() => {
    if (!currentUserId) {
      setAppliances([]);
      setLoading(false);
      return;
    }

    console.log(
      "Loading appliances for customer:",
      currentUserId
    );

    setLoading(true);

    const appliancesRef = collection(
      db,
      "appliances"
    );

    const appliancesQuery = query(
      appliancesRef,
      where("customerId", "==", currentUserId)
    );

    const unsubscribe = onSnapshot(
      appliancesQuery,
      (snapshot) => {
        const results: Appliance[] = snapshot.docs.map(
          (item) => {
            const data = item.data();

            return {
              id: item.id,
              customerId: data.customerId,
              name: data.name || "",
              category: data.category || "Other",
              wattage: Number(data.wattage || 0),
              status:
                data.status === "on" ? "on" : "off",
              turnedOnAt: data.turnedOnAt,
              totalKwh: Number(data.totalKwh || 0),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          }
        );

        results.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        console.log(
          "Appliances loaded:",
          results.length
        );

        setAppliances(results);
        setLoading(false);
      },
      (error) => {
        console.log(
          "Appliance loading error:",
          error
        );

        setLoading(false);

        Alert.alert(
          "Appliance Error",
          `Unable to load appliances.\n\n${
            error?.message || "Unknown error"
          }`
        );
      }
    );

    return unsubscribe;
  }, [currentUserId]);

  /*
   * CHECK IF METER IS ACTIVE
   */
  const normalizedStatus =
    application?.status?.toLowerCase() || "";

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

  /*
   * CALCULATE LIVE KWH
   */
  const getLiveKwh = (appliance: Appliance) => {
    const billingCycleStartedAt = getTimestampMillis(
      application?.billingCycleStartedAt
    );
    const applianceUpdatedAt = getTimestampMillis(appliance.updatedAt);
    const savedKwh =
      billingCycleStartedAt > 0 &&
      applianceUpdatedAt < billingCycleStartedAt
        ? 0
        : Number(appliance.totalKwh || 0);

    if (
      appliance.status !== "on" ||
      !appliance.turnedOnAt
    ) {
      return savedKwh;
    }

    let turnedOnTime = 0;

    if (
      appliance.turnedOnAt?.toMillis
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
      turnedOnTime = appliance.turnedOnAt;
    }

    if (!turnedOnTime) {
      return savedKwh;
    }

    if (billingCycleStartedAt > 0) {
      turnedOnTime = Math.max(turnedOnTime, billingCycleStartedAt);
    }

    const elapsedHours =
      (clock - turnedOnTime) /
      (1000 * 60 * 60);

    if (elapsedHours <= 0) {
      return savedKwh;
    }

    const liveKwh =
      (Number(appliance.wattage || 0) /
        1000) *
      elapsedHours;

    return savedKwh + liveKwh;
  };

  /*
   * CURRENT ELECTRICAL LOAD
   */
  const currentLoad = useMemo(() => {
    return appliances.reduce(
      (total, appliance) => {
        if (appliance.status === "on") {
          return (
            total +
            Number(appliance.wattage || 0)
          );
        }

        return total;
      },
      0
    );
  }, [appliances]);

  /*
   * TOTAL LIVE KWH
   */
  const totalLiveKwh = useMemo(() => {
    return appliances.reduce(
      (total, appliance) => {
        return (
          total +
          getLiveKwh(appliance)
        );
      },
      0
    );
  }, [appliances, clock]);

  /*
   * ADD APPLIANCE
   */
  const handleAddAppliance = async () => {
    if (!currentUserId) {
      Alert.alert(
        "Not Logged In",
        "Please log in again."
      );
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert(
        "Missing Appliance Name",
        "Please enter an appliance name."
      );
      return;
    }

    const numericWattage =
      Number(wattage);

    if (
      !wattage.trim() ||
      isNaN(numericWattage) ||
      numericWattage <= 0
    ) {
      Alert.alert(
        "Invalid Wattage",
        "Please enter a valid wattage greater than 0."
      );
      return;
    }

    try {
      setSaving(true);

      console.log(
        "Adding appliance:",
        trimmedName
      );

      await addDoc(
        collection(db, "appliances"),
        {
          customerId: currentUserId,
          name: trimmedName,
          category,
          wattage: numericWattage,
          status: "off",
          turnedOnAt: null,
          totalKwh: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      console.log(
        "Appliance added successfully."
      );

      setName("");
      setWattage("");
      setCategory("Appliance");
      setModalVisible(false);

      Alert.alert(
        "Success",
        "Appliance added successfully."
      );
    } catch (error: any) {
      console.log(
        "Add appliance error:",
        error
      );

      Alert.alert(
        "Error",
        `Unable to add the appliance.\n\n${
          error?.message || "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * TOGGLE APPLIANCE
   */
  const handleToggleAppliance = async (
    appliance: Appliance
  ) => {
    if (!currentUserId) {
      Alert.alert(
        "Not Logged In",
        "Please log in again."
      );
      return;
    }

    try {
      console.log(
        "Toggling appliance:",
        appliance.id,
        appliance.name
      );

      const applianceRef = doc(
        db,
        "appliances",
        appliance.id
      );

      if (appliance.status === "on") {
        const liveKwh =
          getLiveKwh(appliance);

        await updateDoc(
          applianceRef,
          {
            status: "off",
            turnedOnAt: null,
            totalKwh: Number(
              liveKwh.toFixed(6)
            ),
            updatedAt:
              serverTimestamp(),
          }
        );

        console.log(
          "Appliance turned OFF."
        );
      } else {
        const billingCycleStartedAt = getTimestampMillis(
          application?.billingCycleStartedAt
        );
        const applianceUpdatedAt = getTimestampMillis(appliance.updatedAt);

        await updateDoc(
          applianceRef,
          {
            status: "on",
            turnedOnAt:
              serverTimestamp(),
            ...(billingCycleStartedAt > 0 &&
            applianceUpdatedAt < billingCycleStartedAt
              ? { totalKwh: 0 }
              : {}),
            updatedAt:
              serverTimestamp(),
          }
        );

        console.log(
          "Appliance turned ON."
        );
      }
    } catch (error: any) {
      console.log(
        "Toggle appliance error:",
        error
      );

      Alert.alert(
        "Error",
        `Unable to change appliance status.\n\n${
          error?.message || "Unknown error"
        }`
      );
    }
  };

  /*
   * DELETE APPLIANCE
   */
  const handleDeleteAppliance = (appliance: Appliance) => {
    if (deletingId) {
      return;
    }

    setDeleteTarget(appliance);
    setDeleteModalMessage(
      `Are you sure you want to permanently delete "${appliance.name}"?`
    );
    setDeleteModalType("confirm");
  };

  const confirmDeleteAppliance = async () => {
    if (!deleteTarget || deletingId) {
      return;
    }

    const appliance = deleteTarget;
    const currentUid = auth.currentUser?.uid;

    setDeleteModalType(null);

    if (!currentUid || currentUid !== appliance.customerId) {
      setDeleteModalMessage(
        "You must be signed in as the owner of this appliance to delete it."
      );
      setDeleteModalType("error");
      return;
    }

    try {
      setDeletingId(appliance.id);

      await deleteDoc(doc(db, "appliances", appliance.id));

      setAppliances((current) =>
        current.filter((item) => item.id !== appliance.id)
      );
      setDeleteModalMessage(
        `"${appliance.name}" was deleted successfully.`
      );
      setDeleteModalType("success");
    } catch (error: any) {
      console.log("Delete appliance error:", error);

      const code = error?.code || "unknown";
      const details =
        error?.message || "Unknown Firebase error.";
      setDeleteModalMessage(
        `Unable to delete "${appliance.name}".\n\nError code: ${code}\n${details}`
      );
      setDeleteModalType("error");
    } finally {
      setDeletingId(null);
    }
  };

  /*
   * FORMAT KWH
   */
  const formatKwh = (
    value: number
  ) => {
    return value.toFixed(3);
  };

  /*
   * FORMAT PHP
   */
  const formatPeso = (
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

  /*
   * ESTIMATED BILL
   *
   * You can change this rate later.
   */
  const electricityRate = 12;

  const estimatedBill =
    totalLiveKwh *
    electricityRate;

  /*
   * LOADING STATE
   */
  if (!currentUserId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#176b3a"
        />

        <Text style={styles.loadingText}>
          Checking your account...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            router.replace(
              "/customer" as any
            )
          }
        >
          <Text style={styles.backText}>
            ←
          </Text>
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerSmall}>
            Kur-yente CO
          </Text>

          <Text style={styles.headerTitle}>
            My Appliances
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* METER STATUS */}
        <View
          style={[
            styles.meterCard,
            isMeterActive
              ? styles.meterActive
              : styles.meterInactive,
          ]}
        >
          <View
            style={styles.meterHeaderRow}
          >
            <View>
              <Text
                style={
                  styles.meterLabel
                }
              >
                METER STATUS
              </Text>

              <Text
                style={
                  styles.meterStatus
                }
              >
                {isMeterActive
                  ? "ACTIVE"
                  : "NOT ACTIVE"}
              </Text>
            </View>

            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    isMeterActive
                      ? "#32a852"
                      : "#999999",
                },
              ]}
            />
          </View>

          {application?.meterNumber ? (
            <Text
              style={
                styles.meterNumber
              }
            >
              Meter No:{" "}
              {application.meterNumber}
            </Text>
          ) : (
            <Text
              style={
                styles.meterNumber
              }
            >
              No active meter assigned.
            </Text>
          )}
        </View>

        {/* CURRENT LOAD */}
        <View style={styles.loadCard}>
          <Text style={styles.sectionLabel}>
            CURRENT ELECTRICAL LOAD
          </Text>

          <Text style={styles.loadValue}>
            {currentLoad.toFixed(0)}
            <Text style={styles.loadUnit}>
              {" "}
              W
            </Text>
          </Text>

          <Text style={styles.loadDescription}>
            Total wattage of currently ON
            appliances
          </Text>
        </View>

        {/* LIVE ENERGY */}
        <View style={styles.energyCard}>
          <View
            style={styles.energyHeaderRow}
          >
            <View>
              <Text
                style={
                  styles.sectionLabel
                }
              >
                LIVE ENERGY
              </Text>

              <Text
                style={
                  styles.energyValue
                }
              >
                {formatKwh(
                  totalLiveKwh
                )}{" "}
                <Text
                  style={
                    styles.energyUnit
                  }
                >
                  kWh
                </Text>
              </Text>
            </View>

            <View
              style={styles.liveBadge}
            >
              <View
                style={
                  styles.liveDot
                }
              />

              <Text
                style={
                  styles.liveText
                }
              >
                LIVE
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.energyDescription
            }
          >
            Estimated bill:{" "}
            {formatPeso(
              estimatedBill
            )}
          </Text>

          <Text
            style={
              styles.rateText
            }
          >
            Based on ₱
            {electricityRate.toFixed(
              2
            )}{" "}
            per kWh
          </Text>
        </View>

        {/* EXPLANATION */}
        <View
          style={
            styles.explanationCard
          }
        >
          <Text
            style={
              styles.explanationTitle
            }
          >
            How appliance monitoring
            works
          </Text>

          <Text
            style={
              styles.explanationText
            }
          >
            Turn an appliance ON to
            start tracking its energy
            consumption. The system
            calculates kWh based on its
            wattage and how long it stays
            ON.
          </Text>

          <Text
            style={
              styles.explanationExample
            }
          >
            Example: A 75W fan running
            for 3 hours uses about 0.225
            kWh.
          </Text>
        </View>

        {/* APPLIANCES HEADER */}
        <View
          style={
            styles.appliancesHeader
          }
        >
          <View>
            <Text
              style={
                styles.appliancesTitle
              }
            >
              My Appliances
            </Text>

            <Text
              style={
                styles.appliancesSubtitle
              }
            >
              {appliances.length}{" "}
              appliance
              {appliances.length !== 1
                ? "s"
                : ""}
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.addButton
            }
            onPress={() =>
              setModalVisible(true)
            }
          >
            <Text
              style={
                styles.addButtonText
              }
            >
              + Add
            </Text>
          </TouchableOpacity>
        </View>

        {/* APPLIANCE LIST */}
        {loading ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
              size="small"
              color="#176b3a"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading appliances...
            </Text>
          </View>
        ) : appliances.length === 0 ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyIcon
              }
            >
              ⚡
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No Appliances Yet
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Add your household
              appliances to start
              monitoring electricity
              usage.
            </Text>

            <TouchableOpacity
              style={
                styles.emptyButton
              }
              onPress={() =>
                setModalVisible(true)
              }
            >
              <Text
                style={
                  styles.emptyButtonText
                }
              >
                Add Appliance
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          appliances.map(
            (appliance) => {
              const liveKwh =
                getLiveKwh(
                  appliance
                );

              const applianceBill =
                liveKwh *
                electricityRate;

              const isDeleting =
                deletingId ===
                appliance.id;

              return (
                <View
                  key={
                    appliance.id
                  }
                  style={
                    styles.applianceCard
                  }
                >
                  {/* TOP ROW */}
                  <View
                    style={
                      styles.applianceTopRow
                    }
                  >
                    <View
                      style={
                        styles.applianceInfo
                      }
                    >
                      <Text
                        style={
                          styles.applianceName
                        }
                      >
                        {
                          appliance.name
                        }
                      </Text>

                      <Text
                        style={
                          styles.applianceCategory
                        }
                      >
                        {
                          appliance.category
                        }
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        appliance.status ===
                        "on"
                          ? styles.onBadge
                          : styles.offBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          appliance.status ===
                          "on"
                            ? styles.onBadgeText
                            : styles.offBadgeText,
                        ]}
                      >
                        {appliance.status ===
                        "on"
                          ? "ON"
                          : "OFF"}
                      </Text>
                    </View>
                  </View>

                  {/* WATTAGE */}
                  <View
                    style={
                      styles.detailsRow
                    }
                  >
                    <View
                      style={
                        styles.detailItem
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        POWER
                      </Text>

                      <Text
                        style={
                          styles.detailValue
                        }
                      >
                        {
                          appliance.wattage
                        }{" "}
                        W
                      </Text>
                    </View>

                    <View
                      style={
                        styles.detailItem
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        ENERGY
                      </Text>

                      <Text
                        style={
                          styles.detailValue
                        }
                      >
                        {formatKwh(
                          liveKwh
                        )}{" "}
                        kWh
                      </Text>
                    </View>

                    <View
                      style={
                        styles.detailItem
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        EST. COST
                      </Text>

                      <Text
                        style={
                          styles.detailValue
                        }
                      >
                        {formatPeso(
                          applianceBill
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* CONTROLS */}
                  <View
                    style={
                      styles.controlsRow
                    }
                  >
                    <View
                      style={
                        styles.switchContainer
                      }
                    >
                      <Text
                        style={
                          styles.switchLabel
                        }
                      >
                        {appliance.status ===
                        "on"
                          ? "Running"
                          : "Turned Off"}
                      </Text>

                      <Switch
                        value={
                          appliance.status ===
                          "on"
                        }
                        onValueChange={() =>
                          handleToggleAppliance(
                            appliance
                          )
                        }
                        disabled={
                          isDeleting
                        }
                        trackColor={{
                          false:
                            "#cccccc",
                          true:
                            "#8fc9a5",
                        }}
                        thumbColor={
                          appliance.status ===
                          "on"
                            ? "#176b3a"
                            : "#f4f3f4"
                        }
                      />
                    </View>

                    {/* DELETE BUTTON */}
                    <TouchableOpacity
                      style={
                        styles.deleteButton
                      }
                      activeOpacity={
                        0.7
                      }
                      disabled={
                        isDeleting
                      }
                      onPress={() =>
                        handleDeleteAppliance(
                          appliance
                        )
                      }
                    >
                      {isDeleting ? (
                        <ActivityIndicator
                          size="small"
                          color="#b33a3a"
                        />
                      ) : (
                        <Text
                          style={
                            styles.deleteText
                          }
                        >
                          Delete
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
          )
        )}
      </ScrollView>

      {/* ADD APPLIANCE MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setModalVisible(false)
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalContainer
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Add Appliance
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Add an appliance to
                  monitor its usage.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setModalVisible(false)
                }
              >
                <Text
                  style={
                    styles.closeButton
                  }
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            {/* NAME */}
            <Text
              style={
                styles.inputLabel
              }
            >
              Appliance Name
            </Text>

            <TextInput
              style={
                styles.input
              }
              placeholder="e.g. Electric Fan"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
            />

            {/* WATTAGE */}
            <Text
              style={
                styles.inputLabel
              }
            >
              Wattage (W)
            </Text>

            <TextInput
              style={
                styles.input
              }
              placeholder="e.g. 75"
              placeholderTextColor="#999"
              value={wattage}
              onChangeText={setWattage}
              keyboardType="numeric"
            />

            {/* CATEGORY */}
            <Text
              style={
                styles.inputLabel
              }
            >
              Category
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              style={
                styles.categoryScroll
              }
            >
              {categories.map(
                (item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.categoryButton,
                      category ===
                      item
                        ? styles.categorySelected
                        : null,
                    ]}
                    onPress={() =>
                      setCategory(
                        item
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        category ===
                        item
                          ? styles.categorySelectedText
                          : null,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>

            {/* SAVE */}
            <TouchableOpacity
              style={
                styles.saveButton
              }
              onPress={
                handleAddAppliance
              }
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator
                  color="#ffffff"
                />
              ) : (
                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  Add Appliance
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.cancelButton
              }
              onPress={() =>
                setModalVisible(false)
              }
              disabled={saving}
            >
              <Text
                style={
                  styles.cancelButtonText
                }
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={deleteModalType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingId) {
            setDeleteModalType(null);
            setDeleteTarget(null);
          }
        }}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.modalTitle}>
              {deleteModalType === "confirm"
                ? "Delete Appliance?"
                : deleteModalType === "success"
                  ? "Appliance Deleted"
                  : "Delete Failed"}
            </Text>
            <Text style={styles.deleteModalMessage}>
              {deleteModalMessage}
            </Text>
            <View style={styles.deleteModalActions}>
              {deleteModalType === "confirm" ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.deleteModalButton,
                      styles.deleteModalCancelButton,
                    ]}
                    onPress={() => {
                      setDeleteModalType(null);
                      setDeleteTarget(null);
                    }}
                    disabled={!!deletingId}
                  >
                    <Text style={styles.deleteModalCancelText}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.deleteModalButton,
                      styles.deleteModalConfirmButton,
                    ]}
                    onPress={confirmDeleteAppliance}
                    disabled={!!deletingId}
                  >
                    {deletingId ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.deleteModalConfirmText}>
                        Delete
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.deleteModalButton,
                    styles.deleteModalConfirmButton,
                  ]}
                  onPress={() => {
                    setDeleteModalType(null);
                    setDeleteTarget(null);
                  }}
                >
                  <Text style={styles.deleteModalConfirmText}>
                    Close
                  </Text>
                </TouchableOpacity>
              )}
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

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef7f0",
  },

  loadingContainer: {
    paddingVertical: 30,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "#555555",
    fontSize: 14,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  header: {
    backgroundColor: "#176b3a",
    paddingTop: 55,
    paddingBottom: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  backText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginTop: -3,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerSmall: {
    color: "#bce5c9",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 2,
  },

  meterCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
  },

  meterActive: {
    backgroundColor: "#e6f6eb",
    borderColor: "#9ed3ae",
  },

  meterInactive: {
    backgroundColor: "#f2f2f2",
    borderColor: "#dddddd",
  },

  meterHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  meterLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#666666",
    letterSpacing: 1,
  },

  meterStatus: {
    fontSize: 19,
    fontWeight: "900",
    color: "#176b3a",
    marginTop: 3,
  },

  statusDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },

  meterNumber: {
    marginTop: 10,
    fontSize: 13,
    color: "#555555",
    fontWeight: "600",
  },

  loadCard: {
    backgroundColor: "#176b3a",
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },

  sectionLabel: {
    color: "#bce5c9",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  loadValue: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "900",
    marginTop: 5,
  },

  loadUnit: {
    fontSize: 20,
    fontWeight: "800",
  },

  loadDescription: {
    color: "#dcefe2",
    fontSize: 12,
    marginTop: 4,
  },

  energyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#dcebdd",
  },

  energyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  energyValue: {
    color: "#176b3a",
    fontSize: 31,
    fontWeight: "900",
    marginTop: 4,
  },

  energyUnit: {
    fontSize: 16,
    fontWeight: "800",
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e9f7ed",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#32a852",
    marginRight: 5,
  },

  liveText: {
    color: "#176b3a",
    fontSize: 10,
    fontWeight: "900",
  },

  energyDescription: {
    color: "#444444",
    fontSize: 13,
    marginTop: 10,
    fontWeight: "700",
  },

  rateText: {
    color: "#888888",
    fontSize: 11,
    marginTop: 3,
  },

  explanationCard: {
    backgroundColor: "#e7f4ea",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },

  explanationTitle: {
    color: "#176b3a",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 7,
  },

  explanationText: {
    color: "#4b5c4f",
    fontSize: 12,
    lineHeight: 18,
  },

  explanationExample: {
    color: "#176b3a",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 9,
    lineHeight: 18,
  },

  appliancesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  appliancesTitle: {
    color: "#1e2a21",
    fontSize: 21,
    fontWeight: "900",
  },

  appliancesSubtitle: {
    color: "#777777",
    fontSize: 12,
    marginTop: 2,
  },

  addButton: {
    backgroundColor: "#176b3a",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },

  addButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dcebdd",
  },

  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },

  emptyTitle: {
    color: "#1e2a21",
    fontSize: 18,
    fontWeight: "900",
  },

  emptyText: {
    color: "#777777",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },

  emptyButton: {
    backgroundColor: "#176b3a",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },

  emptyButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  applianceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#dcebdd",
  },

  applianceTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  applianceInfo: {
    flex: 1,
    paddingRight: 10,
  },

  applianceName: {
    color: "#1e2a21",
    fontSize: 17,
    fontWeight: "900",
  },

  applianceCategory: {
    color: "#777777",
    fontSize: 11,
    marginTop: 3,
  },

  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  onBadge: {
    backgroundColor: "#e5f6e9",
  },

  offBadge: {
    backgroundColor: "#eeeeee",
  },

  statusBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },

  onBadgeText: {
    color: "#176b3a",
  },

  offBadgeText: {
    color: "#777777",
  },

  detailsRow: {
    flexDirection: "row",
    marginTop: 17,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },

  detailItem: {
    flex: 1,
  },

  detailLabel: {
    color: "#999999",
    fontSize: 9,
    fontWeight: "900",
  },

  detailValue: {
    color: "#333333",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 17,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },

  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  switchLabel: {
    color: "#555555",
    fontSize: 12,
    fontWeight: "700",
    marginRight: 8,
  },

  deleteButton: {
    minWidth: 82,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2aaaa",
    backgroundColor: "#fff4f4",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteText: {
    color: "#b33a3a",
    fontSize: 12,
    fontWeight: "900",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 22,
    paddingBottom: 35,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },

  modalTitle: {
    color: "#1e2a21",
    fontSize: 22,
    fontWeight: "900",
  },

  modalSubtitle: {
    color: "#777777",
    fontSize: 12,
    marginTop: 3,
  },

  closeButton: {
    color: "#777777",
    fontSize: 30,
    lineHeight: 30,
  },

  inputLabel: {
    color: "#444444",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 5,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#d7e2d9",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#222222",
    backgroundColor: "#f8fbf8",
    marginBottom: 13,
  },

  categoryScroll: {
    marginBottom: 16,
  },

  categoryButton: {
    borderWidth: 1,
    borderColor: "#d2ddd4",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginRight: 7,
    backgroundColor: "#ffffff",
  },

  categorySelected: {
    backgroundColor: "#176b3a",
    borderColor: "#176b3a",
  },

  categoryText: {
    color: "#666666",
    fontSize: 11,
    fontWeight: "700",
  },

  categorySelectedText: {
    color: "#ffffff",
  },

  saveButton: {
    backgroundColor: "#176b3a",
    borderRadius: 13,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },

  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  cancelButton: {
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  cancelButtonText: {
    color: "#777777",
    fontSize: 13,
    fontWeight: "700",
  },

  deleteModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  deleteModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: 24,
    backgroundColor: "#ffffff",
  },

  deleteModalMessage: {
    color: "#444444",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 4,
  },

  deleteModalActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
  },

  deleteModalButton: {
    minHeight: 46,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
  },

  deleteModalCancelButton: {
    borderWidth: 1,
    borderColor: "#dddddd",
  },

  deleteModalCancelText: {
    color: "#444444",
    fontSize: 14,
    fontWeight: "700",
  },

  deleteModalConfirmButton: {
    backgroundColor: "#b33a3a",
  },

  deleteModalConfirmText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});