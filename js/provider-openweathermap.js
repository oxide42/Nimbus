class OpenWeatherMapProvider extends Provider {
  async fetchWeatherData(latitude, longitude, forecastType) {
    if (!this.settings.settings.owmApiToken) {
      throw new Error(
        "Please configure your OpenWeatherMap API token in Settings. Get one free at https://openweathermap.org/api",
      );
    }

    let exclude;
    let endpoint;
    switch (forecastType) {
      case "daily":
        exclude = `current,minutely,hourly`;
        endpoint = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&exclude=${exclude}&appid=${this.settings.settings.owmApiToken}&units=metric`;
        break;
      case "hourly":
        exclude = `daily,minutely,current`;
        endpoint = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&exclude=${exclude}&appid=${this.settings.settings.owmApiToken}&units=metric`;
        break;
      case "3-hourly":
        endpoint = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&exclude=${exclude}&appid=${this.settings.settings.owmApiToken}&units=metric`;
        break;
    }

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.statusText}`);
    }

    const data = await response.json();

    return data;
  }

  processWeatherData(data, forecastType) {
    let processedData;

    if (forecastType === "daily") {
      processedData = data.daily.map((item) => ({
        time: new Date(item.dt * 1000),
        temperature: this.settings.convertTemperature(item.temp.day),
        tempMin: this.settings.convertTemperature(item.temp.min),
        tempMax: this.settings.convertTemperature(item.temp.max),
        precipitation: item.rain ? item.rain : 0,
        precipitationProb: item.pop ? Math.round(item.pop * 100) : 0,
        windSpeed: this.settings.convertWindSpeed(item.wind_speed),
        clouds: item.clouds,
        sunHours: Math.max(0, 100 - item.clouds),
      }));
    } else if (forecastType === "hourly") {
      processedData = data.hourly.map((item) => ({
        time: new Date(item.dt * 1000),
        temperature: this.settings.convertTemperature(item.temp),
        tempMin: this.settings.convertTemperature(item.temp),
        tempMax: this.settings.convertTemperature(item.temp),
        precipitation: item.rain ? item.rain["1h"] || 0 : 0,
        precipitationProb: item.pop ? Math.round(item.pop * 100) : 0,
        windSpeed: this.settings.convertWindSpeed(item.wind_speed),
        clouds: item.clouds,
        sunHours: Math.max(0, 100 - item.clouds),
      }));
    } else if (forecastType === "3-hourly") {
      processedData = data.list.map((item) => ({
        time: new Date(item.dt * 1000),
        temperature: this.settings.convertTemperature(item.main["temp"]),
        tempMin: this.settings.convertTemperature(item.main["temp_min"]),
        tempMax: this.settings.convertTemperature(item.main["temp_max"]),
        precipitation: item.rain ? item.rain["3h"] || 0 : 0,
        precipitationProb: item.pop ? Math.round(item.pop * 100) : 0,
        windSpeed: this.settings.convertWindSpeed(item.wind["speed"]),
        windGust: this.settings.convertWindSpeed(item.wind["gust"]),
        windDegree: this.settings.convertWindSpeed(item.wind["deg"]),
        clouds: item.clouds["all"],
        sunHours: Math.max(0, 100 - item.clouds["all"]),
      }));
    } else throw new Error(`Unknown forecast type: ${forecastType}`);

    const alerts = data.alerts
      ? data.alerts.map((item) => ({
          start: new Date(item.start * 1000),
          end: new Date(item.end * 1000),
          sender_name: item.sender_name,
          event: item.event,
          description: item.description,
          tags: item.tags || [],
        }))
      : [];

    return {
      data: processedData,
      alerts: alerts,
    };
  }
}
