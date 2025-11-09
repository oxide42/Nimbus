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
    if (this.chart2) {
      this.chart2.dispose();
    }

    // Create first chart in chartContainer
    const root = am5.Root.new(containerId);
    root.setThemes([am5themes_Animated.new(root)]);

    // First chart (temperature, wind, sun, precipitation)
    const chart1 = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        layout: root.verticalLayout,
      }),
    );

    const xAxis1 = this.createXAxis(root, chart1);
    const yAxis1 = this.createYAxis(root, chart1);
    const yAxisRight1 = this.createYAxisRight(root, chart1, yAxis1);
    const windAxis = this.createWindAxis(root, chart1);

    const tempSeries = this.createTemperatureSeries(
      root,
      chart1,
      xAxis1,
      yAxis1,
    );
    const windSeries = this.createWindSeries(root, chart1, xAxis1, windAxis);

    // Create second chart in chartContainer2
    const root2 = am5.Root.new("chartContainer2");
    root2.setThemes([am5themes_Animated.new(root2)]);

    // Second chart (additional data visualization)
    const chart2 = root2.container.children.push(
      am5xy.XYChart.new(root2, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        pinchZoomX: false,
        layout: root2.verticalLayout,
      }),
    );

    chart2.zoomOutButton.set("forceHidden", true);

    // Create x-axis for second chart and sync with first chart
    const xAxis2 = this.createXAxis(root2, chart2);

    // Hide x-axis for chart2
    xAxis2.get("renderer").labels.template.set("forceHidden", true);
    xAxis2.get("renderer").grid.template.set("forceHidden", true);

    const yAxis2 = this.createYAxis(root2, chart2);
    const yAxisRight2 = this.createYAxisRight(root2, chart2, yAxis2);

    // Link the x-axes for synchronized zooming and panning (one-way sync)
    // Use chart events instead of axis events for better reliability
    chart1.events.on("wheelended", function () {
      const start = xAxis1.get("start", 0);
      const end = xAxis1.get("end", 1);
      xAxis2.set("start", start);
      xAxis2.set("end", end);
    });

    chart1.events.on("panended", function () {
      const start = xAxis1.get("start", 0);
      const end = xAxis1.get("end", 1);
      xAxis2.set("start", start);
      xAxis2.set("end", end);
    });

    // Add precipitation and sun series to second chart
    const precipSeries2 = this.createPrecipitationSeries(
      root2,
      chart2,
      xAxis2,
      yAxisRight2,
    );
    const sunSeries = this.createSunSeries(root2, chart2, xAxis2, yAxisRight2);

    const chartData = this.prepareChartData(weatherData);

    this.setSeriesData(
      [tempSeries, windSeries, precipSeries2, sunSeries],
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
      xAxis2.zoomToDates(firstDate, lastDate);
    });

    // Setup bullets for each series
    this.setupBullets(root, tempSeries, weatherData, "temperature");
    this.setupBullets(root, windSeries, weatherData, "wind");
    this.setupBullets(root2, sunSeries, weatherData, "sun");
    this.setupBullets(root2, precipSeries2, weatherData, "precipitation");

    this.chart = root;
    this.chart2 = root2;
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
          minGridDistance: 22,
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
        max: 1,
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
    let precipMin = "#FFFFFF";
    let windMin = "#FFFFFF";

    if (this.settings.getDarkMode()) {
      let chartElement = document.getElementById("chartContainer");
      precipMin = window.getComputedStyle(chartElement).backgroundColor;
      windMin = "#808080";
    }

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
        stroke: this.gradientColor(item.windSpeed, 0, 24, windMin, "#ff0000"),
      },
      precipFillSettings: {
        stroke: item.precipitation < 0.01 ? precipMin : "#afafaf",
        fill:
          item.precipitation < 0.01
            ? precipMin
            : item.precipitation < 10
              ? this.gradientColor(
                  item.precipitation,
                  0,
                  10,
                  "#A0A0A0",
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

  setupBullets(root, series, processedData, seriesType) {
    if (!this.labelPositions) {
      this.labelPositions = [];
      this.visibleLabels = [];
    }

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

    series.events.once("datavalidated", () => {
      // Add icon label at the start
      if (seriesType === "sun") {
        const container = am5.Container.new(root, {});
        const label = addLabel(container, "☀", am5.p0, am5.p50, 0, 7);
        const bulletSprite = am5.Bullet.new(root, {
          sprite: container,
        });
        series.addBullet(series.dataItems[0], bulletSprite);
      } else if (seriesType === "precipitation") {
        const container = am5.Container.new(root, {});
        const label = addLabel(container, "⛈", am5.p0, am5.p50, 0, 7);
        const bulletSprite = am5.Bullet.new(root, {
          sprite: container,
        });
        series.addBullet(series.dataItems[0], bulletSprite);
      }

      // Add extrema bullets
      processedData.forEach((dataPoint, index) => {
        if (dataPoint.extrema) {
          if (seriesType === "temperature") {
            // Add temperature bullets
            if (
              dataPoint.extrema.isMinima?.includes("temperature") ||
              dataPoint.extrema.isMaxima?.includes("temperature")
            ) {
              const roundedValue = Math.round(dataPoint.temperature);
              const formattedValue = roundedValue + "°";
              addBullet(series, index, formattedValue, "temperature");
            }
          } else if (seriesType === "wind") {
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
              addBullet(series, index, formattedValue, "wind");
            }
          }
        }

        // Add precipitation group totals
        if (
          seriesType === "precipitation" &&
          dataPoint.precipitationGroupTotal
        ) {
          const roundedValue = Math.round(dataPoint.precipitationGroupTotal);
          const formattedValue = roundedValue === 0 ? "" : roundedValue + " mm";
          if (formattedValue) {
            addBullet(
              series,
              index,
              formattedValue,
              "precipitation",
              am5.p50,
              am5.p0,
            );
          }
        }
      });
    });
  }

  dispose() {
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
    if (this.chart2) {
      this.chart2.dispose();
      this.chart2 = null;
    }
  }
}
