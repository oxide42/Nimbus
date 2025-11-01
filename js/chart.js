class WeatherChart {
  constructor(settings) {
    this.settings = settings;
    this.chart = null;
  }

  /*
function update() {
  // Log current zoom level
  var min = yAxis.getPrivate("selectionMin");
  var max = yAxis.getPrivate("selectionMax");

  // Set up an event that would restore same zoom level to the axis
  series.events.once("datavalidated", function() {
    yAxis.zoomToValues(min, max);
  });
  // Update data
  series.data.setAll(data2);
}
  */

  createChart(weatherData, containerId = "chartContainer") {
    const self = this;

    if (this.chart) {
      this.chart.dispose();
    }

    const root = am5.Root.new(containerId);
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        layout: root.verticalLayout,
      }),
    );

    const xAxis = this.createXAxis(root, chart);
    const yAxis = this.createYAxis(root, chart);
    const yAxisRight = this.createYAxisRight(root, chart, yAxis);
    const windAxis = this.createWindAxis(root, chart);

    const tempSeries = this.createTemperatureSeries(root, chart, xAxis, yAxis);
    const windSeries = this.createWindSeries(root, chart, xAxis, windAxis);
    const precipSeries = this.createPrecipitationSeries(
      root,
      chart,
      xAxis,
      yAxisRight,
    );
    const sunSeries = this.createSunSeries(root, chart, xAxis, yAxisRight);

    const chartData = this.prepareChartData(weatherData);

    this.setSeriesData(
      [tempSeries, precipSeries, windSeries, sunSeries],
      chartData,
    );

    tempSeries.events.once("datavalidated", function (ev) {
      const firstDate = new Date(tempSeries.dataItems[0].dataContext.time);
      // lastDate is firstDate plus two days
      let delta = 2 * 24 * 60 * 60 * 1000;

      switch (self.settings.getForecastType()) {
        case "daily":
          delta = delta * 24;
          break;
        case "3-hourly":
          delta = delta * 3;
          break;
      }
      const lastDate = new Date(firstDate.getTime() + delta);

      ev.target.get("xAxis").zoomToDates(firstDate, lastDate);
    });

    this.setupBullets(
      root,
      tempSeries,
      windSeries,
      sunSeries,
      precipSeries,
      weatherData,
    );

    this.chart = root;
  }

  //
  // Axes
  //

  createXAxis(root, chart) {
    const forecastType = this.settings.getForecastType();

    let unitCount = 1;
    switch (forecastType) {
      case "daily":
        unitCount = 24;
        break;
      case "3-hourly":
        unitCount = 3;
        break;
    }

    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: {
          timeUnit: "hour",
          count: unitCount,
        },
        markUnitChange: true,
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 25,
          opposite: true,
          maxLabelPosition: 0.95,
          minLabelPosition: 0.05,
        }),
        zoomX: true,
        zoomY: false,
        extraMax: 0,
        extraMin: 0,
        // Position data points at the start of the interval
        startLocation: 0,
        endLocation: 1,
      }),
    );

    xAxis.get("dateFormats")["hour"] = "HH";
    xAxis.get("dateFormats")["day"] = "[bold]EEE[/]";
    xAxis.get("periodChangeDateFormats")["day"] = "[bold]EEE[/]";
    xAxis.get("periodChangeDateFormats")["hour"] = "[bold]EEE[/]";

    return xAxis;
  }

  createYAxis(root, chart) {
    return chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        extraMax: 0.05,
        extraMin: 0.45,
        visible: false,
        autoZoom: false,
        strictMinMax: true,
        renderer: am5xy.AxisRendererY.new(root, {
          strokeDasharray: [1, 3],
        }),
      }),
    );
  }

  createYAxisRight(root, chart, yAxis) {
    const newAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        max: 5,
        strictMinMax: true,
        autoZoom: false,
        visible: false,
        renderer: am5xy.AxisRendererY.new(root, {
          opposite: true,
          visible: false,
        }),
        //syncWithAxis: yAxis,
      }),
    );
    const yRenderer = newAxis.get("renderer");
    yRenderer.grid.template.set("forceHidden", true);

    return newAxis;
  }

  createWindAxis(root, chart) {
    const windAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        extraMax: 0.4,
        extraMin: 0.2,
        visible: false,
        strictMinMax: true,
        autoZoom: false,
        renderer: am5xy.AxisRendererY.new(root, {
          visible: false,
        }),
      }),
    );
    const yRenderer = windAxis.get("renderer");
    yRenderer.grid.template.set("forceHidden", true);

    return windAxis;
  }

  //
  // Series
  //

  createTemperatureSeries(root, chart, xAxis, yAxis) {
    const tempSeries = chart.series.push(
      am5xy.SmoothedXLineSeries.new(root, {
        name: `Temperature (${this.settings.getTemperatureUnit()})`,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "temperature",
        valueXField: "time",
        tension: 0.8,
        // Position bullets at the start of the interval
        locationX: 0,
      }),
    );

    tempSeries.strokes.template.setAll({
      strokeWidth: 3,
      templateField: "tempStrokeSettings",
    });

    return tempSeries;
  }

  createPrecipitationSeries(root, chart, xAxis, yAxis) {
    const precipSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Precipitation",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "precipitationBar",
        openValueYField: "precipitationBase",
        valueXField: "time",
        // Make segments span the full interval
        locationX: 0,
      }),
    );

    precipSeries.fills.template.setAll({
      fillOpacity: 0.2,
      visible: true,
      templateField: "precipFillSettings",
    });

    return precipSeries;
  }

  createSunSeries(root, chart, xAxis, yAxis) {
    const sunSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Sun",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "sunHoursBar",
        openValueYField: "sunHoursBase",
        valueXField: "time",
        // Make segments span the full interval
        locationX: 0,
      }),
    );

    sunSeries.fills.template.setAll({
      fillOpacity: 0.2,
      visible: true,
      templateField: "sunFillSettings",
    });

    return sunSeries;
  }

  createWindSeries(root, chart, xAxis, windAxis) {
    const windSeries = chart.series.push(
      am5xy.SmoothedXLineSeries.new(root, {
        name: "Wind Speed",
        xAxis: xAxis,
        yAxis: windAxis,
        valueXField: "time",
        valueYField: "windSpeed",
        openValueYField: "windBase",
        tension: 0.3,
        // Make segments span the full interval
        locationX: 0,
      }),
    );

    windSeries.strokes.template.setAll({
      strokeWidth: 3,
      strokeDasharray: [10, 5],
      templateField: "windStrokeSettings",
    });
    windSeries.fills.template.setAll({
      fillOpacity: 0.2,
      visible: true,
      templateField: "windFillSettings",
    });

    return windSeries;
  }

  gradientColor(value, min, max, colorLow, colorHigh) {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const toRgb = (c) => parseInt(c.slice(1), 16);
    const r1 = (toRgb(colorLow) >> 16) & 0xff,
      g1 = (toRgb(colorLow) >> 8) & 0xff,
      b1 = toRgb(colorLow) & 0xff;
    const r2 = (toRgb(colorHigh) >> 16) & 0xff,
      g2 = (toRgb(colorHigh) >> 8) & 0xff,
      b2 = toRgb(colorHigh) & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  prepareChartData(processedData) {
    return processedData.map((item) => ({
      time: item.time.getTime(),
      temperature: item.temperature,
      precipitation: item.precipitation,
      precipitationProb: item.precipitationProb,
      sunHours: item.sunHours,
      sunHoursBase: 0,
      sunHoursBar: 0.5,
      precipitationBase: 0.5,
      precipitationBar: 1,
      windBase: this.settings.getShowWindGusts() ? item.windSpeed : 0,
      windSpeed: this.settings.getShowWindGusts()
        ? item.windGusts
        : item.windSpeed,
      sunFillSettings: {
        fill: this.gradientColor(item.sunHours, 0, 50, "#888888", "#ffff22"),
      },
      tempStrokeSettings: {
        fill:
          item.temperature > 0 ? am5.color("#ff0000") : am5.color("#0000ff"),
        stroke:
          item.temperature > 0 ? am5.color("#ff0000") : am5.color("#0000ff"),
      },
      windStrokeSettings: {
        stroke: this.gradientColor(item.windSpeed, 0, 24, "#ffffff", "#ff0000"),
      },
      precipFillSettings: {
        stroke: item.precipitation < 0.01 ? "#FFFFFF" : "#afafaf",
        fill:
          item.precipitation < 0.01
            ? "#FFFFFF"
            : item.precipitation < 10
              ? this.gradientColor(
                  item.precipitation,
                  0,
                  10,
                  "#E0E0E0",
                  "#0000ff",
                )
              : this.gradientColor(
                  item.precipitation,
                  10,
                  25,
                  "#0000ff",
                  "#ff0000",
                ),
      },
    }));
  }

  setSeriesData(series, chartData) {
    series.forEach((s) => s.data.setAll(chartData));
  }

  setupBullets(
    root,
    tempSeries,
    windSeries,
    sunSeries,
    precipSeries,
    processedData,
  ) {
    this.labelPositions = [];
    this.visibleLabels = [];

    const addLabel = (container, text, centerX, centerY, dx, dy) => {
      const label = container.children.push(
        am5.Label.new(root, {
          text: text,
          centerX: centerX,
          centerY: centerY,
          dx: dx,
          dy: dy,
        }),
      );
      return label;
    };

    const addBullet = (
      targetSeries,
      extremaIndex,
      value,
      labelType,
      centerX = am5.p50,
      centerY = am5.p100,
    ) => {
      var seriesDataItem = targetSeries.dataItems[extremaIndex];

      if (seriesDataItem) {
        var bullet = am5.Container.new(root, {});

        var circle = bullet.children.push(
          am5.Circle.new(root, {
            radius: 3,
            fill: am5.color(0xffffff),
            stroke: targetSeries.get("stroke"),
            strokeWidth: 3,
            centerY: am5.p50,
            centerX: am5.p50,
          }),
        );

        var label = addLabel(bullet, value, centerX, centerY, 10, 0);

        this.labelPositions.push(label);
        this.visibleLabels.push(label);

        const bulletSprite = am5.Bullet.new(root, {
          sprite: bullet,
        });

        targetSeries.addBullet(seriesDataItem, bulletSprite);

        // Store label info for collision detection
        const labelInfo = {
          bullet: bullet,
          label: label,
          extremaIndex: extremaIndex,
          value: value,
          labelType: labelType,
          originalDy: 0,
          visible: true,
        };

        this.labelPositions.push(labelInfo);
        this.visibleLabels.push(labelInfo);
      }
    };

    // Wait for both series to be ready
    let tempReady = false;
    let windReady = false;

    const tryAddBullets = () => {
      // Sun label
      const sunContainer = am5.Container.new(root, {});
      const label = addLabel(sunContainer, "☀", am5.p0, am5.p50, 0, 7);
      const bulletSprite = am5.Bullet.new(root, {
        sprite: sunContainer,
      });
      sunSeries.addBullet(sunSeries.dataItems[0], bulletSprite);

      // Precipitation label
      const precipContainer = am5.Container.new(root, {});
      const precipLabel = addLabel(
        precipContainer,
        "⛈",
        am5.p0,
        am5.p50,
        0,
        7,
      );
      const precipBulletSprite = am5.Bullet.new(root, {
        sprite: precipContainer,
      });
      precipSeries.addBullet(precipSeries.dataItems[0], precipBulletSprite);

      if (tempReady && windReady) {
        // Add bullets based on extrema property
        processedData.forEach((dataPoint, index) => {
          if (dataPoint.extrema) {
            // Add temperature bullets
            if (
              dataPoint.extrema.isMinima?.includes("temperature") ||
              dataPoint.extrema.isMaxima?.includes("temperature")
            ) {
              const roundedValue = Math.round(dataPoint.temperature);
              const formattedValue = roundedValue + "°";
              addBullet(tempSeries, index, formattedValue, "temperature");
            }

            // Add wind bullets
            let windField = "windSpeed";
            if (this.settings.getShowWindGusts()) {
              windField = "windGusts";
            }

            if (
              dataPoint.extrema.isMinima?.includes(windField) ||
              dataPoint.extrema.isMaxima?.includes(windField)
            ) {
              const roundedValue = Math.round(dataPoint[windField]);
              const formattedValue =
                roundedValue + " " + this.settings.getWindSpeedUnit();
              addBullet(windSeries, index, formattedValue, "wind");
            }
          }
        });

        // Add precipitation bullets for grouped totals
        processedData.forEach((dataPoint, index) => {
          if (dataPoint.precipitationGroupTotal) {
            const roundedValue = Math.round(dataPoint.precipitationGroupTotal);
            const formattedValue =
              roundedValue === 0 ? "" : roundedValue + " mm";
            if (formattedValue) {
              addBullet(
                precipSeries,
                index,
                formattedValue,
                "precipitation",
                am5.p50,
                am5.p0,
              );
            }
          }
        });
      }
    };

    tempSeries.events.once("datavalidated", () => {
      tempReady = true;
      tryAddBullets();
    });

    windSeries.events.once("datavalidated", () => {
      windReady = true;
      tryAddBullets();
    });
  }

  dispose() {
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
  }
}
