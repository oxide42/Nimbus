class ExtremaService {
  constructor(settings) {
    this.settings = settings;
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
      this.#findLocalExtrema2(timeSeries, property);
    });

    return timeSeries;
  }

  #findLocalExtrema1(
    timeseries,
    property,
    windowSize = 5,
    baseProminence = 3,
    decayDistance = 6,
    minSeparation = 3,
    minDifference = 1,
  ) {
    if (timeseries.length < 3) return;

    const data = timeseries.map((point) =>
      this.#getNestedProperty(point, property),
    );

    // Check if all values are undefined/null - if so, skip this property
    if (data.every((val) => val === undefined || val === null)) {
      return;
    }

    const n = data.length;

    let lastMaximaIdx = -Infinity;
    let lastMinimaIdx = -Infinity;
    let lastMaximaValue = null;
    let lastMinimaValue = null;

    // Helper function to mark extrema
    const markMaxima = (idx) => {
      if (!timeseries[idx].extrema) timeseries[idx].extrema = {};
      if (!timeseries[idx].extrema.isMaxima)
        timeseries[idx].extrema.isMaxima = [];
      timeseries[idx].extrema.isMaxima.push(property);
      lastMaximaIdx = idx;
      lastMaximaValue = data[idx];
    };

    const markMinima = (idx) => {
      if (!timeseries[idx].extrema) timeseries[idx].extrema = {};
      if (!timeseries[idx].extrema.isMinima)
        timeseries[idx].extrema.isMinima = [];
      timeseries[idx].extrema.isMinima.push(property);
      lastMinimaIdx = idx;
      lastMinimaValue = data[idx];
    };

    // Check first point - is it a maxima?
    if (n >= 2) {
      const isStartMaxima = data
        .slice(1, Math.min(n, windowSize + 1))
        .every((v) => data[0] > v);
      const prominence =
        data[0] - Math.min(...data.slice(1, Math.min(n, windowSize + 1)));
      if (isStartMaxima && prominence >= baseProminence) {
        markMaxima(0);
      }

      const isStartMinima = data
        .slice(1, Math.min(n, windowSize + 1))
        .every((v) => data[0] < v);
      const prominenceMin =
        Math.max(...data.slice(1, Math.min(n, windowSize + 1))) - data[0];
      if (isStartMinima && prominenceMin >= baseProminence) {
        markMinima(0);
      }
    }

    // Main loop for interior points
    for (let i = 1; i < n - 1; i++) {
      const current = data[i];

      const leftWindow = Math.min(windowSize, i);
      const rightWindow = Math.min(windowSize, n - 1 - i);
      const actualWindow = Math.min(leftWindow, rightWindow);

      if (actualWindow < 2) continue;

      const leftValues = data.slice(i - actualWindow, i);
      const rightValues = data.slice(i + 1, i + actualWindow + 1);

      const leftAvg = leftValues.reduce((a, b) => a + b, 0) / leftValues.length;
      const rightAvg =
        rightValues.reduce((a, b) => a + b, 0) / rightValues.length;

      const leftMin = Math.min(...leftValues);
      const leftMax = Math.max(...leftValues);
      const rightMin = Math.min(...rightValues);
      const rightMax = Math.max(...rightValues);

      const distanceFromLastMaxima = i - lastMaximaIdx;
      const distanceFromLastMinima = i - lastMinimaIdx;

      const maxProminenceThreshold =
        baseProminence * Math.exp(-distanceFromLastMaxima / decayDistance);
      const minProminenceThreshold =
        baseProminence * Math.exp(-distanceFromLastMinima / decayDistance);

      // Check if this is a maximum
      const isHigherThanBoth = current > leftAvg && current > rightAvg;
      const maxProminence = Math.min(current - leftMin, current - rightMin);

      if (isHigherThanBoth && maxProminence >= maxProminenceThreshold) {
        if (current >= data[i - 1] && current >= data[i + 1]) {
          const distanceToMinima = i - lastMinimaIdx;
          const amplitudeFromMinima =
            lastMinimaValue !== null ? current - lastMinimaValue : Infinity;
          const amplitudeFromLastMaxima =
            lastMaximaValue !== null
              ? Math.abs(current - lastMaximaValue)
              : Infinity;

          const sufficientSeparation = distanceToMinima >= minSeparation;
          const sufficientAmplitude = amplitudeFromMinima >= minDifference;
          const differentFromLastMaxima =
            amplitudeFromLastMaxima >= minDifference;

          // If there's a minima between last maxima and current point, we can mark this maxima
          // even if it's similar to the last maxima value
          const minimaInBetween = lastMinimaIdx > lastMaximaIdx;

          if (
            sufficientSeparation &&
            sufficientAmplitude &&
            (differentFromLastMaxima || minimaInBetween)
          ) {
            markMaxima(i);
          }
        }
      }

      // Check if this is a minimum
      const isLowerThanBoth = current < leftAvg && current < rightAvg;
      const valleyProminence = Math.min(leftMax - current, rightMax - current);

      if (isLowerThanBoth && valleyProminence >= minProminenceThreshold) {
        if (current <= data[i - 1] && current <= data[i + 1]) {
          const distanceToMaxima = i - lastMaximaIdx;
          const amplitudeFromMaxima =
            lastMaximaValue !== null ? lastMaximaValue - current : Infinity;
          const amplitudeFromLastMinima =
            lastMinimaValue !== null
              ? Math.abs(current - lastMinimaValue)
              : Infinity;

          const sufficientSeparation = distanceToMaxima >= minSeparation;
          const sufficientAmplitude = amplitudeFromMaxima >= minDifference;
          const differentFromLastMinima =
            amplitudeFromLastMinima >= minDifference;

          // If there's a maxima between last minima and current point, we can mark this minima
          // even if it's similar to the last minima value
          const maximaInBetween = lastMaximaIdx > lastMinimaIdx;

          if (
            sufficientSeparation &&
            sufficientAmplitude &&
            (differentFromLastMinima || maximaInBetween)
          ) {
            markMinima(i);
          }
        }
      }
    }

    // Check last point
    if (n >= 2) {
      const lastIdx = n - 1;
      const isEndMaxima = data
        .slice(Math.max(0, lastIdx - windowSize), lastIdx)
        .every((v) => data[lastIdx] > v);
      const prominence =
        data[lastIdx] -
        Math.min(...data.slice(Math.max(0, lastIdx - windowSize), lastIdx));

      const distanceToMinima = lastIdx - lastMinimaIdx;
      const amplitudeFromMinima =
        lastMinimaValue !== null ? data[lastIdx] - lastMinimaValue : Infinity;
      const amplitudeFromLastMaxima =
        lastMaximaValue !== null
          ? Math.abs(data[lastIdx] - lastMaximaValue)
          : Infinity;
      const minimaInBetween = lastMinimaIdx > lastMaximaIdx;

      if (
        isEndMaxima &&
        prominence >= baseProminence &&
        distanceToMinima >= minSeparation &&
        amplitudeFromMinima >= minDifference &&
        (amplitudeFromLastMaxima >= minDifference || minimaInBetween)
      ) {
        markMaxima(lastIdx);
      }

      const isEndMinima = data
        .slice(Math.max(0, lastIdx - windowSize), lastIdx)
        .every((v) => data[lastIdx] < v);
      const prominenceMin =
        Math.max(...data.slice(Math.max(0, lastIdx - windowSize), lastIdx)) -
        data[lastIdx];

      const distanceToMaxima = lastIdx - lastMaximaIdx;
      const amplitudeFromMaxima =
        lastMaximaValue !== null ? lastMaximaValue - data[lastIdx] : Infinity;
      const amplitudeFromLastMinima =
        lastMinimaValue !== null
          ? Math.abs(data[lastIdx] - lastMinimaValue)
          : Infinity;
      const maximaInBetween = lastMaximaIdx > lastMinimaIdx;

      if (
        isEndMinima &&
        prominenceMin >= baseProminence &&
        distanceToMaxima >= minSeparation &&
        amplitudeFromMaxima >= minDifference &&
        (amplitudeFromLastMinima >= minDifference || maximaInBetween)
      ) {
        markMinima(lastIdx);
      }
    }

    // Debug output - show time, rounded value, and extrema marking
    //
    /*
    if (property === "temperature") {
      const output = timeseries
        .map((point, idx) => {
          const time = point.time;
          const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
            time.getDay()
          ];
          const hours = String(time.getHours()).padStart(2, "0");
          const timeStr = `${dayOfWeek} ${hours}`;
          const temp = Math.round(this.#getNestedProperty(point, property));

          let marking = "";
          if (point.extrema?.isMaxima?.includes(property)) {
            marking = " MAX";
          } else if (point.extrema?.isMinima?.includes(property)) {
            marking = " MIN";
          }

          return `${idx.toString().padStart(3)}: ${timeStr} ${temp}°${marking}`;
        })
        .join(" | ");

      console.log("Temperature extre[@extremaService.js](file:///home/c/dev/Nimbus/js/extremaService.js) The #findLocalExtrema1 method is to big and bloated. Make a #findLocalExtrema2 alternative that uses a rolling window approach, and detects extrema in this window.A detected extrema should be deletable, if rolling gives a more extreme point.ma debug:", output);
    }
    */
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
  #findLocalExtrema2(data, property, windowSize = 17) {
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
          if (other <= value) isMin = false;
          if (other >= value) isMax = false;
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
    /*
    console.log(
      data
        .map(
          (d) =>
            `${d[property]},${d.extrema?.isMaxima.includes(property)},${d.extrema?.isMinima.includes(property)}`,
        )
        .join(";"),
    );
    */

    return data;
  }
}
