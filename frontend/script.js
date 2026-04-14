const GET_API_URL = "https://dpn4u69wn0.execute-api.us-east-1.amazonaws.com/energy-readings";
const POST_API_URL = "https://dpn4u69wn0.execute-api.us-east-1.amazonaws.com/process-energy";
const SUBSCRIBE_API_URL = "https://dpn4u69wn0.execute-api.us-east-1.amazonaws.com/subscribe";

const totalRequestsEl = document.getElementById("totalRequests");
const lastConsumptionEl = document.getElementById("lastConsumption");
const riskLevelEl = document.getElementById("riskLevel");
const resultMessageEl = document.getElementById("resultMessage");
const statusBadgeEl = document.getElementById("statusBadge");
const statusAlertEl = document.getElementById("statusAlert");
const riskIndicatorEl = document.getElementById("riskIndicator");
const tableBodyEl = document.getElementById("tableBody");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const pageLoaderEl = document.getElementById("pageLoader");
const energyLineChartEl = document.getElementById("energyLineChart");
const riskBarChartEl = document.getElementById("riskBarChart");
const alertCountEl = document.getElementById("alertCount");
const latestAlertLevelEl = document.getElementById("latestAlertLevel");
const alertFeedEl = document.getElementById("alertFeed");

let currentRecords = [];
let energyLineChart = null;
let riskBarChart = null;

hydrateTokenFromUrl();
highlightActiveNavigation();
attachEventListeners();
bootPage();
initializePage();

function bootPage() {
    window.addEventListener("load", () => {
        if (!pageLoaderEl) return;

        setTimeout(() => {
            pageLoaderEl.classList.add("is-hidden");
        }, 320);
    });

    setInterval(() => {
        loadDashboardData();
    }, 5000);
}

function hydrateTokenFromUrl() {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const token = params.get("id_token") || params.get("access_token");

    if (token) {
        localStorage.setItem("token", token);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function highlightActiveNavigation() {
    const currentPage = document.body.dataset.page;
    const navLinks = document.querySelectorAll(".sidebar a[data-nav]");

    navLinks.forEach((link) => {
        link.classList.toggle("active", link.dataset.nav === currentPage);
    });
}

function attachEventListeners() {
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", exportDataAsCsv);
    }
}

async function initializePage() {
    if (tableBodyEl) {
        renderEmptyState("Loading data...");
    }

    setStatus("loading", "Loading", "Loading data...");
    await loadDashboardData();
}

function getAuthToken() {
    return localStorage.getItem("token");
}

function setStatus(state, title, message) {
    if (!statusBadgeEl || !statusAlertEl || !resultMessageEl) {
        return;
    }

    const normalizedState = ["idle", "loading", "success", "error"].includes(state) ? state : "idle";

    statusBadgeEl.className = `status-chip status-chip--${normalizedState}`;
    statusBadgeEl.textContent = normalizedState.charAt(0).toUpperCase() + normalizedState.slice(1);

    statusAlertEl.className = `status-alert status-alert--${normalizedState}`;

    const titleEl = statusAlertEl.querySelector(".status-alert__title");
    if (titleEl) {
        titleEl.textContent = title;
    }

    resultMessageEl.textContent = message;
}

function updateRiskDisplay(riskLevel) {
    if (!riskLevelEl || !riskIndicatorEl) {
        return;
    }

    const normalizedRisk = riskLevel === "HIGH" ? "HIGH" : riskLevel === "NORMAL" ? "NORMAL" : "Waiting";
    const valueClass = normalizedRisk === "HIGH"
        ? "metric-value metric-value--high"
        : normalizedRisk === "NORMAL"
            ? "metric-value metric-value--normal"
            : "metric-value metric-value--neutral";
    const indicatorClass = normalizedRisk === "HIGH"
        ? "metric-indicator metric-indicator--danger"
        : normalizedRisk === "NORMAL"
            ? "metric-indicator metric-indicator--good"
            : "metric-indicator metric-indicator--neutral";

    riskLevelEl.textContent = normalizedRisk;
    riskLevelEl.className = valueClass;
    riskIndicatorEl.className = indicatorClass;
}

function updateSummaryCards(records, latestRecord) {
    if (totalRequestsEl) {
        totalRequestsEl.textContent = String(records.length);
    }

    if (!latestRecord) {
        if (lastConsumptionEl) {
            lastConsumptionEl.textContent = "--";
        }
        updateRiskDisplay(null);
        return;
    }

    if (lastConsumptionEl) {
        lastConsumptionEl.textContent = `${latestRecord.consumptionValue} kWh`;
    }

    updateRiskDisplay(latestRecord.riskLevel);
}

function getRiskLevel(record, consumptionValue) {
    const rawRisk = record?.riskLevel ?? record?.risk_level ?? record?.risk ?? record?.level;

    if (typeof rawRisk === "string" && rawRisk.trim()) {
        return rawRisk.trim().toUpperCase();
    }

    const movingAverage = Number(
        record?.movingAverage ??
        record?.moving_average ??
        record?.average ??
        record?.avg ??
        0
    );

    if (movingAverage > 0 && consumptionValue > movingAverage * 1.5) {
        return "HIGH";
    }

    return "NORMAL";
}

function getAnomalyFlag(record, riskLevel) {
    const rawAnomaly = record?.anomalyDetected ?? record?.anomaly ?? record?.isAnomaly ?? record?.is_anomaly;

    if (typeof rawAnomaly === "boolean") {
        return rawAnomaly;
    }

    if (typeof rawAnomaly === "string") {
        return ["true", "yes", "anomaly", "high"].includes(rawAnomaly.trim().toLowerCase());
    }

    return riskLevel === "HIGH";
}

function normalizeRecord(record) {
    const consumptionValue = Number(
        record?.consumptionValue ??
        record?.consumption_value ??
        record?.consumption ??
        0
    );
    const riskLevel = getRiskLevel(record, consumptionValue);

    return {
        meterId: record?.meterId ?? record?.meter_id ?? "meter-1",
        consumptionValue,
        anomalyDetected: getAnomalyFlag(record, riskLevel),
        riskLevel,
        timestamp: getTimestamp(record),
        rawTimestamp: record?.timestamp ?? record?.createdAt ?? record?.created_at ?? record?.time ?? record?.date ?? ""
    };
}

function getTimestamp(record) {
    const rawTimestamp = record?.timestamp ?? record?.createdAt ?? record?.created_at ?? record?.time ?? record?.date;

    if (!rawTimestamp) {
        return null;
    }

    const parsedTimestamp = new Date(rawTimestamp).getTime();
    return Number.isNaN(parsedTimestamp) ? null : parsedTimestamp;
}

function sortRecordsLatestFirst(records) {
    const normalizedRecords = records.map(normalizeRecord);
    const hasTimestamps = normalizedRecords.some((record) => record.timestamp !== null);

    if (!hasTimestamps) {
        return normalizedRecords.reverse();
    }

    return normalizedRecords.sort((left, right) => {
        const leftTime = left.timestamp ?? 0;
        const rightTime = right.timestamp ?? 0;
        return rightTime - leftTime;
    });
}

function renderTable(records) {
    if (!tableBodyEl) {
        return;
    }

    if (!records.length) {
        renderEmptyState("No data available. Start sending energy readings.");
        return;
    }

    tableBodyEl.innerHTML = records.map((record) => `
        <tr>
            <td>${record.meterId}</td>
            <td>${record.consumptionValue} kWh</td>
            <td class="${record.anomalyDetected ? "anomaly-yes" : "anomaly-no"}">
                ${record.anomalyDetected ? "YES" : "NO"}
            </td>
            <td>
                <span class="risk-pill ${record.riskLevel === "HIGH" ? "high" : "normal"}">
                    ${record.riskLevel}
                </span>
            </td>
            <td>
                <button class="btn btn-primary" onclick="updateRecord('${record.meterId}', '${record.rawTimestamp}', '${record.consumptionValue}')">
                    Update
                </button>
                <button class="btn btn-danger" onclick="deleteRecord('${record.meterId}', '${record.rawTimestamp}')">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");
}

function renderEmptyState(message) {
    if (!tableBodyEl) {
        return;
    }

    tableBodyEl.innerHTML = `
        <tr class="empty-row">
            <td colspan="5">
                <div class="empty-state">
                    <p class="empty-state__title">${message}</p>
                    <p class="empty-state__text">Send energy data to populate the table.</p>
                </div>
            </td>
        </tr>
    `;
}

async function fetchJson(url, options = {}) {
    const token = getAuthToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });

    const responseText = await response.text();
    let data = {};

    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
        data = { rawResponse: responseText };
    }

    if (!response.ok) {
        const errorMessage = data?.message || data?.error || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
    }

    return data;
}

function extractRecords(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    if (typeof payload?.body === "string") {
        try {
            return extractRecords(JSON.parse(payload.body));
        } catch (parseError) {
            return [];
        }
    }

    return [];
}

function calculateMovingAverage(data, windowSize) {
    return data.map((_, index) => {
        const startIndex = Math.max(0, index - windowSize + 1);
        const window = data.slice(startIndex, index + 1);
        const sum = window.reduce((total, value) => total + value, 0);
        return Number((sum / window.length).toFixed(2));
    });
}

function formatTimestampLabel(record, index) {
    if (!record.rawTimestamp) {
        return `Reading ${index + 1}`;
    }

    const date = new Date(record.rawTimestamp);

    if (Number.isNaN(date.getTime())) {
        return `Reading ${index + 1}`;
    }

    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function destroyCharts() {
    if (energyLineChart) {
        energyLineChart.destroy();
        energyLineChart = null;
    }

    if (riskBarChart) {
        riskBarChart.destroy();
        riskBarChart = null;
    }
}

function renderCharts(records) {
    destroyCharts();

    if (!window.Chart || !energyLineChartEl || !riskBarChartEl || !records.length) {
        return;
    }

    const chronologicalRecords = records.slice(0, 20).slice().reverse();
    const timestamps = chronologicalRecords.map(formatTimestampLabel);
    const consumptionValues = chronologicalRecords.map((record) => record.consumptionValue);
    const riskLevels = chronologicalRecords.map((record) => record.riskLevel);
    const movingAverage = calculateMovingAverage(consumptionValues, 5);
    const pointColors = riskLevels.map((riskLevel) => riskLevel === "HIGH" ? "#dc2626" : "#16a34a");
    const highRiskCount = riskLevels.filter((riskLevel) => riskLevel === "HIGH").length;
    const normalRiskCount = riskLevels.filter((riskLevel) => riskLevel !== "HIGH").length;

    energyLineChart = new Chart(energyLineChartEl, {
        type: "line",
        data: {
            labels: timestamps,
            datasets: [
                {
                    label: "Consumption",
                    data: consumptionValues,
                    borderColor: "#2563eb",
                    backgroundColor: "transparent",
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    pointRadius: 4,
                    borderWidth: 2,
                    tension: 0.3
                },
                {
                    label: "Moving Average",
                    data: movingAverage,
                    borderColor: "#f59e0b",
                    backgroundColor: "transparent",
                    pointRadius: 0,
                    borderWidth: 2,
                    borderDash: [6, 6],
                    tension: 0.3
                }
            ]
        },
        options: createChartOptions("Consumption (kWh)")
    });

    riskBarChart = new Chart(riskBarChartEl, {
        type: "bar",
        data: {
            labels: ["HIGH", "NORMAL"],
            datasets: [
                {
                    label: "Risk Distribution",
                    data: [highRiskCount, normalRiskCount],
                    backgroundColor: ["#dc2626", "#16a34a"],
                    borderColor: ["#dc2626", "#16a34a"],
                    borderWidth: 1
                }
            ]
        },
        options: createChartOptions("Count")
    });
}

function createChartOptions(axisTitle) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: "#cbd5e1"
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: "#cbd5e1",
                    maxRotation: 0,
                    autoSkip: true,
                    font: {
                        size: 10
                    }
                },
                grid: {
                    color: "rgba(203, 213, 225, 0.08)"
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: "#cbd5e1"
                },
                title: {
                    display: true,
                    text: axisTitle,
                    color: "#cbd5e1"
                },
                grid: {
                    color: "rgba(203, 213, 225, 0.08)"
                }
            }
        }
    };
}

function renderAlerts(records) {
    if (!alertCountEl && !latestAlertLevelEl && !alertFeedEl) {
        return;
    }

    const anomalousRecords = records.filter((record) => record.anomalyDetected || record.riskLevel === "HIGH");
    const latestAlert = anomalousRecords[0] || null;

    if (alertCountEl) {
        alertCountEl.textContent = String(anomalousRecords.length);
    }

    if (latestAlertLevelEl) {
        const latestLevel = latestAlert?.riskLevel || "Waiting";
        latestAlertLevelEl.textContent = latestLevel;
        latestAlertLevelEl.className = latestLevel === "HIGH"
            ? "metric-value metric-value--high"
            : "metric-value metric-value--neutral";
    }

    if (!alertFeedEl) {
        return;
    }

    if (!anomalousRecords.length) {
        alertFeedEl.innerHTML = `
            <div class="empty-state empty-state--block">
                <p class="empty-state__title">No alerts yet</p>
                <p class="empty-state__text">Anomalous readings will appear here automatically.</p>
            </div>
        `;
        return;
    }

    alertFeedEl.innerHTML = anomalousRecords.slice(0, 6).map((record) => `
        <article class="alert-item">
            <div>
                <p class="alert-item__title">${record.meterId} reported ${record.consumptionValue} kWh</p>
                <p class="alert-item__description">Anomaly detected: ${record.anomalyDetected ? "Yes" : "No"}</p>
                <p class="alert-item__meta">${record.rawTimestamp || "Timestamp unavailable"}</p>
            </div>
            <span class="risk-pill ${record.riskLevel === "HIGH" ? "high" : "normal"} alert-item__badge">
                ${record.riskLevel}
            </span>
        </article>
    `).join("");
}

async function loadDashboardData() {
    try {
        setStatus("loading", "Loading", "Loading data...");

        const payload = await fetchJson(GET_API_URL, { method: "GET" });
        const records = sortRecordsLatestFirst(extractRecords(payload));
        const latestRecord = records[0] || null;

        currentRecords = records;
        updateSummaryCards(records, latestRecord);
        renderTable(records);
        renderCharts(records);
        renderAlerts(records);

        if (!records.length) {
            renderEmptyState("No data available. Start sending energy readings.");
            setStatus("idle", "No Records", "No data available");
            return;
        }

        setStatus("success", "Data Loaded", "Energy readings loaded successfully.");
    } catch (error) {
        currentRecords = [];
        updateSummaryCards([], null);
        renderEmptyState("No data available. Start sending energy readings.");
        renderCharts([]);
        renderAlerts([]);
        setStatus("error", "Load Failed", error.message || "Error loading data");
    }
}

function exportDataAsCsv() {
    if (!currentRecords.length) {
        setStatus("error", "Export Failed", "No data available for export.");
        return;
    }

    const headers = ["meterId", "consumptionValue", "riskLevel", "timestamp"];
    const rows = currentRecords.map((record) => [
        record.meterId,
        record.consumptionValue,
        record.riskLevel,
        record.rawTimestamp || ""
    ]);

    const csvContent = [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "energy-data.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatus("success", "Export Complete", "CSV exported successfully.");
}

function escapeCsvValue(value) {
    const stringValue = String(value ?? "");
    const escapedValue = stringValue.replace(/"/g, "\"\"");
    return `"${escapedValue}"`;
}

async function deleteRecord(meterId, timestamp) {
    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
        await fetchJson(GET_API_URL, {
            method: "DELETE",
            body: JSON.stringify({
                meterId,
                timestamp
            })
        });

        alert("Deleted successfully");
        loadDashboardData();
    } catch (error) {
        console.error("Delete failed:", error);
        alert("Delete failed");
        setStatus("error", "Delete Failed", "Unable to delete the reading.");
    }
}

async function updateRecord(meterId, timestamp, currentValue) {
    const newValue = prompt("Enter new consumption value:", currentValue);

    if (!newValue) return;

    try {
        await fetchJson(GET_API_URL, {
            method: "PUT",
            body: JSON.stringify({
                meterId,
                timestamp,
                consumptionValue: Number(newValue)
            })
        });

        alert("Updated successfully");
        loadDashboardData();
    } catch (error) {
        console.error("Update failed:", error);
        alert("Update failed");
        setStatus("error", "Update Failed", "Unable to update the reading.");
    }
}

async function sendEnergyData() {
    const meterInputEl = document.getElementById("meterInput");
    const consumptionInputEl = document.getElementById("consumptionInput");

    if (!meterInputEl || !consumptionInputEl) return;

    const meterId = meterInputEl.value.trim();
    const consumption = consumptionInputEl.value;

    if (!meterId || !consumption) {
        alert("Please fill all fields");
        return;
    }

    try {
        setStatus("loading", "Sending...", "Submitting data");

        await fetchJson(POST_API_URL, {
            method: "POST",
            body: JSON.stringify({
                meterId,
                consumptionValue: Number(consumption)
            })
        });

        alert("Data added successfully!");
        meterInputEl.value = "";
        consumptionInputEl.value = "";
        loadDashboardData();
        setStatus("success", "Success", "Energy data submitted");
    } catch (error) {
        console.error(error);
        alert("Error sending data");
        setStatus("error", "Error", "Failed to send data");
    }
}

async function subscribeEmail() {
    const emailInputEl = document.getElementById("emailInput");

    if (!emailInputEl) return;

    const email = emailInputEl.value.trim();

    if (!email) {
        alert("Please enter a valid email");
        return;
    }

    try {
        setStatus("loading", "Subscribing...", "Registering email for alerts");

        await fetchJson(SUBSCRIBE_API_URL, {
            method: "POST",
            body: JSON.stringify({ email })
        });

        alert("Check your email to confirm subscription!");
        emailInputEl.value = "";
        setStatus("success", "Subscribed", "Email registered for alerts");
    } catch (error) {
        console.error(error);
        alert("Subscription failed");
        setStatus("error", "Error", "Failed to subscribe email");
    }
}
