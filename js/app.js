class WeatherApp {
  constructor() {
    this.settings = new Settings();
    this.i18n = new I18n();
    this.init();
  }

  async init() {
    // Initialize i18n first
    await this.i18n.init(this.settings);

    // Initialize settings UI with i18n
    await this.settings.initializeUI(this.i18n);

    // Initialize services
    this.weatherService = new WeatherService(this.settings);
    this.locationService = new LocationService(this.settings);
    this.weatherChart = new WeatherChart(this.settings);
    this.currentForecastType = this.settings.getForecastType();

    // Initialize UI and load data
    this.initializeUI();
    this.updateAllText();
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

  updateAllText() {
    const t = this.i18n.t.bind(this.i18n);

    // Update location loading text
    const locationName = document.getElementById("locationName");
    if (locationName.textContent === "Loading location...") {
      locationName.textContent = t("app.loading");
    }
  }

  async loadWeatherData() {
    const t = this.i18n.t.bind(this.i18n);
    const chartContainer = document.getElementById("chartContainer");
    chartContainer.innerHTML = `<div class="loading">${t("app.loadingWeather")}</div>`;

    try {
      const result = await this.weatherService.fetchWeatherData(
        this.currentForecastType,
      );
      chartContainer.innerHTML = "";
      this.weatherChart.createChart(result.data);
      this.displayCurrentWeather(result.data);
      this.displayAlerts(result.alerts || []);
    } catch (error) {
      chartContainer.innerHTML = `<div class="error">${t("app.error", { message: error.message })}</div>`;
    }
  }

  displayCurrentWeather(weatherData) {
    const t = this.i18n.t.bind(this.i18n);
    const container = document.getElementById("currentWeatherContainer");

    if (!this.settings.getShowCurrentWeather()) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    container.classList.remove("hidden");

    // Get the first data point (current weather)
    const current = weatherData[0];

    if (!current) {
      container.classList.add("hidden");
      return;
    }

    const temp = Math.round(current.temperature);
    const feelsLike = Math.round(current.temperature); // You can add feels-like calculation if available
    const precipitation = current.precipitation
      ? current.precipitation.toFixed(1)
      : "0.0";
    const precipProb = current.precipitationProb
      ? Math.round(current.precipitationProb)
      : 0;
    const windSpeed = Math.round(current.windSpeed);
    const windGusts = current.windGusts
      ? Math.round(current.windGusts)
      : windSpeed;
    const sunHours = current.sunHours ? current.sunHours.toFixed(0) : "0";

    container.innerHTML = `
      <div class="current-weather-grid">
        <div class="current-weather-main">
          <div class="current-temp">${temp}${this.settings.getTemperatureUnit()}</div>
          <div class="current-details">
            <div class="current-condition">Now</div>
            <div class="current-feels-like">${t("currentWeather.feelsLike")} ${feelsLike}${this.settings.getTemperatureUnit()}</div>
          </div>
        </div>
        <div class="current-weather-stats">
          <div class="weather-stat">
            <div class="weather-stat-label">${t("currentWeather.precipitation")}</div>
            <div class="weather-stat-value">${precipitation} mm (${precipProb}%)</div>
          </div>
          <div class="weather-stat">
            <div class="weather-stat-label">${t("currentWeather.sun")}</div>
            <div class="weather-stat-value">${sunHours}%</div>
          </div>
          <div class="weather-stat">
            <div class="weather-stat-label">${t("currentWeather.wind")}</div>
            <div class="weather-stat-value">${windSpeed} ${this.settings.getWindSpeedUnit()}</div>
          </div>
          <div class="weather-stat">
            <div class="weather-stat-label">${t("currentWeather.gusts")}</div>
            <div class="weather-stat-value">${windGusts} ${this.settings.getWindSpeedUnit()}</div>
          </div>
        </div>
      </div>
    `;
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
    const t = this.i18n.t.bind(this.i18n);
    const alertsContainer = document.getElementById("alertsContainer");

    if (!alerts || alerts.length === 0) {
      alertsContainer.classList.add("hidden");
      alertsContainer.innerHTML = "";
      return;
    }

    alertsContainer.classList.remove("hidden");

    const alertsTitle = `<h3>${t("alerts.title")}</h3>`;
    alertsContainer.innerHTML =
      alertsTitle +
      alerts
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
  window.weatherApp = new WeatherApp();
});
