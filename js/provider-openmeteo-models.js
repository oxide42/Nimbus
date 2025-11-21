/**
 * Open-Meteo Weather Models Provider
 * Contains available weather models for the Open-Meteo API
 */

const OpenMeteoModels = {
  models: [
    { value: "auto", label: "Best Match" },
    { value: "bom_access_global", label: "BOM Australia" },
    { value: "cma_grapes_global", label: "CMA China" },
    { value: "dmi_seamless", label: "DMI Denmark" },
    { value: "icon_seamless", label: "DWD Germany" },
    { value: "ecmwf_ifs04", label: "ECMWF" },
    { value: "gem_seamless", label: "GEM Canada" },
    { value: "italia_meteo_arpae_icon_2i", label: "ItaliaMeteo" },
    { value: "jma_seamless", label: "JMA Japan" },
    { value: "kma_seamless", label: "KMA Korea" },
    { value: "knmi_seamless", label: "KNMI Netherlands" },
    { value: "metno_seamless", label: "MET Norway" },
    { value: "meteofrance_seamless", label: "Météo-France" },
    { value: "meteoswiss_seamless", label: "MeteoSwiss" },
    { value: "gfs_seamless", label: "NOAA U.S." },
    { value: "ukmo_seamless", label: "UK Met Office" },
  ],

  /**
   * Get all available models
   * @returns {Array} Array of model objects with value and label properties
   */
  getModels() {
    return this.models;
  },

  /**
   * Populate a select element with the available models
   * @param {string|HTMLElement} selectElement - The select element or its ID
   */
  populateSelect(selectElement) {
    const select =
      typeof selectElement === "string"
        ? document.getElementById(selectElement)
        : selectElement;

    if (!select) {
      console.error("Select element not found");
      return;
    }

    // Clear existing options
    select.innerHTML = "";

    // Add all model options
    this.models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.label;
      select.appendChild(option);
    });
  },
};
