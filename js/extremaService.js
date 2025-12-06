class ExtremaService {
  constructor(settings) {
    this.settings = settings;
    this.logging = false;
  }

  /**
   * Get nested property value from object using dot notation
   * @param {Object} obj - Object to get value from
   * @param {string} path - Property path (e.g., 'apparentTemperature.min')
   * @returns {*} - Property value or undefined
   */
  #getNestedProperty(obj, path) {
    return path.split(".").reduce((current, prop) => current?.[prop], obj);
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

    // Process each property and mark extrema directly on timeseries
    propsArray.forEach((property) => {
      this.#findLocalExtrema(timeSeries, property);
    });

    return timeSeries;
  }

  /**
   * Detects extrema (minima/maxima) in a time-series using a rolling window.
   * Adds an `extrema` object only to qualifying points:
   *   data[idx].extrema = {
   *     isMinima:  [propertyName],
   *     isMaxima:  [propertyName]
   *   }
   *
   * @param {Array<Object>} data        Time-series array
   * @param {string}        property    Numeric property to scan
   * @param {number}        [windowSize=5]  Odd integer ≥ 3
   * @returns {Array<Object>} The same array, mutated in place
   */
  #findLocalExtrema(data, property, windowSize = 17) {
    if (!Array.isArray(data) || data.length === 0) return data;
    if (typeof property !== "string" || property.length === 0) return data;
    if (windowSize < 3 || windowSize % 2 === 0) {
      throw new Error("windowSize must be an odd integer ≥ 3");
    }

    const half = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      const value = current[property];

      if (value == null || Number.isNaN(value)) continue;

      let isMin = true;
      let isMax = true;

      // scan window
      for (let j = -half; j <= half; j++) {
        const k = i + j;
        if (k < 0 || k >= data.length) continue;
        const other = data[k][property];
        if (other == null || Number.isNaN(other)) continue;

        if (k !== i) {
          // For tie-breaking: if equal value found to the left, disqualify current point
          if (other === value && k < i) {
            isMin = false;
            isMax = false;
          }
          if (other < value) isMin = false;
          if (other > value) isMax = false;
        }
      }

      // first & last point are always considered
      const isEndpoint = i === 0 || i === data.length - 1;

      if (isMin || isMax || isEndpoint) {
        if (!current.extrema) current.extrema = { isMinima: [], isMaxima: [] };

        if (isMin || isEndpoint) {
          if (!current.extrema.isMinima.includes(property)) {
            current.extrema.isMinima.push(property);
          }
        }
        if (isMax || isEndpoint) {
          if (!current.extrema.isMaxima.includes(property)) {
            current.extrema.isMaxima.push(property);
          }
        }
      }
    }

    // debug to console.log a list like value1,isMaxima,isminima;value2,ismaxima,isminima;...
    if (this.logging && property === "windSpeed") {
      console.log(
        data
          .map(
            (d) =>
              `${d[property]},${d.extrema?.isMaxima.includes(property)},${d.extrema?.isMinima.includes(property)}`,
          )
          .join(";"),
      );
    }

    return data;
  }
}
