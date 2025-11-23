class Provider {
  constructor(settings) {
    this.settings = settings;
    this.cache = Cache.getInstance();
  }

  async fetchWeatherData(latitude, longitude, forecastType) {
    throw new Error("Method not implemented!");
  }

  processWeatherData(data, forecastType) {
    throw new Error("Method not implemented!");
  }

  getDisplayName() {
    throw new Error("Method not implemented!");
  }
}
