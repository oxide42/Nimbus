class OpenMeteoProvider extends Provider {
  async fetchWeatherData(latitude, longitude, forecastType) {
    try {
      const headers = {
        Accept: "application/json",
        "User-Agent": "Nimbus Weather/1.0",
      };

      const params = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,
        hourly: [
          "temperature_2m",
          "precipitation",
          "wind_speed_10m",
          "wind_gusts_10m",
          "relative_humidity_2m",
          "cloud_cover",
        ],
      });

      const url = `https://api.open-meteo.com/v1/forecast?${params}`;

      const response = await fetch(url, {
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.statusText}`);
      }

      const data = await response.json();

      return data;
    } catch (error) {
      throw new Error("Open-Meteo API not available", error.message);
    }
  }

  processWeatherData(data, forecastType) {
    let processedData = [];

    if (data.hourly && data.hourly.time) {
      processedData = data.hourly.time.map((time, index) => {
        if (time < new Date().toISOString()) return null;

        const temp = data.hourly.temperature_2m[index];
        const precip = data.hourly.precipitation?.[index] || 0;
        const windSpeed = data.hourly.wind_speed_10m?.[index] / 3.6 || 0;
        const windGusts = data.hourly.wind_gusts_10m?.[index] / 3.6 || 0;
        const cloudCover = data.hourly.cloud_cover?.[index] || 0;
        const humidity = data.hourly.relative_humidity_2m?.[index] || 0;

        return {
          time: new Date(time),
          temperature: temp,
          tempMin: temp,
          tempMax: temp,
          precipitation: precip,
          precipitationProb: 0,
          windSpeed: windSpeed,
          windGusts: windGusts,
          clouds: cloudCover,
          sunHours: Math.max(0, 100 - cloudCover),
          humidity: humidity,
        };
      });
    }

    // Delete null values
    processedData = processedData.filter((item) => item !== null);

    return {
      data: processedData,
      alerts: [],
    };
  }

  // Open-Meteo provider information
  static getProviderInfo() {
    return {
      name: "Open-Meteo",
      description: "Open source weather data",
      website: "https://open-meteo.com",
      requiresApiKey: false,
      dataSource: "Open-Meteo Open Data API",
    };
  }
}
