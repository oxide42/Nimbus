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

    // Process each property and mark extrema directly on timeseries
    propsArray.forEach((property) => {
      this.#findLocalExtrema(timeSeries, property);
    });

    return timeSeries;
  }

  #findLocalExtrema(
    timeseries,
    property,
    windowSize = 5,
    baseProminence = 3,
    decayDistance = 12,
    minSeparation = 6,
    minDifference = 1,
  ) {
    if (timeseries.length < 3) return;

    const data = timeseries.map((point) => point[property]);
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

          const sufficientSeparation = distanceToMinima >= minSeparation;
          const sufficientAmplitude = amplitudeFromMinima >= minDifference;

          if (sufficientSeparation || sufficientAmplitude) {
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

          const sufficientSeparation = distanceToMaxima >= minSeparation;
          const sufficientAmplitude = amplitudeFromMaxima >= minDifference;

          if (sufficientSeparation || sufficientAmplitude) {
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

      if (
        isEndMaxima &&
        prominence >= baseProminence &&
        (distanceToMinima >= minSeparation ||
          amplitudeFromMinima >= minDifference)
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

      if (
        isEndMinima &&
        prominenceMin >= baseProminence &&
        (distanceToMaxima >= minSeparation ||
          amplitudeFromMaxima >= minDifference)
      ) {
        markMinima(lastIdx);
      }
    }

    // Log the first 20 temperatures together with their extrema info
    console.log(
      timeseries.slice(0, 20).map((item) =>
        JSON.stringify({
          temperature: item.temperature || {},
          extrema: item.extrema || {},
        }),
      ),
    );
  }
}
