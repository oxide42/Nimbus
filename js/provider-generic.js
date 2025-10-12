class Provider {
  constructor(settings) {
    this.settings = settings;
    this.cookieCache = new Cache();
  }

  async fetchWeatherData(latitude, longitude, forecastType) {
    throw new Error("Method not implemented!");
  }

  processWeatherData(data, forecastType) {
    throw new Error("Method not implemented!");
  }

  static getProviderInfo() {
    throw new Error("Method not implemented!");
  }
}
