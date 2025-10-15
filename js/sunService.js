class SunService {
  constructor() {
    // Sun calculation constants
    this.constants = {
      PI: Math.PI,
      A0: 229.18,
      A1: 0.000075,
      A2: 0.001868,
      A3: -0.032077,
      A4: -0.014615,
      A5: -0.040849,
      A6: 0.006918,
      A7: -0.399912,
      A8: 0.070257,
      A9: -0.006758,
      A10: 0.000907,
      A11: -0.002697,
      A12: 0.00148,
      B0: 90.833,
    };
  }

  /**
   * Convert float time to HH:MM format
   * @param {number} floatTime - Time in decimal format (e.g., 6.5 = 6:30)
   * @returns {string} - Time in HH:MM format
   */
  floatToTime(floatTime) {
    const hours = Math.floor(floatTime);
    const minutes = Math.round((floatTime - hours) * 60);

    // Handle minute overflow
    if (minutes >= 60) {
      return `${String(hours + 1).padStart(2, "0")}:00`;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  /**
   * Get the day of year from a Date object
   * @param {Date} date - JavaScript Date object
   * @returns {number} - Day of year (1-366)
   */
  getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  /**
   * Get local time in decimal hours from a Date object
   * @param {Date} date - JavaScript Date object
   * @returns {number} - Local time in decimal hours
   */
  getDecimalTime(date) {
    return date.getHours() + date.getMinutes() / 60;
  }

  /**
   * Check if daylight saving time is active
   * @param {Date} date - JavaScript Date object
   * @returns {boolean} - True if DST is active
   */
  isDaylightSavingTime(date) {
    const january = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
    const july = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    return Math.max(january, july) !== date.getTimezoneOffset();
  }

  /**
   * Calculate sun position and times for given coordinates and time
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @param {Date} utcTime - UTC time as JavaScript Date object
   * @returns {Object} - Object containing zenith, sunrise, sunset, and noon times
   */
  calculateSunTimes(lat, lon, utcTime) {
    const { PI, A0, A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12, B0 } =
      this.constants;

    const timezone = 1; // Assuming Central European Time
    const jday = this.getDayOfYear(utcTime);
    const ltime = this.getDecimalTime(utcTime);

    // Calculate sun position
    const ga = (2 * PI * (jday - 1 + (ltime - 12) / 24)) / 365;

    const eqtime =
      A0 *
      (A1 +
        A2 * Math.cos(ga) +
        A3 * Math.sin(ga) +
        A4 * Math.cos(2 * ga) +
        A5 * Math.sin(2 * ga));

    const decl =
      A6 +
      A7 * Math.cos(ga) +
      A8 * Math.sin(ga) +
      A9 * Math.cos(2 * ga) +
      A10 * Math.sin(2 * ga) +
      A11 * Math.cos(3 * ga) +
      A12 * Math.sin(3 * ga);

    const timeOffset = eqtime - 4 * lon + 60 * timezone;
    const tst = ltime * 60 + timeOffset;
    const ha = tst / 4 - 180; // degrees

    const csza =
      Math.sin((lat * PI) / 180) * Math.sin(decl) +
      Math.cos((lat * PI) / 180) * Math.cos(decl) * Math.cos((ha * PI) / 180);

    const ha1 =
      (Math.acos(
        Math.cos((B0 * PI) / 180) /
          (Math.cos((lat * PI) / 180) * Math.cos(decl)) -
          Math.tan((lat * PI) / 180) * Math.tan(decl),
      ) *
        180) /
      PI;

    const zenith = Math.round((Math.acos(csza) * 180) / PI);
    let sunrise =
      Math.round(((720 + 4 * (lon - ha1) - eqtime) / 60) * 100) / 100;
    let sunset =
      Math.round(((720 + 4 * (lon + ha1) - eqtime) / 60) * 100) / 100;
    let snoon = Math.round(((720 + 4 * lon - eqtime) / 60) * 100) / 100;

    // Adjust for daylight saving time
    const isDst = this.isDaylightSavingTime(utcTime);
    if (isDst) {
      sunrise += 1;
      sunset += 1;
      snoon += 1;
    }

    return {
      zenith: zenith,
      sunrise: this.floatToTime(sunrise),
      sunset: this.floatToTime(sunset),
      noon: this.floatToTime(snoon),
    };
  }

  /**
   * Calculate sun times for current location and time
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @returns {Object} - Object containing zenith, sunrise, sunset, and noon times for current UTC time
   */
  getCurrentSunTimes(lat, lon) {
    const now = new Date();
    return this.calculateSunTimes(lat, lon, now);
  }

  /**
   * Calculate sun times for a specific date
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @param {Date} date - Date for which to calculate sun times
   * @returns {Object} - Object containing zenith, sunrise, sunset, and noon times
   */
  getSunTimesForDate(lat, lon, date) {
    return this.calculateSunTimes(lat, lon, date);
  }

  /**
   * Calculate daylight duration in hours
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @param {Date} date - Date for calculation (optional, defaults to current date)
   * @returns {number} - Daylight duration in decimal hours
   */
  getDaylightDuration(lat, lon, date = new Date()) {
    const sunTimes = this.calculateSunTimes(lat, lon, date);

    // Convert time strings back to decimal hours for calculation
    const sunriseDecimal = this.timeStringToDecimal(sunTimes.sunrise);
    const sunsetDecimal = this.timeStringToDecimal(sunTimes.sunset);

    return Math.round((sunsetDecimal - sunriseDecimal) * 100) / 100;
  }

  /**
   * Convert time string (HH:MM) to decimal hours
   * @param {string} timeString - Time in HH:MM format
   * @returns {number} - Time in decimal hours
   */
  timeStringToDecimal(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours + minutes / 60;
  }

  getSolarInsolation(zenith, clouds_pct) {
    // Max solindstråling under optimale forhold
    // solarconstant = 1025;  // W/m2
    // Den øvre grænse for hvor meget solen kan opvarme bar hud er 400 W/m2
    const solarconstant = 400; // W/m2

    // Tag hoejde for den ekstra atmosfaere som solen skal passere;
    const solarzentithconstant =
      solarconstant *
      (solarconstant / (solarconstant / Math.cos((Math.PI * zenith) / 180)));

    // Tag hoejde for den ekstra flade solen skal opvarme;
    // az = 1 / Math.cos(Math.PI * zenith / 180.);
    // Nu regnes der altid paa den optimale flade;
    const az = 1;

    let solarinsolation = Math.round(
      solarzentithconstant * (1 / az) * ((100 - clouds_pct) / 100),
    );

    if (solarinsolation < 0 || zenith >= 89) {
      solarinsolation = 0;
    }

    return solarinsolation;
  }
}
