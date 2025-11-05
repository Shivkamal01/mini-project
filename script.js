const apiKey = "b1fd6e14799699504191b6bdbcadfc35"; // replace if you want
    const searchBtn = document.getElementById("search-btn");
    const cityInput = document.getElementById("city-input");
    const suggestionList = document.getElementById("suggestion-list");

    const cityNameEl = document.querySelector(".city-name");
    const temperatureEl = document.querySelector(".temperature");
    const conditionEl = document.querySelector(".condition");
    const humidityEl = document.getElementById("humidity");
    const windEl = document.getElementById("wind");
    const weatherIcon = document.querySelector(".weather-icon");
    const forecastGrid = document.getElementById("forecast-grid");

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
      try {
        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=6&appid=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) {
          suggestionList.innerHTML = "";
          showSuggestions(false);
          return;
        }
        const cities = await res.json();
        suggestionList.innerHTML = "";

        if (!cities || cities.length === 0) {
          showSuggestions(false);
          return;
        }

        cities.forEach(city => {
          const label = `${city.name}${city.state ? ', ' + city.state : ''}, ${city.country}`;
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
      } catch (err) {
        console.error("Suggestion error:", err);
        suggestionList.innerHTML = "";
        showSuggestions(false);
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
        console.error("Resolve error:", err);
        alert("Unable to find city. Try again.");
      }
    }

    // Fetch weather by coordinates (more reliable)
    async function getWeatherByCoords(lat, lon, displayName) {
      try {
        const weatherURL = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
        const res = await fetch(weatherURL);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Weather fetch failed");

        cityNameEl.textContent = displayName || `${data.name}, ${data.sys.country}`;
        temperatureEl.textContent = `${Math.round(data.main.temp)}°C`;
        conditionEl.textContent = data.weather[0].main;
        humidityEl.textContent = `${data.main.humidity}%`;
        windEl.textContent = `${(data.wind.speed * 3.6).toFixed(1)} km/h`; // m/s -> km/h

        const iconCode = data.weather[0].icon;
        weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

        changeBackground(data.weather[0].main.toLowerCase());

        // Forecast using forecast endpoint with lat/lon (we still use q optional but lat/lon is better)
        getForecastByCoords(lat, lon);
      } catch (err) {
        console.error("getWeatherByCoords error:", err);
        cityNameEl.textContent = "City not found";
        temperatureEl.textContent = "--°C";
        conditionEl.textContent = "--";
        humidityEl.textContent = "--%";
        windEl.textContent = "-- km/h";
        weatherIcon.src = "https://cdn-icons-png.flaticon.com/512/565/565860.png";
        forecastGrid.innerHTML = "";
      }
    }

    async function getForecastByCoords(lat, lon) {
      try {
        // Use the 5 day / 3 hour forecast endpoint with lat/lon via 'forecast' (it accepts lat & lon)
        const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
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
      } catch (err) {
        console.error("Forecast error:", err);
        forecastGrid.innerHTML = "";
      }
    }

    function appendForecastCard(item, dayName) {
      const iconCode = item.weather[0].icon;
      const temp = Math.round(item.main.temp);
      const card = document.createElement("div");
      card.className = "day-card";
      card.innerHTML = `
        <p>${dayName}</p>
        <img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="${item.weather[0].main}">
        <p>${temp}°C</p>
      `;
      forecastGrid.appendChild(card);
    }

    function changeBackground(weatherType) {
      const body = document.body;
      if (weatherType.includes("cloud")) {
        body.style.background = "linear-gradient(to bottom, #bdc3c7, #2c3e50)";
      } else if (weatherType.includes("rain")) {
        body.style.background = "linear-gradient(to bottom, #667db6, #0082c8)";
      } else if (weatherType.includes("clear")) {
        body.style.background = "linear-gradient(to bottom, #2980b9, #6dd5fa)";
      } else if (weatherType.includes("snow")) {
        body.style.background = "linear-gradient(to bottom, #e6dada, #274046)";
      } else {
        body.style.background = "linear-gradient(to bottom, #757f9a, #d7dde8)";
      }
    }

    // hide suggestions if clicked outside
    document.addEventListener("click", (e) => {
      if (!document.getElementById("suggestions-wrap").contains(e.target)) {
        suggestionList.innerHTML = "";
        showSuggestions(false);
      }
    });

    // Load default city on start
    getWeatherByCoords(40.7128, -74.0060, "New York, US");