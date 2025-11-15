class TemperatureService {
  constructor() {
    this.sunService = new SunService();
  }

  getApparentTemperature(rh, Ta, ws, Q) {
    // http://www.bom.gov.au/info/thermal_stress/
    // Where, AT = Apparent Temperature, Ta = Dry Bulb Temperature, e = Water Vapour Pressure,
    // ws = Wind Speed at an Elevation of 10 meters, Q = Net Radiation Absorbed per unit area of Body Surface,
    // rh = Relative Humidity
    const e = (rh / 100) * 6.105 * Math.exp((17.27 * Ta) / (237.7 + Ta));
    let AT;

    if (Q > 0) {
      AT = Ta + 0.348 * e - 0.7 * ws + (0.7 * (Q / (ws + 10)) - 4.25);
    } else {
      AT = Ta + 0.33 * e - 0.7 * ws - 4;
    }

    return Math.round(AT);
  }

  Calculate(
    utctime,
    lat,
    lon,
    relative_humidity_pct,
    clouds_pct,
    temperature_degrees,
    wind_speed_ms,
  ) {
    const min_wind_speed = 0;

    const sundata = this.sunService.calculateSunTimes(lat, lon, utctime);
    const solarinsolation_max = this.sunService.getSolarInsolation(
      sundata.zenith,
      0,
    );
    const solarinsolation_avg = this.sunService.getSolarInsolation(
      sundata.zenith,
      clouds_pct,
    );
    sundata.solarinsolation = solarinsolation_avg;

    const temp_avg = {
      vindstille: this.getApparentTemperature(
        relative_humidity_pct,
        temperature_degrees,
        min_wind_speed,
        solarinsolation_avg,
      ),
      vind: this.getApparentTemperature(
        relative_humidity_pct,
        temperature_degrees,
        wind_speed_ms,
        solarinsolation_avg,
      ),
    };

    const temp_max = {
      vindstille: this.getApparentTemperature(
        relative_humidity_pct,
        temperature_degrees,
        min_wind_speed,
        solarinsolation_max,
      ),
      vind: this.getApparentTemperature(
        relative_humidity_pct,
        temperature_degrees,
        wind_speed_ms,
        solarinsolation_max,
      ),
    };

    const temp_min = {
      vindstille: this.getApparentTemperature(
        relative_humidity_pct,
        temperature_degrees,
        min_wind_speed,
        0,
      ),
      vind: this.getApparentTemperature(
        relative_humidity_pct,
        temperature_degrees,
        wind_speed_ms,
        0,
      ),
    };

    return {
      temp: {
        avg: temp_avg,
        max: temp_max,
        min: temp_min,
      },
      sun: sundata,
    };
  }
}
