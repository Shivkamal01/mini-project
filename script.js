    const apiKey = "b1fd6e14799699504191b6bdbcadfc35"; // replace if you want
    const searchBtn = document.getElementById("search-btn");
    const locationBtn = document.getElementById("location-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const unitToggle = document.getElementById("unit-toggle");
    const cityInput = document.getElementById("city-input");
    const suggestionList = document.getElementById("suggestion-list");
    const pinBtn = document.getElementById("pin-btn");
    const pinnedList = document.getElementById("pinned-list");

    let isCelsius = true; // Default to Celsius

    const cityNameEl = document.querySelector(".city-name");
    const temperatureEl = document.querySelector(".temperature");
    const conditionEl = document.querySelector(".condition");
    const humidityEl = document.getElementById("humidity");
    const windEl = document.getElementById("wind");
    const pressureEl = document.getElementById("pressure");
    const visibilityEl = document.getElementById("visibility");
    const feelsLikeEl = document.getElementById("feels-like");
    const weatherIcon = document.querySelector(".weather-icon");
    const forecastGrid = document.getElementById("forecast-grid");

    let currentLat, currentLon, currentName; // To store current location for pinning

    // Function to map OpenWeather icon codes to FontAwesome classes
    function getWeatherIcon(iconCode) {
      const map = {
        '01d': 'fas fa-sun', // clear sky day
        '01n': 'fas fa-moon', // clear sky night
        '02d': 'fas fa-cloud-sun', // few clouds day
        '02n': 'fas fa-cloud-moon', // few clouds night
        '03d': 'fas fa-cloud', // scattered clouds
        '03n': 'fas fa-cloud',
        '04d': 'fas fa-cloud', // broken clouds
        '04n': 'fas fa-cloud',
        '09d': 'fas fa-cloud-rain', // shower rain
        '09n': 'fas fa-cloud-rain',
        '10d': 'fas fa-cloud-sun-rain', // rain day
        '10n': 'fas fa-cloud-moon-rain', // rain night
        '11d': 'fas fa-bolt', // thunderstorm
        '11n': 'fas fa-bolt',
        '13d': 'fas fa-snowflake', // snow
        '13n': 'fas fa-snowflake',
        '50d': 'fas fa-smog', // mist
        '50n': 'fas fa-smog'
      };
      return map[iconCode] || 'fas fa-question';
    }

    // Helper: show suggestions container only when non-empty
    function showSuggestions(show) {
      suggestionList.style.display = show ? "block" : "none";
      suggestionList.setAttribute("aria-hidden", !show);
    }

    // Fetch suggestions from Geocoding API
    let suggestionTimeout = null;
    cityInput.addEventListener("input", () => {
      const q = cityInput.value.trim();
      clearTimeout(suggestionTimeout);
      if (q.length < 2) {
        suggestionList.innerHTML = "";
        showSuggestions(false);
        return;
      }
      // debounce to avoid too many requests
      suggestionTimeout = setTimeout(() => fetchCitySuggestions(q), 300);
    });

    async function fetchCitySuggestions(query) {
      console.log("Fetching suggestions for query:", query);
      try {
        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=6&appid=${apiKey}`;
        console.log("Request URL:", url);
        const res = await fetch(url);
        console.log("Response status:", res.status);
        if (!res.ok) {
          console.error("API response not ok:", res.status, res.statusText);
          suggestionList.innerHTML = "";
          showSuggestions(false);
          return;
        }
        const cities = await res.json();
        console.log("Cities received:", cities);
        suggestionList.innerHTML = "";

        if (!cities || cities.length === 0) {
          console.log("No cities found");
          showSuggestions(false);
          return;
        }

        cities.forEach(city => {
          const label = `${city.name}${city.state ? ', ' + city.state : ''}, ${city.country}`;
          console.log("Adding suggestion:", label);
          const item = document.createElement("div");
          item.className = "suggestion-item";
          item.innerHTML = `<span>${label}</span><small>lat:${city.lat.toFixed(2)}, lon:${city.lon.toFixed(2)}</small>`;

          // Click: set input, hide list, and fetch by coords for accuracy
          item.addEventListener("click", () => {
            cityInput.value = label;
            suggestionList.innerHTML = "";
            showSuggestions(false);
            // Use coords (lat/lon) to get exact weather
            getWeatherByCoords(city.lat, city.lon, label);
          });

          suggestionList.appendChild(item);
        });

        showSuggestions(true);
        console.log("Suggestions displayed");
      } catch (err) {
        console.error("Suggestion fetch error:", err);
        if (err instanceof TypeError) {
          suggestionList.innerHTML = "<div class='suggestion-item'>Network error. Unable to load suggestions.</div>";
          showSuggestions(true);
        } else {
          console.error("Suggestion error:", err);
          suggestionList.innerHTML = "";
          showSuggestions(false);
        }
      }
    }

    // Click search or Enter => prefer using typed text (fallback to name search)
    searchBtn.addEventListener("click", () => {
      const city = cityInput.value.trim();
      if (!city) return;
      // If the user typed a label like "City, State, CC" we can call direct name search.
      // Simpler: call geocoding once to get coords, then fetch by coords.
      resolveCityAndFetch(city);
      suggestionList.innerHTML = "";
      showSuggestions(false);
    });

    cityInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const city = cityInput.value.trim();
        if (!city) return;
        resolveCityAndFetch(city);
        suggestionList.innerHTML = "";
        showSuggestions(false);
      }
    });

    // Resolve typed text to coords (try direct geocode) then fetch by coords
    async function resolveCityAndFetch(typed) {
      try {
        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(typed)}&limit=1&appid=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Geocode failed");
        const arr = await res.json();
        if (arr.length === 0) {
          alert("City not found. Try a different name or use the suggestions.");
          return;
        }
        const c = arr[0];
        const label = `${c.name}${c.state ? ', ' + c.state : ''}, ${c.country}`;
        getWeatherByCoords(c.lat, c.lon, label);
      } catch (err) {
        if (err instanceof TypeError) {
          alert("Network error. Please check your internet connection.");
        } else {
          console.error("Resolve error:", err);
          alert("Unable to find city. Try again.");
        }
      }
    }

    // Fetch weather by coordinates (more reliable)
    async function getWeatherByCoords(lat, lon, displayName) {
      const weatherSpinner = document.getElementById("weather-spinner");
      const weatherContent = document.getElementById("weather-content");

      // Show loading
      weatherSpinner.style.display = "block";
      weatherContent.style.display = "none";

      try {
        const units = isCelsius ? 'metric' : 'imperial';
        const weatherURL = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;
        const res = await fetch(weatherURL);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Weather fetch failed");

        cityNameEl.textContent = displayName || `${data.name}, ${data.sys.country}`;
        const tempUnit = isCelsius ? '°C' : '°F';
        const windUnit = isCelsius ? 'km/h' : 'mph';
        temperatureEl.textContent = `${Math.round(data.main.temp)}${tempUnit}`;
        conditionEl.textContent = data.weather[0].main;
        humidityEl.textContent = `${data.main.humidity}%`;
        windEl.textContent = `${(data.wind.speed * (isCelsius ? 3.6 : 2.237)).toFixed(1)} ${windUnit}`; // Convert m/s to km/h or mph
        pressureEl.textContent = `${data.main.pressure} hPa`;
        visibilityEl.textContent = `${(data.visibility / 1000).toFixed(1)} km`; // meters to km
        feelsLikeEl.textContent = `${Math.round(data.main.feels_like)}${tempUnit}`;

        const iconCode = data.weather[0].icon;
        const iconClass = getWeatherIcon(iconCode);
        weatherIcon.innerHTML = `<i class="${iconClass}"></i>`;

        // Store current location for pinning
        currentLat = lat;
        currentLon = lon;
        currentName = displayName;

        // Calculate local time at the location using timezone offset
        const localTime = new Date((data.dt + data.timezone) * 1000);
        const localHour = localTime.getUTCHours();

        changeBackground(data.weather[0].main.toLowerCase(), localHour);

        // Fetch AQI data
        getAQI(lat, lon);

        // Hide loading, show content
        weatherSpinner.style.display = "none";
        weatherContent.style.display = "block";

        // Forecast using forecast endpoint with lat/lon (we still use q optional but lat/lon is better)
        getForecastByCoords(lat, lon);
      } catch (err) {
        console.error("getWeatherByCoords error:", err);
        weatherSpinner.style.display = "none";
        weatherContent.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${err instanceof TypeError ? "Network error. Please check your connection." : "Unable to load weather data."}</p>
            <button class="retry-btn" onclick="getWeatherByCoords(${lat}, ${lon}, '${displayName}')">Retry</button>
          </div>
        `;
        weatherContent.style.display = "block";
        forecastGrid.innerHTML = "";
      }
    }

    async function getForecastByCoords(lat, lon) {
      const forecastSpinner = document.getElementById("forecast-spinner");
      const forecastContent = document.getElementById("forecast-content");

      // Show loading
      forecastSpinner.style.display = "block";
      forecastContent.style.display = "none";

      try {
        // Use the 5 day / 3 hour forecast endpoint with lat/lon via 'forecast' (it accepts lat & lon)
        const units = isCelsius ? 'metric' : 'imperial';
        const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;
        const res = await fetch(forecastURL);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Forecast failed");

        forecastGrid.innerHTML = "";
        // Show one item per ~24 hours: pick entries at 12:00 if possible, otherwise every 8 items
        const shown = {};
        for (let i = 0; i < data.list.length; i++) {
          const item = data.list[i];
          // choose midday entries first
          if (item.dt_txt.includes("12:00:00")) {
            const date = new Date(item.dt_txt);
            const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
            if (!shown[dayName]) {
              appendForecastCard(item, dayName);
              shown[dayName] = true;
            }
          }
        }
        // If less than 5 days picked, fallback to every 8th item
        if (Object.keys(shown).length < 5) {
          for (let i = 0; i < data.list.length; i += 8) {
            const item = data.list[i];
            const date = new Date(item.dt_txt);
            const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
            if (!shown[dayName]) {
              appendForecastCard(item, dayName);
              shown[dayName] = true;
            }
            if (Object.keys(shown).length >= 5) break;
          }
        }

        // Hide loading, show content
        forecastSpinner.style.display = "none";
        forecastContent.style.display = "block";
      } catch (err) {
        console.error("Forecast error:", err);
        forecastSpinner.style.display = "none";
        forecastContent.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${err instanceof TypeError ? "Network error. Unable to load forecast." : "Unable to load forecast data."}</p>
            <button class="retry-btn" onclick="getForecastByCoords(${lat}, ${lon})">Retry</button>
          </div>
        `;
        forecastContent.style.display = "block";
      }
    }

    function appendForecastCard(item, dayName) {
      const iconCode = item.weather[0].icon;
      const iconClass = getWeatherIcon(iconCode);
      const temp = Math.round(item.main.temp);
      const tempUnit = isCelsius ? '°C' : '°F';
      const card = document.createElement("div");
      card.className = "day-card";
      card.innerHTML = `
        <p>${dayName}</p>
        <i class="${iconClass} forecast-icon"></i>
        <p>${temp}${tempUnit}</p>
      `;
      forecastGrid.appendChild(card);
    }

    function changeBackground(weatherType, localHour) {
      const body = document.body;
      const isDay = localHour >= 6 && localHour < 18; // Day: 6 AM to 6 PM based on location's local time
      const dayNightIcon = document.getElementById("day-night-icon");

      if (isDay) {
        // Day background
        body.className = 'day';
        body.style.background = "url('https://miro.medium.com/1*GsImz-edoeuqCMfKxDus0w.jpeg') no-repeat center center fixed";
        body.style.backgroundSize = "cover";
        dayNightIcon.className = "day";
        dayNightIcon.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        // Night background
        body.className = 'night';
        body.style.background = "url('https://videocdn.cdnpk.net/videos/fd28bdb5-98d7-55fd-b166-956c1ee789bb/horizontal/thumbnails/large.jpg') no-repeat center center fixed";
        body.style.backgroundSize = "cover";
        dayNightIcon.className = "night";
        dayNightIcon.innerHTML = '<i class="fas fa-moon"></i>';
      }
    }

    // Location button: get current location
    locationBtn.addEventListener("click", () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            try {
              // Reverse geocode to get city name
              const geoURL = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
              const geoRes = await fetch(geoURL);
              const geoData = await geoRes.json();
              if (geoData.length > 0) {
                const city = geoData[0];
                const displayName = `${city.name}${city.state ? ', ' + city.state : ''}, ${city.country}`;
                getWeatherByCoords(lat, lon, displayName);
              } else {
                getWeatherByCoords(lat, lon, "Your Location");
              }
            } catch (err) {
              if (err instanceof TypeError) {
                console.error("Network error in reverse geocode:", err);
              } else {
                console.error("Reverse geocode error:", err);
              }
              getWeatherByCoords(lat, lon, "Your Location");
            }
            suggestionList.innerHTML = "";
            showSuggestions(false);
          },
          (error) => {
            console.error("Geolocation error:", error);
            alert("Unable to get your location. Please allow location access.");
          }
        );
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    });

    // hide suggestions if clicked outside
    document.addEventListener("click", (e) => {
      if (!document.getElementById("suggestions-wrap").contains(e.target)) {
        suggestionList.innerHTML = "";
        showSuggestions(false);
      }
    });

    // Favorite locations management
    function loadFavorites() {
      const favorites = JSON.parse(localStorage.getItem('weatherFavorites')) || [];
      return favorites;
    }

    function saveFavorites(favorites) {
      localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
    }

    function addFavorite(name, lat, lon) {
      const favorites = loadFavorites();
      if (favorites.length >= 3) {
        alert("You can only pin up to 3 locations.");
        return false;
      }
      // Check if already exists
      const exists = favorites.some(fav => fav.name === name);
      if (exists) {
        alert("This location is already pinned.");
        return false;
      }
      favorites.push({ name, lat, lon });
      saveFavorites(favorites);
      displayFavorites();
      return true;
    }

    function removeFavorite(name) {
      const favorites = loadFavorites();
      const updated = favorites.filter(fav => fav.name !== name);
      saveFavorites(updated);
      displayFavorites();
    }

    function displayFavorites() {
      const favorites = loadFavorites();
      pinnedList.innerHTML = "";
      favorites.forEach(fav => {
        const item = document.createElement("div");
        item.className = "pinned-item";
        item.innerHTML = `
          <button class="pinned-btn">${fav.name}</button>
          <button class="remove-btn" title="Remove"><i class="fas fa-times"></i></button>
        `;
        item.querySelector(".pinned-btn").addEventListener("click", () => {
          getWeatherByCoords(fav.lat, fav.lon, fav.name);
        });
        item.querySelector(".remove-btn").addEventListener("click", () => {
          removeFavorite(fav.name);
        });
        pinnedList.appendChild(item);
      });
    }

    // Pin button event
    pinBtn.addEventListener("click", () => {
      if (currentName && currentLat && currentLon) {
        addFavorite(currentName, currentLat, currentLon);
      } else {
        alert("No location to pin. Please search for a city first.");
      }
    });

    // Load favorites on start
    displayFavorites();

    // Unit toggle event
    unitToggle.addEventListener("click", () => {
      isCelsius = !isCelsius;
      unitToggle.textContent = isCelsius ? "°C" : "°F";
      localStorage.setItem('unitPreference', isCelsius ? 'celsius' : 'fahrenheit');
      // Refresh current weather display
      if (currentLat && currentLon) {
        getWeatherByCoords(currentLat, currentLon, currentName);
      }
    });

    // Load unit preference from localStorage
    const savedUnit = localStorage.getItem('unitPreference');
    if (savedUnit === 'fahrenheit') {
      isCelsius = false;
      unitToggle.textContent = "°F";
    }

    // Voice search event
    voiceBtn.addEventListener("click", () => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Voice search is not supported in this browser.");
        return;
      }
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        voiceBtn.style.background = '#e74c3c';
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        cityInput.value = transcript;
        resolveCityAndFetch(transcript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        alert("Voice recognition failed. Please try again.");
      };

      recognition.onend = () => {
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.style.background = '#27ae60';
      };

      recognition.start();
    });

    // Function to get AQI data
    async function getAQI(lat, lon) {
      const aqiEl = document.getElementById("aqi");
      const pm25El = document.getElementById("pm25");
      const pm10El = document.getElementById("pm10");
      const aqiBox = document.getElementById("aqi-box");

      try {
        const aqiURL = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
        const res = await fetch(aqiURL);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "AQI fetch failed");

        const aqi = data.list[0].main.aqi;
        const components = data.list[0].components;

        // AQI levels: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor
        const aqiLabels = {
          1: { label: "Good", class: "aqi-good" },
          2: { label: "Fair", class: "aqi-moderate" },
          3: { label: "Moderate", class: "aqi-moderate" },
          4: { label: "Poor", class: "aqi-unhealthy" },
          5: { label: "Very Poor", class: "aqi-very-unhealthy" },
          6: { label: "Hazardous", class: "aqi-hazardous" }
        };

        const aqiInfo = aqiLabels[aqi] || { label: "Unknown", class: "" };
        aqiEl.textContent = aqiInfo.label;
        aqiEl.className = aqiInfo.class;

        pm25El.textContent = components.pm2_5.toFixed(1);
        pm10El.textContent = components.pm10.toFixed(1);

        // Remove loading text
        aqiBox.querySelector("p").textContent = `AQI: ${aqiInfo.label}`;
      } catch (err) {
        console.error("AQI error:", err);
        aqiEl.textContent = "N/A";
        pm25El.textContent = "--";
        pm10El.textContent = "--";
        aqiBox.querySelector("p").textContent = "AQI: N/A";
      }
    }

    // Load default city on start
    getWeatherByCoords(40.7128, -74.0060, "New York, US");
