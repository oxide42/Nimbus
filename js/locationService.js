class LocationService {
  constructor(settings) {
    this.settings = settings;
    this.cache = Cache.getInstance();
  }

  truncateCoordinates(lat, lon) {
    return {
      latitude: Math.round(lat * 100) / 100,
      longitude: Math.round(lon * 100) / 100,
    };
  }

  async getCurrentPosition() {
    // Check cache first
    const cachedPosition = this.cache.getItem("location_position");
    if (cachedPosition) {
      return cachedPosition;
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Truncate coordinates to 2 decimals
          const truncated = this.truncateCoordinates(
            position.coords.latitude,
            position.coords.longitude,
          );

          const processedPosition = {
            coords: truncated,
          };

          const expiryTime =
            Date.now() +
            this.settings.settings.locationCacheMinutes * 60 * 1000;
          this.cache.setItem(
            "location_position",
            processedPosition,
            expiryTime,
          );

          resolve(processedPosition);
        },
        (error) => {
          if (error.code === error.POSITION_UNAVAILABLE) {
            // Fallback to Kolding, Denmark coordinates (also truncated)
            const fallbackPosition = {
              coords: this.truncateCoordinates(55.4904, 9.4721),
            };

            const expiryTime =
              Date.now() +
              this.settings.settings.locationCacheMinutes * 60 * 1000;
            this.cache.setItem(
              "location_position",
              fallbackPosition,
              expiryTime,
              this.cacheVersion,
            );

            resolve(fallbackPosition);
            return;
          }

          let message;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = "Location access denied by user";
              break;
            case error.TIMEOUT:
              message = "Location request timed out";
              break;
            default:
              message = "An unknown error occurred while retrieving location";
              break;
          }
          reject(new Error(`Failed to fetch position: ${message}`));
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        },
      );
    });
  }

  async getCurrentPlaceName(lat, lon) {
    // Create cache key based on truncated coordinates
    const truncated = this.truncateCoordinates(lat, lon);
    const cacheKey = `place_name_${truncated.latitude}_${truncated.longitude}`;

    // Check cache first
    const cachedPlaceName = this.cache.getItem(cacheKey, this.cacheVersion);
    if (cachedPlaceName) {
      return cachedPlaceName;
    }

    try {
      // Reverse address lookup with CORS proxy
      const addressUrl = "https://nominatim.openstreetmap.org/reverse";
      const addressParams = {
        lat: lat,
        lon: lon,
        extratags: 0,
        addressdetails: 1,
        format: "json",
      };

      const proxyUrl = "https://corsproxy.io/?";
      const targetUrl = addressUrl + "?" + new URLSearchParams(addressParams);

      const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      let placeName;
      if (data.address) {
        placeName =
          data.address.city ||
          data.address.municipality ||
          data.address.town ||
          data.address.village ||
          "Unknown location";
      } else {
        placeName = "Unknown location";
      }

      // Cache the place name with expiration
      const expiryTime =
        Date.now() + this.settings.settings.locationCacheMinutes * 60 * 1000;
      this.cache.setItem(cacheKey, placeName, expiryTime, this.cacheVersion);

      return placeName;
    } catch (error) {
      console.error("Error fetching place name:", error);
      return "Unknown location";
    }
  }

  clearCache() {
    this.locationCache = null;
    this.cache.removeItem("location_position");
    // Clear all place name caches (would need to track keys for full implementation)
  }
}
