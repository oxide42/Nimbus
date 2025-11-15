class WeatherService {
  constructor(settings) {
    this.settings = settings;
    this.providers = {
      openweathermap: OpenWeatherMapProvider,
      openmeteo: OpenMeteoProvider,
      dmi: DmiProvider,
    };
    this.currentProvider = this.settings.settings.weatherProvider;
    this.locationService = new LocationService(settings);
    this.sunService = new SunService();
    this.extremaService = new ExtremaService(settings);
    this.cachePrefix = "nimbus-weather-cache-";
    this.cacheVersion = "v4"; // Increment when cache structure changes (v4: fixed apparent temperature to use numeric values)
    this.temperatureService = new TemperatureService();
    this.convertService = new ConvertService();
  }

  setProvider(providerName) {
    if (!this.providers[providerName]) {
      throw new Error(`Unknown weather provider: ${providerName}`);
    }
    this.currentProvider = providerName;
  }

  getProvider() {
    const ProviderClass = this.providers[this.currentProvider];
    if (!ProviderClass) {
      throw new Error(`Unknown weather provider: ${this.currentProvider}`);
    }
    return new ProviderClass(this.settings);
  }

  /**
   * Group consecutive precipitation periods and mark the middle point with total precipitation
   * A group continues if only one period of dry weather separates it from the next precipitation
   * @param {Array} data - Weather data with precipitation values
   * @returns {Array} - Weather data with precipitation groups marked
   */
  #groupPrecipitation(data) {
    let inGroup = false;
    let groupStart = -1;
    let groupTotal = 0;
    let dryCount = 0;

    for (let i = 0; i < data.length; i++) {
      const hasPrecip = data[i].precipitation > 0;

      if (hasPrecip && !inGroup) {
        // Start new precipitation group
        inGroup = true;
        groupStart = i;
        groupTotal = data[i].precipitation;
        dryCount = 0;
      } else if (hasPrecip && inGroup) {
        // Continue current group (precipitation after 0 or 1 dry periods)
        groupTotal += data[i].precipitation;
        dryCount = 0;
      } else if (!hasPrecip && inGroup) {
        // Dry period within a group
        dryCount++;

        // Check if next period has precipitation (look ahead)
        const hasNextPrecip =
          i + 1 < data.length && data[i + 1].precipitation > 0;

        if (dryCount >= 2 || (dryCount === 1 && !hasNextPrecip)) {
          // End current group (2+ dry periods, or 1 dry period with no precipitation after)
          const groupEnd = i - dryCount;
          const groupMiddle = Math.floor((groupStart + groupEnd) / 2);

          // Mark the middle point with the total precipitation for the group
          data[groupMiddle].precipitationGroupTotal = groupTotal;
          data[groupMiddle].precipitationGroupStart = groupStart;
          data[groupMiddle].precipitationGroupEnd = groupEnd;

          inGroup = false;
          groupTotal = 0;
          dryCount = 0;
        }
      }
    }

    // Handle case where precipitation group extends to end of data
    if (inGroup) {
      const groupEnd = data.length - 1 - dryCount;
      const groupMiddle = Math.floor((groupStart + groupEnd) / 2);

      data[groupMiddle].precipitationGroupTotal = groupTotal;
      data[groupMiddle].precipitationGroupStart = groupStart;
      data[groupMiddle].precipitationGroupEnd = groupEnd;
    }

    return data;
  }

  #calculateApparentTemperature(weatherData, latitude, longitude) {
    if (!this.settings.getShowApparentTemperature()) {
      return weatherData;
    }

    return weatherData.map((dataPoint) => {
      const apparentTemp = this.temperatureService.Calculate(
        ConvertService.toUtcTime(dataPoint.time),
        latitude,
        longitude,
        dataPoint.humidity || 50, // Use 50% as default if humidity is missing
        dataPoint.clouds,
        dataPoint.temperature,
        dataPoint.windSpeed,
      );

      return {
        ...dataPoint,
        apparentTemperature: {
          avg: apparentTemp.temp.avg.vind,
          min: apparentTemp.temp.min.vind,
          max: apparentTemp.temp.max.vind,
        },
      };
    });
  }

  async fetchWeatherData(forecastType) {
    try {
      const position = await this.locationService.getCurrentPosition();
      const { latitude, longitude } = position.coords;

      // Check cache first (include apparent temp setting in key since it affects data structure)
      const apparentTempEnabled = this.settings.getShowApparentTemperature()
        ? "1"
        : "0";
      const cacheKey = `${this.cachePrefix}${this.currentProvider}-${latitude.toFixed(2)}-${longitude.toFixed(2)}-at${apparentTempEnabled}`;

      const cachedItem = localStorage.getItem(cacheKey);
      if (cachedItem) {
        try {
          const cached = JSON.parse(cachedItem);
          const { data, alerts, expiry, version } = cached;

          // Invalidate cache if version doesn't match
          if (version !== this.cacheVersion) {
            localStorage.removeItem(cacheKey);
          } else if (expiry > Date.now()) {
            // Reconstruct Date objects
            if (data && Array.isArray(data)) {
              const reconstructedData = data.map((item) => ({
                ...item,
                time: new Date(item.time),
              }));
              return {
                data: reconstructedData,
                alerts: alerts || [],
              };
            }
          } else {
            localStorage.removeItem(cacheKey);
          }
        } catch (e) {
          console.error("Failed to parse cached data:", e);
          localStorage.removeItem(cacheKey);
        }
      }

      const provider = this.getProvider();

      const result = await provider.fetchWeatherData(
        latitude,
        longitude,
        forecastType,
      );

      let processedData = provider.processWeatherData(result);

      // Postprocess sun hours to correct for nighttime
      let correctedData = this.#correctSunHours(
        processedData,
        latitude,
        longitude,
      );

      // Apply apparent temperature if setting is enabled
      correctedData = this.#calculateApparentTemperature(
        correctedData,
        latitude,
        longitude,
      );

      // Mark extrema points for temperature and wind
      const extremaFields = ["temperature", "windSpeed", "windGusts"];

      // Add apparent temperature extrema if enabled
      if (this.settings.getShowApparentTemperature()) {
        extremaFields.push("apparentTemperature.min");
        extremaFields.push("apparentTemperature.max");
      }

      correctedData = this.extremaService.markExtrema(
        correctedData,
        extremaFields,
      );

      // Group precipitation periods
      const finalResult = this.#groupPrecipitation(correctedData);

      // Cache the processed result
      const expiryTime =
        Date.now() + this.settings.settings.locationCacheMinutes * 60 * 1000;
      const cacheData = {
        version: this.cacheVersion,
        data: finalResult,
        alerts: processedData.alerts || [],
        expiry: expiryTime,
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (e) {
        console.error("Failed to cache weather data:", e);
      }

      return {
        data: finalResult,
        alerts: processedData.alerts,
      };
    } catch (error) {
      const errorText = `Failed to fetch weather data: ${error.message}`;
      console.error(error.stack);
      throw new Error(errorText);
    }
  }

  /**
   * Correct sun hours data based on actual sunrise/sunset times
   * @param {Array} weatherData - Raw weather data from provider
   * @param {number} latitude - Latitude in degrees
   * @param {number} longitude - Longitude in degrees
   * @returns {Array} - Weather data with corrected sun hours
   */
  #correctSunHours(weatherData, latitude, longitude) {
    return weatherData.data.map((dataPoint, index) => {
      const currentTime = dataPoint.time;

      // Calculate sun times for this data point's date
      const sunTimes = this.sunService.calculateSunTimes(
        latitude,
        longitude,
        currentTime,
      );

      // Convert sunrise and sunset times to decimal hours for comparison
      const sunriseDecimal = this.sunService.timeStringToDecimal(
        sunTimes.sunrise,
      );
      const sunsetDecimal = this.sunService.timeStringToDecimal(
        sunTimes.sunset,
      );
      const currentDecimal = this.sunService.getDecimalTime(currentTime);

      // Check if current time is during daylight hours
      const isDaylight =
        currentDecimal >= sunriseDecimal && currentDecimal <= sunsetDecimal;

      // If it's nighttime, set sun hours to 0
      // Otherwise, keep the original value but ensure it's not negative
      const correctedSunHours = isDaylight
        ? Math.max(0, dataPoint.sunHours || 0)
        : 0;

      return {
        ...dataPoint,
        sunHours: correctedSunHours,
      };
    });
  }
}
