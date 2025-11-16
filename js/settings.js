class Settings {
  constructor() {
    this.defaultSettings = {
      weatherProvider: "openmeteo",
      owmApiToken: "",
      dmiApiToken: "",
      openMeteoModel: "auto",
      tempUnit: "celsius",
      windUnit: "ms",
      showWindGusts: false,
      showCurrentWeather: true,
      showApparentTemperature: false,
      locationCacheMinutes: 15,
      owmForecastType: "3-hourly",
      language: null, // null means auto-detect from browser
      darkMode: false,
      defaultZoom: "3days",
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
    this.settings.openMeteoModel = openMeteoModel.value;
    this.settings.tempUnit = tempUnit.value;
    this.settings.windUnit = windUnit.value;
    this.settings.showWindGusts = showWindGusts.value;
    this.settings.showCurrentWeather = showCurrentWeather.value;
    this.settings.showApparentTemperature = showApparentTemperature.value;
    this.settings.locationCacheMinutes =
      parseInt(locationCacheMinutes.value) || 30;
    this.settings.owmForecastType = owmForecastType.value;
    this.settings.language = languageSelect.value;
    this.settings.darkMode = darkMode.value;
    this.settings.defaultZoom = defaultZoom.value;

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

  getDefaultZoom() {
    return this.settings.defaultZoom || "3days";
  }

  getShowApparentTemperature() {
    return (
      this.settings.showApparentTemperature == "true" ||
      this.settings.showApparentTemperature === true
    );
  }

  async initializeUI(i18n) {
    this.i18n = i18n;

    const weatherProvider = document.getElementById("weatherProvider");
    const owmApiToken = document.getElementById("owmApiToken");
    const owmForecastType = document.getElementById("owmForecastType");
    const dmiApiToken = document.getElementById("dmiApiToken");
    const openMeteoModel = document.getElementById("openMeteoModel");
    const tempUnit = document.getElementById("tempUnit");
    const windUnit = document.getElementById("windUnit");
    const showWindGusts = document.getElementById("showWindGusts");
    const showCurrentWeather = document.getElementById("showCurrentWeather");
    const showApparentTemperature = document.getElementById(
      "showApparentTemperature",
    );
    const locationCacheMinutes = document.getElementById(
      "locationCacheMinutes",
    );
    const languageSelect = document.getElementById("languageSelect");
    const darkMode = document.getElementById("darkMode");
    const defaultZoom = document.getElementById("defaultZoom");

    weatherProvider.value = this.settings.weatherProvider;
    owmApiToken.value = this.settings.owmApiToken;
    dmiApiToken.value = this.settings.dmiApiToken;
    openMeteoModel.value = this.settings.openMeteoModel;
    tempUnit.value = this.settings.tempUnit;
    windUnit.value = this.settings.windUnit;
    showWindGusts.value = this.settings.showWindGusts;
    showCurrentWeather.value = this.settings.showCurrentWeather;
    showApparentTemperature.value = this.settings.showApparentTemperature;
    locationCacheMinutes.value = this.settings.locationCacheMinutes;
    owmForecastType.value = this.settings.owmForecastType;
    languageSelect.value = this.settings.language || i18n.getCurrentLanguage();
    darkMode.value = this.settings.darkMode;
    defaultZoom.value = this.settings.defaultZoom;

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

    // Update section headers
    const sections = document.querySelectorAll(".settings-column h3");
    if (sections.length >= 4) {
      sections[0].textContent = t("settings.sectionWeatherProvider");
      sections[1].textContent = t("settings.sectionUnits");
      sections[2].textContent = t("settings.sectionDisplayOptions");
      sections[3].textContent = t("settings.sectionPreferences");
    }

    // Update labels
    this.updateLabel("weatherProvider", t("settings.weatherProvider"));
    this.updateLabel("owmApiToken", t("settings.owmApiToken"));
    this.updateLabel("owmForecastType", t("settings.owmForecastType"));
    this.updateLabel("dmiApiToken", t("settings.dmiApiToken"));
    this.updateLabel("openMeteoModel", t("settings.openMeteoModel"));
    this.updateLabel("tempUnit", t("settings.tempUnit"));
    this.updateLabel("windUnit", t("settings.windUnit"));
    this.updateLabel("showWindGusts", t("settings.showWindGusts"));
    this.updateLabel("showCurrentWeather", t("settings.showCurrentWeather"));
    this.updateLabel(
      "showApparentTemperature",
      t("settings.showApparentTemperature"),
    );
    this.updateLabel(
      "locationCacheMinutes",
      t("settings.locationCacheMinutes"),
    );
    this.updateLabel("languageSelect", t("settings.language"));
    this.updateLabel("darkMode", t("settings.darkMode"));
    this.updateLabel("defaultZoom", t("zoom.defaultZoom"));

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

    this.updateSelectOptions("showApparentTemperature", {
      true: t("settings.yes"),
      false: t("settings.no"),
    });

    this.updateSelectOptions("darkMode", {
      true: t("settings.on"),
      false: t("settings.off"),
    });

    this.updateSelectOptions("defaultZoom", {
      "24hours": t("zoom.next24hours"),
      "3days": t("zoom.next3days"),
      whole: t("zoom.wholePeriod"),
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
    openMeteoGroup.style.display = "none";

    // Show appropriate fields based on provider
    if (provider === "openweathermap") {
      owmGroup.style.display = "block";
    } else if (provider === "dmi") {
      dmiGroup.style.display = "block";
    } else if (provider === "openmeteo") {
      openMeteoGroup.style.display = "block";
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

  getOpenMeteoModel() {
    return this.settings.openMeteoModel || "auto";
  }
}
