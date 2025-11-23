class WeatherService {
  constructor(settings) {
    this.settings = settings;
    this.i18n = I18n.getInstance();
    this.providers = {
      openweathermap: OpenWeatherMapProvider,
      openmeteo: OpenMeteoProvider,
      dmi: DmiProvider,
    };
    this.currentProvider = this.settings.settings.weatherProvider;
    this.locationService = new LocationService(settings);
    this.sunService = new SunService();
    this.extremaService = new ExtremaService(settings);
    this.cachePrefix = "weather_cache_";
    this.cacheVersion = 1;
    this.temperatureService = new TemperatureService();
    this.convertService = new ConvertService();
    this.cache = Cache.getInstance();
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

  getProviderDisplayName() {
    const provider = this.getProvider();
    const providerName = provider.getDisplayName();

    if (this.i18n) {
      return this.i18n.t("footer.weatherDataFrom", { provider: providerName });
    }

    return `Weather data from ${providerName}`;
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
        patioWeather: {
          noWind: apparentTemp.temp.min.vindstille,
          withWind: apparentTemp.temp.min.vind,
        },
        hikingWeather: {
          noWind: apparentTemp.temp.min.vindstille,
          withWind: apparentTemp.temp.min.vind,
        },
      };
    });
  }

  /**
   * Get cached weather data if available and not expired
   * @param {string} cacheKey - Cache key to look up
   * @returns {Object|null} - Cached data with reconstructed Date objects, or null if not available/expired
   */
  #getCachedData(cacheKey) {
    const cached = this.cache.getItem(cacheKey, this.cacheVersion);
    if (!cached) {
      return null;
    }

    const { data, alerts } = cached;

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

    return null;
  }

  async fetchWeatherData(forecastType) {
    try {
      const position = await this.locationService.getCurrentPosition();
      const { latitude, longitude } = position.coords;

      // Check cache first (no version check needed - handled by #getCachedData)
      const cacheKey = `${this.cachePrefix}${this.currentProvider}_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;

      const cachedData = this.#getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
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

      // Always calculate apparent temperature (regardless of display setting)
      correctedData = this.#calculateApparentTemperature(
        correctedData,
        latitude,
        longitude,
      );

      // Mark extrema points for temperature, wind, and apparent temperature
      const extremaFields = [
        "temperature",
        "windSpeed",
        "windGusts",
        "apparentTemperature.min",
        "apparentTemperature.max",
      ];

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
        data: finalResult,
        alerts: processedData.alerts || [],
      };

      this.cache.setItem(cacheKey, cacheData, expiryTime, this.cacheVersion);

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
