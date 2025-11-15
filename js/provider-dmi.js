class DmiProvider extends Provider {
  async fetchWeatherData(latitude, longitude, forecastType) {
    const apiToken = this.settings.settings.dmiApiToken;
    if (!this.settings.settings.dmiApiToken) {
      throw new Error(
        "Please configure your DMI API token in Settings. Get one free at https://opendatadocs.dmi.govcloud.dk/Authentication#h-1-register-as-a-user",
      );
    }

    let endpoint;
    let configuration =
      "wind-speed,temperature-2m,wind-dir-10m,cloud-transmittance,total-precipitation";

    endpoint = `https://dmigw.govcloud.dk/v1/forecastedr/collections/harmonie_dini_sf/position?coords=POINT(${longitude} ${latitude})&crs=crs84&f=GeoJSON&parameter-name=${configuration}&api-key=${apiToken}`;

    try {
      const headers = {
        Accept: "application/json",
        "User-Agent": "Nimbus weather/1.0",
      };

      const response = await fetch(endpoint, { headers });

      if (!response.ok) {
        throw new Error(`DMI API error: ${response.statusText}`);
      }

      const data = await response.json();

      return data;
    } catch (error) {
      throw new Error("DMI API not available", error.message);
    }
  }

  processWeatherData(data, forecastType) {
    let processedData = [];

    if (data.features && data.features.length > 0) {
      processedData = data.features.map((item) => {
        const properties = item.properties;
        return {
          time: new Date(properties.step),
          temperature: ConvertService.toCelsius(
            properties["temperature-2m"],
            "kelvin",
          ),
          precipitation: properties["total-precipitation"],
          precipitationProb: null,
          windSpeed: properties["wind-speed"],
          clouds: 100 * Math.max(0, 1 - properties["cloud-transmittance"]),
          sunHours: 100 * properties["cloud-transmittance"],
        };
      });
    }

    processedData.alerts = [];

    return processedData;
  }

  // DMI provider information
  static getProviderInfo() {
    return {
      name: "DMI (Danmarks Meteorologiske Institut)",
      description: "Official Danish weather service",
      website: "https://www.dmi.dk/",
      requiresApiKey: true, // API token can be used for enhanced access
      dataSource: "DMI Open Data API",
    };
  }
}
