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

  #findLocalExtrema(timeseries, property, windowSize = 5, minProminence = 0.5) {
    if (timeseries.length < 3) return;

    const data = timeseries.map((point) => point[property]);
    const n = data.length;

    let lastMaximaIdx = -Infinity;
    let lastMinimaIdx = -Infinity;

    // Use adaptive window size near edges
    for (let i = 1; i < n - 1; i++) {
      const current = data[i];

      // Determine actual window size based on position
      const leftWindow = Math.min(windowSize, i);
      const rightWindow = Math.min(windowSize, n - 1 - i);
      const actualWindow = Math.min(leftWindow, rightWindow);

      if (actualWindow < 2) continue; // Need at least 2 points on each side

      // Get values in left and right windows
      const leftValues = data.slice(i - actualWindow, i);
      const rightValues = data.slice(i + 1, i + actualWindow + 1);

      // Calculate averages
      const leftAvg = leftValues.reduce((a, b) => a + b, 0) / leftValues.length;
      const rightAvg =
        rightValues.reduce((a, b) => a + b, 0) / rightValues.length;

      // Find max/min in windows for prominence check
      const leftMin = Math.min(...leftValues);
      const leftMax = Math.max(...leftValues);
      const rightMin = Math.min(...rightValues);
      const rightMax = Math.max(...rightValues);

      // Check if this is a maximum
      const isHigherThanBoth = current > leftAvg && current > rightAvg;
      const maxProminence = Math.min(current - leftMin, current - rightMin);

      if (isHigherThanBoth && maxProminence >= minProminence) {
        // Make sure it's higher than immediate neighbors and not too close to last maxima
        if (
          current >= data[i - 1] &&
          current >= data[i + 1] &&
          i - lastMaximaIdx > actualWindow
        ) {
          if (!timeseries[i].extrema) timeseries[i].extrema = {};
          if (!timeseries[i].extrema.isMaxima)
            timeseries[i].extrema.isMaxima = [];
          timeseries[i].extrema.isMaxima.push(property);
          lastMaximaIdx = i;
        }
      }

      // Check if this is a minimum
      const isLowerThanBoth = current < leftAvg && current < rightAvg;
      const valleyProminence = Math.min(leftMax - current, rightMax - current);

      if (isLowerThanBoth && valleyProminence >= minProminence) {
        // Make sure it's lower than immediate neighbors and not too close to last minima
        if (
          current <= data[i - 1] &&
          current <= data[i + 1] &&
          i - lastMinimaIdx > actualWindow
        ) {
          if (!timeseries[i].extrema) timeseries[i].extrema = {};
          if (!timeseries[i].extrema.isMinima)
            timeseries[i].extrema.isMinima = [];
          timeseries[i].extrema.isMinima.push(property);
          lastMinimaIdx = i;
        }
      }
    }

    // Log the first 20 temperatures together with their extrema info
    console.log(
      timeseries.slice(20, 40).map((item) =>
        JSON.stringify({
          temperature: item.temperature || {},
          extrema: item.extrema || {},
        }),
      ),
    );
  }
}
