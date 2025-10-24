class ExtremaService {
  constructor(settings) {
    this.settings = settings;
    // Base thresholds - will be adjusted per forecast type
    this.indexDistanceThreshold = 4;
    this.valueThresholdPct = 0.2;
    this.valueThresholdValue = 1;
  }

  /**
   * Mark datapoints with extrema property
   * @param {Array} timeSeries - Array of data points
   * @param {Array} properties - Array of property names to analyze (e.g., ['temperature', 'windSpeed'])
   * @returns {Array} - Time series with extrema property added
   */
  markExtrema(timeSeries, properties) {
    // Ensure properties is an array
    const propsArray = Array.isArray(properties) ? properties : [properties];

    // Create maps for each property
    const minimaMap = new Map(); // index -> [property names]
    const maximaMap = new Map(); // index -> [property names]

    propsArray.forEach((property) => {
      const localExtrema = this.#findLocalExtrema(timeSeries, property);

      localExtrema.minima.forEach((e) => {
        if (!minimaMap.has(e.index)) {
          minimaMap.set(e.index, []);
        }
        minimaMap.get(e.index).push(property);
      });

      localExtrema.maxima.forEach((e) => {
        if (!maximaMap.has(e.index)) {
          maximaMap.set(e.index, []);
        }
        maximaMap.get(e.index).push(property);
      });
    });

    // Mark each datapoint
    return timeSeries.map((dataPoint, index) => {
      const minima = minimaMap.get(index);
      const maxima = maximaMap.get(index);

      // Only add extrema property if there are any extrema
      if (minima || maxima) {
        const _extrema = {};
        if (minima) _extrema.isMinima = minima;
        if (maxima) _extrema.isMaxima = maxima;

        return {
          ...dataPoint,
          extrema: _extrema,
        };
      }

      return dataPoint;
    });
  }

  /**
   * Find local extrema (minima and maxima) in a time series
   * @param {Array} timeSeries - Array of data points
   * @param {string} property - Property name to analyze (e.g., 'temperature')
   * @returns {Object} - Object with minima and maxima arrays
   */
  #findLocalExtrema(timeSeries, property) {
    return this.#smoothExtrema(this.#extremaSimple(timeSeries, property));
  }

  /**
   * Simple extrema detection - finds all local minima and maxima
   * @param {Array} timeSeries - Array of data points
   * @param {string} property - Property name to analyze
   * @returns {Object} - Object with minima and maxima arrays
   */
  #extremaSimple(timeSeries, property) {
    const minima = [];
    const maxima = [];
    const length = timeSeries.length;

    if (length === 0) return { minima, maxima };

    for (let i = 0; i < length; i++) {
      const current = timeSeries[i][property];
      const prev = i > 0 ? timeSeries[i - 1][property] : current;
      const next = i < length - 1 ? timeSeries[i + 1][property] : current;

      const point = { index: i, value: current, time: timeSeries[i].time };

      // Check for maximum
      if (current >= prev && current > next) {
        maxima.push(point);
      }
      // Check for minimum
      else if (current <= prev && current < next) {
        minima.push(point);
      }
    }

    return {
      minima: minima,
      maxima: maxima,
    };
  }

  /**
   * Smooth/filter extrema to remove noise and close duplicates
   * @param {Object} extrema - Object with minima and maxima arrays
   * @returns {Object} - Filtered extrema
   */
  #smoothExtrema(extrema) {
    // Adjust thresholds based on forecast type
    const forecastType = this.settings.getForecastType();
    let indexDistanceThreshold = this.indexDistanceThreshold;
    if (forecastType === "hourly") {
      indexDistanceThreshold = this.indexDistanceThreshold * 3; // More aggressive filtering for hourly
    } else if (forecastType === "3-hourly") {
      indexDistanceThreshold = this.indexDistanceThreshold * 1;
    }

    let valueThresholdPct = this.valueThresholdPct;
    let valueThresholdValue = this.valueThresholdValue;

    // Filter minima and maxima separately to avoid cross-filtering issues
    const filterExtremaList = (extremaList, isMaxima) => {
      if (extremaList.length === 0) return [];

      const result = [];
      let i = 0;

      while (i < extremaList.length) {
        let bestInGroup = extremaList[i];
        let groupEnd = i;

        // Find all extrema in this group (close in index and value)
        for (let j = i + 1; j < extremaList.length; j++) {
          const isCloseInIndex =
            extremaList[j].index - bestInGroup.index <= indexDistanceThreshold;

          let isCloseInValue =
            Math.abs(
              (extremaList[j].value - bestInGroup.value) /
                Math.max(
                  Math.abs(extremaList[j].value),
                  Math.abs(bestInGroup.value),
                ),
            ) <= valueThresholdPct;

          if (
            Math.abs(extremaList[j].value - bestInGroup.value) <
            valueThresholdValue
          )
            isCloseInValue = true;

          if (isCloseInIndex && isCloseInValue) {
            // Update best in group - keep the most extreme value
            if (isMaxima && extremaList[j].value > bestInGroup.value) {
              bestInGroup = extremaList[j];
            } else if (!isMaxima && extremaList[j].value < bestInGroup.value) {
              bestInGroup = extremaList[j];
            }
            groupEnd = j;
          } else {
            break;
          }
        }

        result.push(bestInGroup);
        i = groupEnd + 1;
      }

      return result;
    };

    // Step 1: Filter minima and maxima independently (same-type filtering)
    let filteredMinima = filterExtremaList(extrema.minima, false);
    let filteredMaxima = filterExtremaList(extrema.maxima, true);

    // Step 2: Cross-type filtering - remove min/max pairs that are too close
    const allExtrema = [
      ...filteredMinima.map((e) => ({ ...e, type: "minimum" })),
      ...filteredMaxima.map((e) => ({ ...e, type: "maximum" })),
    ];
    allExtrema.sort((a, b) => a.index - b.index);

    const finalResult = [];
    let skip = new Set();

    for (let i = 0; i < allExtrema.length; i++) {
      if (skip.has(i)) continue;

      const current = allExtrema[i];
      let keepCurrent = true;

      // Check if next extremum is of different type and too close
      if (i + 1 < allExtrema.length) {
        const next = allExtrema[i + 1];

        if (current.type !== next.type) {
          const isCloseInIndex =
            next.index - current.index <= indexDistanceThreshold;

          let isCloseInValue =
            Math.abs(
              (next.value - current.value) /
                Math.max(Math.abs(next.value), Math.abs(current.value)),
            ) <= valueThresholdPct;

          if (Math.abs(next.value - current.value) < valueThresholdValue)
            isCloseInValue = true;

          if (isCloseInIndex && isCloseInValue) {
            // Keep the more extreme one (larger deviation from midpoint)
            const midValue = (current.value + next.value) / 2;
            const currentDeviation = Math.abs(current.value - midValue);
            const nextDeviation = Math.abs(next.value - midValue);

            if (nextDeviation > currentDeviation) {
              keepCurrent = false;
              skip.add(i);
            } else {
              skip.add(i + 1);
            }
          }
        }
      }

      if (keepCurrent) {
        finalResult.push(current);
      }
    }

    // Separate back into minima and maxima
    filteredMinima = finalResult
      .filter((e) => e.type === "minimum")
      .map((e) => ({
        index: e.index,
        value: e.value,
        time: e.time,
      }));
    filteredMaxima = finalResult
      .filter((e) => e.type === "maximum")
      .map((e) => ({
        index: e.index,
        value: e.value,
        time: e.time,
      }));

    return {
      minima: filteredMinima,
      maxima: filteredMaxima,
    };
  }
}
