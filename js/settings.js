class Settings {
  constructor() {
    this.defaultSettings = {
      weatherProvider: "openmeteo",
      owmApiToken: "",
      dmiApiToken: "",
      tempUnit: "celsius",
      windUnit: "ms",
      showWindGusts: false,
      showCurrentWeather: true,
      locationCacheMinutes: 15,
      owmForecastType: "3-hourly",
      language: null, // null means auto-detect from browser
      darkMode: false,
    };
    this.settings = this.loadSettings();
    this.i18n = null;
    this.applyDarkMode();
  }

  loadSettings() {
    const saved = localStorage.getItem("nimbus-settings");
    return saved
      ? { ...this.defaultSettings, ...JSON.parse(saved) }
      : this.defaultSettings;
  }

  saveSettings() {
    this.settings.weatherProvider = weatherProvider.value;
    this.settings.owmApiToken = owmApiToken.value;
    this.settings.dmiApiToken = dmiApiToken.value;
    this.settings.tempUnit = tempUnit.value;
    this.settings.windUnit = windUnit.value;
    this.settings.showWindGusts = showWindGusts.value;
    this.settings.showCurrentWeather = showCurrentWeather.value;
    this.settings.locationCacheMinutes =
      parseInt(locationCacheMinutes.value) || 30;
    this.settings.owmForecastType = owmForecastType.value;
    this.settings.language = languageSelect.value;
    this.settings.darkMode = darkMode.value;

    localStorage.setItem("nimbus-settings", JSON.stringify(this.settings));
    this.applyDarkMode();
  }

  getDarkMode() {
    return this.settings.darkMode === "true" || this.settings.darkMode === true;
  }

  applyDarkMode() {
    if (this.getDarkMode()) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }

  getForecastType() {
    if (this.settings.weatherProvider === "openweathermap")
      return this.settings.owmForecastType;
    if (this.settings.weatherProvider === "dmi") return "hourly";
    if (this.settings.weatherProvider === "openmeteo") return "hourly";

    throw new Error(`Unknown provider: ${this.settings.weatherProvider}`);
  }

  getShowWindGusts() {
    return this.settings.showWindGusts == "true";
  }

  getShowCurrentWeather() {
    return this.settings.showCurrentWeather != "false";
  }

  async initializeUI(i18n) {
    this.i18n = i18n;

    const weatherProvider = document.getElementById("weatherProvider");
    const owmApiToken = document.getElementById("owmApiToken");
    const owmForecastType = document.getElementById("owmForecastType");
    const dmiApiToken = document.getElementById("dmiApiToken");
    const tempUnit = document.getElementById("tempUnit");
    const windUnit = document.getElementById("windUnit");
    const showWindGusts = document.getElementById("showWindGusts");
    const showCurrentWeather = document.getElementById("showCurrentWeather");
    const locationCacheMinutes = document.getElementById(
      "locationCacheMinutes",
    );
    const languageSelect = document.getElementById("languageSelect");
    const darkMode = document.getElementById("darkMode");

    weatherProvider.value = this.settings.weatherProvider;
    owmApiToken.value = this.settings.owmApiToken;
    dmiApiToken.value = this.settings.dmiApiToken;
    tempUnit.value = this.settings.tempUnit;
    windUnit.value = this.settings.windUnit;
    showWindGusts.value = this.settings.showWindGusts;
    showCurrentWeather.value = this.settings.showCurrentWeather;
    locationCacheMinutes.value = this.settings.locationCacheMinutes;
    owmForecastType.value = this.settings.owmForecastType;
    languageSelect.value = this.settings.language || i18n.getCurrentLanguage();
    darkMode.value = this.settings.darkMode;

    // Update all text with translations
    this.updateUIText();

    // Show/hide API token field based on provider
    this.toggleFields(this.settings.weatherProvider);

    // Listen for provider changes
    weatherProvider.addEventListener("change", (e) => {
      this.toggleFields(e.target.value);
    });

    // Listen for language changes
    languageSelect.addEventListener("change", async (e) => {
      await i18n.loadLanguage(e.target.value);
      this.updateUIText();
      // Notify app to reload
      if (window.weatherApp) {
        window.weatherApp.updateAllText();
      }
    });
  }

  updateUIText() {
    if (!this.i18n) return;

    const t = this.i18n.t.bind(this.i18n);

    // Update page title
    document.querySelector(".nav-title h1").textContent = t("app.title");

    // Update settings page
    document.querySelector("#settingsPage h2").textContent =
      t("settings.title");

    // Update labels
    this.updateLabel("weatherProvider", t("settings.weatherProvider"));
    this.updateLabel("owmApiToken", t("settings.owmApiToken"));
    this.updateLabel("owmForecastType", t("settings.owmForecastType"));
    this.updateLabel("dmiApiToken", t("settings.dmiApiToken"));
    this.updateLabel("tempUnit", t("settings.tempUnit"));
    this.updateLabel("windUnit", t("settings.windUnit"));
    this.updateLabel("showWindGusts", t("settings.showWindGusts"));
    this.updateLabel("showCurrentWeather", t("settings.showCurrentWeather"));
    this.updateLabel(
      "locationCacheMinutes",
      t("settings.locationCacheMinutes"),
    );
    this.updateLabel("languageSelect", t("settings.language"));
    this.updateLabel("darkMode", t("settings.darkMode"));

    // Update placeholders
    document.getElementById("owmApiToken").placeholder = t(
      "settings.owmApiTokenPlaceholder",
    );
    document.getElementById("dmiApiToken").placeholder = t(
      "settings.dmiApiTokenPlaceholder",
    );

    // Update select options
    this.updateSelectOptions("weatherProvider", {
      openweathermap: t("providers.openweathermap"),
      openmeteo: t("providers.openmeteo"),
      dmi: t("providers.dmi"),
    });

    this.updateSelectOptions("owmForecastType", {
      hourly: t("forecast.hourly"),
      "3-hourly": t("forecast.threeHourly"),
      daily: t("forecast.daily"),
    });

    this.updateSelectOptions("tempUnit", {
      celsius: t("units.celsius"),
      fahrenheit: t("units.fahrenheit"),
    });

    this.updateSelectOptions("windUnit", {
      ms: t("units.ms"),
      kmh: t("units.kmh"),
      mph: t("units.mph"),
      knots: t("units.knots"),
    });

    this.updateSelectOptions("showWindGusts", {
      true: t("settings.yes"),
      false: t("settings.no"),
    });

    this.updateSelectOptions("showCurrentWeather", {
      true: t("settings.yes"),
      false: t("settings.no"),
    });

    this.updateSelectOptions("darkMode", {
      true: t("settings.on"),
      false: t("settings.off"),
    });
  }

  updateLabel(forId, text) {
    const label = document.querySelector(`label[for="${forId}"]`);
    if (label) {
      label.textContent = text + ":";
    }
  }

  updateSelectOptions(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue = select.value;
    Array.from(select.options).forEach((option) => {
      if (options[option.value]) {
        option.textContent = options[option.value];
      }
    });
    select.value = currentValue;
  }

  toggleFields(provider) {
    owmGroup.style.display = "none";
    dmiGroup.style.display = "none";

    // Show appropriate fields based on provider
    if (provider === "openweathermap") {
      owmGroup.style.display = "block";
    } else if (provider === "dmi") {
      dmiGroup.style.display = "block";
    } else if (provider === "openmeteo") {
      // Open-Meteo doesn't require API token
    }
  }

  convertTemperature(celsius) {
    if (this.settings.tempUnit === "fahrenheit") {
      return (celsius * 9) / 5 + 32;
    }
    return celsius;
  }

  convertWindSpeed(ms) {
    switch (this.settings.windUnit) {
      case "kmh":
        return ms * 3.6;
      case "mph":
        return ms * 2.237;
      case "knots":
        return ms * 1.944;
      default:
        return ms;
    }
  }

  getTemperatureUnit() {
    return this.settings.tempUnit === "fahrenheit" ? "°F" : "°C";
  }

  getWindSpeedUnit() {
    switch (this.settings.windUnit) {
      case "kmh":
        return "km/h";
      case "mph":
        return "mph";
      case "knots":
        return "knots";
      default:
        return "m/s";
    }
  }
}
