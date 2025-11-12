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
    // Use localStorage for weather data cache (cookies are too small)
    this.cachePrefix = "nimbus-weather-cache-";
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

  #ema(data, property, ema_length = 3) {
    const alpha = 2 / (ema_length + 1); // 0.5
    const emaValues = [];

    let ema = data[0][property]; // seed with first value
    emaValues.push(ema);

    for (let i = 1; i < data.length; i++) {
      ema = alpha * data[i][property] + (1 - alpha) * ema;
      emaValues.push(ema);
    }
    return emaValues;
  }

  #smooth(data) {
    //const temp_ema = this.#ema(data, "temperature", 3);
    const wind_ema = this.#ema(data, "windSpeed", 4);
    const windgusts_ema = this.#ema(data, "windGusts", 4);

    // Apply ema on data structure
    data.forEach((item, index) => {
      item.temperature = temp_ema[index];
      item.windSpeed = wind_ema[index];
      item.windGusts = windgusts_ema[index];
    });
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

  async fetchWeatherData(forecastType) {
    try {
      const position = await this.locationService.getCurrentPosition();
      const { latitude, longitude } = position.coords;

      // Check cache first
      const cacheKey = `${this.cachePrefix}${this.currentProvider}-${latitude.toFixed(2)}-${longitude.toFixed(2)}`;

      const cachedItem = localStorage.getItem(cacheKey);
      if (cachedItem) {
        try {
          const { data, expiry } = JSON.parse(cachedItem);
          if (expiry > Date.now()) {
            // Reconstruct Date objects
            if (data.data && Array.isArray(data.data)) {
              data.data = data.data.map((item) => ({
                ...item,
                time: new Date(item.time),
              }));
            }
            return data;
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
      const correctedData = this.#correctSunHours(
        processedData,
        latitude,
        longitude,
      );

      // Smooth data
      //this.#smooth(correctedData);

      // Mark extrema points for temperature and wind
      processedData = this.extremaService.markExtrema(correctedData, [
        "temperature",
        "windSpeed",
        "windGusts",
      ]);

      // Group precipitation periods
      processedData = this.#groupPrecipitation(processedData);

      const finalResult = {
        data: processedData,
        alerts: result.alerts,
      };

      // Cache the processed result
      const expiryTime =
        Date.now() + this.settings.settings.locationCacheMinutes * 60 * 1000;
      const cacheData = {
        data: finalResult,
        expiry: expiryTime,
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (e) {
        console.error("Failed to cache weather data:", e);
      }

      return finalResult;
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
        // Add debug info about sun times (can be removed later)
        _sunDebug: {
          sunrise: sunTimes.sunrise,
          sunset: sunTimes.sunset,
          isDaylight: isDaylight,
          originalSunHours: dataPoint.sunHours,
          correctedSunHours: correctedSunHours,
        },
      };
    });
  }
}
