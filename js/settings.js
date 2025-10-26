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
    };
    this.settings = this.loadSettings();
    this.initializeUI();
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

    localStorage.setItem("nimbus-settings", JSON.stringify(this.settings));
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
    return this.settings.showCurrentWeather == "true";
  }

  initializeUI() {
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

    weatherProvider.value = this.settings.weatherProvider;
    owmApiToken.value = this.settings.owmApiToken;
    dmiApiToken.value = this.settings.dmiApiToken;
    tempUnit.value = this.settings.tempUnit;
    windUnit.value = this.settings.windUnit;
    showWindGusts.value = this.settings.showWindGusts;
    showCurrentWeather.value = this.settings.showCurrentWeather;
    locationCacheMinutes.value = this.settings.locationCacheMinutes;
    owmForecastType.value = this.settings.owmForecastType;

    // Show/hide API token field based on provider
    this.toggleFields(this.settings.weatherProvider);

    // Listen for provider changes
    weatherProvider.addEventListener("change", (e) => {
      this.toggleFields(e.target.value);
    });
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
