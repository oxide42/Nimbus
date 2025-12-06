/**
 * Savitzky-Golay Generalized Filter
 * JavaScript implementation based on mljs/savitzky-golay-generalized
 *
 * Apply Savitzky-Golay smoothing/derivative calculation to data
 */
class SavitzkyGolay {
  /**
   * Apply Savitzky-Golay filter to data
   * @param {Array|Float64Array} ys - Array of y values
   * @param {Array|Float64Array|number} xs - Array of x values or constant deltaX
   * @param {Object} options - Filter options
   * @param {number} options.windowSize - Window size (must be odd, >= 5) - default: 9
   * @param {number} options.derivative - Derivative order (0 for smoothing) - default: 0
   * @param {number} options.polynomial - Polynomial degree - default: 3
   * @returns {Float64Array} - Filtered y values
   */
  static sgg(ys, xs, options = {}) {
    const { windowSize = 9, derivative = 0, polynomial = 3 } = options;

    // Validate inputs
    if (
      windowSize % 2 === 0 ||
      windowSize < 5 ||
      !Number.isInteger(windowSize)
    ) {
      throw new RangeError(
        "Invalid window size (should be odd and at least 5 integer number)",
      );
    }

    if (!Array.isArray(ys) && !(ys instanceof Float64Array)) {
      throw new TypeError("Y values must be an array");
    }

    if (typeof xs === "undefined") {
      throw new TypeError("X must be defined");
    }

    if (windowSize > ys.length) {
      throw new RangeError(
        `Window size is higher than the data length ${windowSize}>${ys.length}`,
      );
    }

    if (derivative < 0 || !Number.isInteger(derivative)) {
      throw new RangeError("Derivative should be a positive integer");
    }

    if (polynomial < 1 || !Number.isInteger(polynomial)) {
      throw new RangeError("Polynomial should be a positive integer");
    }

    if (polynomial >= 6) {
      console.warn(
        "You should not use polynomial grade higher than 5 if you are" +
          " not sure that your data arises from such a model. Possible polynomial oscillation problems",
      );
    }

    const half = Math.floor(windowSize / 2);
    const np = ys.length;
    const ans = new Float64Array(np);
    const weights = this._fullWeights(windowSize, polynomial, derivative);
    let hs = 0;
    let constantH = true;

    if (Array.isArray(xs) || xs instanceof Float64Array) {
      constantH = false;
    } else {
      hs = Math.pow(xs, derivative);
    }

    // For the borders
    for (let i = 0; i < half; i++) {
      const wg1 = weights[half - i - 1];
      const wg2 = weights[half + i + 1];
      let d1 = 0;
      let d2 = 0;

      for (let l = 0; l < windowSize; l++) {
        d1 += wg1[l] * ys[l];
        d2 += wg2[l] * ys[np - windowSize + l];
      }

      if (constantH) {
        ans[half - i - 1] = d1 / hs;
        ans[np - half + i] = d2 / hs;
      } else {
        hs = this._getHs(xs, half - i - 1, half, derivative);
        ans[half - i - 1] = d1 / hs;
        hs = this._getHs(xs, np - half + i, half, derivative);
        ans[np - half + i] = d2 / hs;
      }
    }

    // For the internal points
    const wg = weights[half];
    for (let i = windowSize; i <= np; i++) {
      let d = 0;
      for (let l = 0; l < windowSize; l++) {
        d += wg[l] * ys[l + i - windowSize];
      }
      if (!constantH) {
        hs = this._getHs(xs, i - half - 1, half, derivative);
      }
      ans[i - half - 1] = d / hs;
    }

    return ans;
  }

  /**
   * Calculate h spacing for non-uniform x values
   * @private
   * @param {Array|Float64Array} h - Array of x values
   * @param {number} center - Center index
   * @param {number} half - Half window size
   * @param {number} derivative - Derivative order
   * @returns {number} - Calculated h spacing
   */
  static _getHs(h, center, half, derivative) {
    let hs = 0;
    let count = 0;

    for (let i = center - half; i < center + half; i++) {
      if (i >= 0 && i < h.length - 1) {
        hs += h[i + 1] - h[i];
        count++;
      }
    }

    return Math.pow(hs / count, derivative);
  }

  /**
   * Gram polynomial calculation
   * @private
   * @param {number} i - Index parameter
   * @param {number} m - Half window size
   * @param {number} k - Polynomial order
   * @param {number} s - Derivative order
   * @returns {number} - Gram polynomial value
   */
  static _gramPoly(i, m, k, s) {
    let Grampoly = 0;

    if (k > 0) {
      Grampoly =
        ((4 * k - 2) / (k * (2 * m - k + 1))) *
          (i * this._gramPoly(i, m, k - 1, s) +
            s * this._gramPoly(i, m, k - 1, s - 1)) -
        (((k - 1) * (2 * m + k)) / (k * (2 * m - k + 1))) *
          this._gramPoly(i, m, k - 2, s);
    } else if (k === 0 && s === 0) {
      Grampoly = 1;
    } else {
      Grampoly = 0;
    }

    return Grampoly;
  }

  /**
   * Generalized factorial calculation
   * @private
   * @param {number} a - Upper bound
   * @param {number} b - Number of terms
   * @returns {number} - Generalized factorial value
   */
  static _genFact(a, b) {
    let gf = 1;

    if (a >= b) {
      for (let j = a - b + 1; j <= a; j++) {
        gf *= j;
      }
    }

    return gf;
  }

  /**
   * Weight calculation for filter
   * @private
   * @param {number} i - Position index
   * @param {number} t - Time/window position
   * @param {number} m - Half window size
   * @param {number} n - Polynomial degree
   * @param {number} s - Derivative order
   * @returns {number} - Weight value
   */
  static _weight(i, t, m, n, s) {
    let sum = 0;

    for (let k = 0; k <= n; k++) {
      sum +=
        (2 * k + 1) *
        (this._genFact(2 * m, k) / this._genFact(2 * m + k + 1, k + 1)) *
        this._gramPoly(i, m, k, 0) *
        this._gramPoly(t, m, k, s);
    }

    return sum;
  }

  /**
   * Calculate full weight matrix
   * @private
   * @param {number} m - Number of points (window size)
   * @param {number} n - Polynomial grade
   * @param {number} s - Derivative order
   * @returns {Array<Float64Array>} - Weight matrix
   */
  static _fullWeights(m, n, s) {
    const weights = new Array(m);
    const np = Math.floor(m / 2);

    for (let t = -np; t <= np; t++) {
      weights[t + np] = new Float64Array(m);
      for (let j = -np; j <= np; j++) {
        weights[t + np][j + np] = this._weight(j, t, np, n, s);
      }
    }

    return weights;
  }
}
