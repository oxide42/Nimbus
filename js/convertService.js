class ConvertService {
  static toCelsius(temperature, fromUnit) {
    switch (fromUnit) {
      case "fahrenheit":
        return ((temperature - 32) * 5) / 9;
      case "celsius":
        return temperature;
      case "kelvin":
        return temperature - 273.15;
      default:
        throw new Error(`Invalid unit: ${fromUnit}`);
    }
  }

  static toTemperature(temperature, fromUnit, toUnit) {
    const celsius = this.toCelsius(temperature, fromUnit);

    switch (toUnit) {
      case "fahrenheit":
        return (celsius * 9) / 5 + 32;
      case "celsius":
        return celsius;
      case "kelvin":
        return celsius + 273.15;
      default:
        throw new Error(`Invalid unit: ${toUnit}`);
    }
  }

  static toKmh(ws, fromUnit) {
    switch (fromUnit) {
      case "ms":
        return ws * 3.6;
      case "kmh":
        return ws;
      case "mph":
        return ws * 1.6093;
      case "knots":
        return ws * 1.852;
      default:
        throw new Error(`Invalid unit: ${fromUnit}`);
    }
  }

  static toWindSpeed(ws, fromUnit, toUnit) {
    const kmh = this.toKmh(ws, fromUnit);

    switch (toUnit) {
      case "ms":
        return kmh / 3.6;
      case "kmh":
        return kmh;
      case "mph":
        return kmh * 0.6214;
      case "knots":
        return kmh * 0.5399;
      default:
        throw new Error(`Invalid unit: ${toUnit}`);
    }
  }

  static toUtcTime(localTime) {
    const date = new Date(localTime);
    const utcTime = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    );
    // convert to date
    const utcDate = new Date(utcTime);
    return utcDate;
  }
}
