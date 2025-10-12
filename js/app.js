class WeatherApp {
  constructor() {
    this.settings = new Settings();
    this.weatherService = new WeatherService(this.settings);
    this.locationService = new LocationService(this.settings);
    this.weatherChart = new WeatherChart(this.settings);
    this.currentForecastType = this.settings.getForecastType();
    this.initializeUI();
    this.loadWeatherData();
    this.loadLocationName();
  }

  initializeUI() {
    const settingsBtn = document.getElementById("settingsBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const mainPage = document.getElementById("mainPage");
    const settingsPage = document.getElementById("settingsPage");

    settingsBtn.addEventListener("click", () => {
      // Toggle between main and settings
      if (settingsPage.classList.contains("active")) {
        this.settings.saveSettings();
        this.showPage("main");
        location.reload();
      } else {
        this.showPage("settings");
      }
    });

    refreshBtn.addEventListener("click", () => {
      location.reload();
    });
  }

  showPage(page) {
    const settingsBtn = document.getElementById("settingsBtn");
    const mainPage = document.getElementById("mainPage");
    const settingsPage = document.getElementById("settingsPage");

    if (page === "main") {
      settingsBtn.classList.remove("active");
      mainPage.classList.add("active");
      settingsPage.classList.remove("active");
    } else {
      settingsBtn.classList.add("active");
      mainPage.classList.remove("active");
      settingsPage.classList.add("active");
    }
  }

  async loadWeatherData() {
    const chartContainer = document.getElementById("chartContainer");
    chartContainer.innerHTML =
      '<div class="loading">Loading weather data...</div>';

    try {
      const result = await this.weatherService.fetchWeatherData(
        this.currentForecastType,
      );
      chartContainer.innerHTML = "";
      this.weatherChart.createChart(result.data);
      this.displayAlerts(result.alerts || []);
    } catch (error) {
      chartContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
  }

  formatAlertDate(date) {
    const d = new Date(date);
    return d
      .toLocaleString("da-DK", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(",", " kl.");
  }

  displayAlerts(alerts) {
    const alertsContainer = document.getElementById("alertsContainer");

    if (!alerts || alerts.length === 0) {
      alertsContainer.classList.add("hidden");
      alertsContainer.innerHTML = "";
      return;
    }

    alertsContainer.classList.remove("hidden");
    alertsContainer.innerHTML = alerts
      .map((alert) => {
        const startDate = this.formatAlertDate(alert.start);
        const endDate = this.formatAlertDate(alert.end);
        const isSevere =
          alert.tags &&
          (alert.tags.includes("Extreme") || alert.tags.includes("Severe"));

        return `
        <div class="alert-item${isSevere ? " severe" : ""}">
          <div class="alert-header">
            <div>
              <div class="alert-event">${alert.event || "Weather Alert"}</div>
              ${alert.sender_name ? `<div class="alert-sender">${alert.sender_name}</div>` : ""}
            </div>
            <div class="alert-time">
              ${startDate} - ${endDate}
            </div>
          </div>
          <div class="alert-description">${alert.description}</div>
          ${
            alert.tags && alert.tags.length > 0
              ? `
            <div class="alert-tags">
              ${alert.tags.map((tag) => `<span class="alert-tag">${tag}</span>`).join("")}
            </div>
          `
              : ""
          }
        </div>
      `;
      })
      .join("");
  }

  async loadLocationName() {
    try {
      const locationService = this.locationService;
      const position = await locationService.getCurrentPosition();
      const placeName = await locationService.getCurrentPlaceName(
        position.coords.latitude,
        position.coords.longitude,
      );

      document.getElementById("locationName").textContent = placeName;
    } catch (error) {
      console.error("Error loading location name:", error);
      document.getElementById("locationName").textContent =
        "Location unavailable";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new WeatherApp();
});
