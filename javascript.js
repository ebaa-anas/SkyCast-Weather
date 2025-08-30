
/* 
   - Current, hourly (24h), daily (7d)
   - Geolocation + search
   - Dynamic background by weather
   - °C/°F toggle (client-side conversion)
*/

(() => {
    // ------------------ CONFIG ------------------
    const API_KEY = "81489214fd183bb3bbe266a426d73176";
    const ICON = (id) => `https://openweathermap.org/img/wn/${id}@2x.png`;

    // DOM ------------------------
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];

    const weekdayEl = $('#weekday');
    const dateTimeEl = $('#dateTime');
    const placeEl = $('#place');
    const tempEl = $('#temp');
    const summaryEl = $('#summary');
    const precipEl = $('#precip');
    const humidityEl = $('#humidity');
    const windEl = $('#wind');
    const heroIcon = $('#heroIcon');

    const daysWrap = $('#days');
    const hoursWrap = $('#hours');

    const changeBtn = $('#changeBtn');
    const changeBtn2 = $('#changeBtn2');
    const detectBtn = $('#detectBtn');

    const cBtn = $('#cBtn');
    const fBtn = $('#fBtn');

    const searchModal = $('#searchModal');
    const resultsEl = $('#results');

    const dayTpl = $('#dayTpl');
    const hourTpl = $('#hourTpl');

    // ------------------ STATE -------------------
    let unit = 'c'; // 'c' or 'f'
    let state = {
        coords: null,
        locationLabel: '',
        data: null // OWM OneCall data (metric base)
    };

    // -------------- HELPERS ---------------------
    const toF = c => c * 9 / 5 + 32;
    const asUnit = c => unit === 'c' ? `${Math.round(c)}°C` : `${Math.round(toF(c))}°F`;
    const kmh = ms => ms * 3.6;
    const windAsUnit = ms => `${Math.round(kmh(ms))} km/h`;
    const dayName = d => d.toLocaleDateString(undefined, { weekday: 'long' });
    const shortDay = d => d.toLocaleDateString(undefined, { weekday: 'short' });
    const timeHM = d => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    function setThemeFromWeather(main) {
        const m = (main || '').toLowerCase();
        let theme = 'theme-clouds';
        if (m.includes('clear')) theme = 'theme-clear';
        else if (m.includes('cloud')) theme = 'theme-clouds';
        else if (m.includes('rain') || m.includes('drizzle')) theme = 'theme-rain';
        else if (m.includes('thunder')) theme = 'theme-thunder';
        else if (m.includes('snow')) theme = 'theme-snow';
        else if (m.includes('fog') || m.includes('mist') || m.includes('haze')) theme = 'theme-fog';
        document.body.className = theme;
    }
/* Background img*/
function updateBackground(weatherCondition) {
    let backgroundUrl = "";
  
    if (weatherCondition.includes("clear")) {
      backgroundUrl = "images/clear.avif"; 
    } else if (weatherCondition.includes("cloud")) {
      backgroundUrl = "https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?auto=format&fit=crop&w=1600&q=80";
    } else if (weatherCondition.includes("rain")) {
      backgroundUrl = "images/rain.webp";
    } else if (weatherCondition.includes("snow")) {
      backgroundUrl = "images/snow.jpg";
    } else if (weatherCondition.includes("thunder")) {
      backgroundUrl = "images/thunderstorm.avif";
    } else if (
      weatherCondition.includes("fog") ||
      weatherCondition.includes("mist") ||
      weatherCondition.includes("haze")
    ) {
      backgroundUrl = "images/fog.jpg";
    } else {
      backgroundUrl = "https://source.unsplash.com/1600x900/?weather,sky"; 
    }
  
    // Apply correctly
    const bgEl = document.querySelector(".weather-background") || document.body;
    bgEl.style.backgroundImage = `url('${backgroundUrl}')`;
    bgEl.style.backgroundSize = "cover";
    bgEl.style.backgroundPosition = "center";
  }
  
  

    function persistLocation(coords, label) {
        localStorage.setItem('skycast.coords', JSON.stringify(coords));
        localStorage.setItem('skycast.label', label || '');
    }
    function restoreLocation() {
        try {
            const c = JSON.parse(localStorage.getItem('skycast.coords') || 'null');
            const l = localStorage.getItem('skycast.label') || '';
            if (c && typeof c.lat === 'number' && typeof c.lon === 'number') {
                state.coords = c; state.locationLabel = l; return true;
            }
        } catch (_) { }
        return false;
    }
    document.addEventListener("DOMContentLoaded", () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        fetchWeatherByCoords(latitude, longitude);
      },
      err => {
        console.warn("Location access denied, defaulting to London");
        fetchWeatherByCity("London");
      }
    );
  } else {
    fetchWeatherByCity("London");
  }
});



    // -------------- API CALLS -------------------
    async function geocodeCity(q) {
        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}&lang=en`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Geocoding failed');
        return res.json();
    }
    async function reverseGeocode(lat, lon) {
        const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`;
        const res = await fetch(url);
        const j = await res.json();
        const r = j?.[0];
        return r ? [r.name, r.state || r.country].filter(Boolean).join(', ') : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    }
    async function fetchOneCall(lat, lon) {
        const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=metric&exclude=minutely,alerts&appid=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) {
            const t = await res.text();
            throw new Error(`OneCall failed: ${res.status} ${t}`);
        }
        return res.json();
    }
    

    // -------------- RENDERERS -------------------
    
    function renderCurrent() {
        const d = state.data;
    
        // Use Intl.DateTimeFormat with timezone offset
        const tz = d.timezone_offset;
        const now = new Date(d.current.dt * 1000);
    
        const fmtDate = new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: `UTC`,
        }).format(new Date((d.current.dt + tz) * 1000));
    
        weekdayEl.textContent = dayName(new Date((d.current.dt + tz) * 1000));
        dateTimeEl.textContent = fmtDate;
        placeEl.textContent = state.locationLabel || '—';
    
        tempEl.textContent = asUnit(d.current.temp);
        const weather0 = d.current.weather?.[0] || {};
        summaryEl.textContent = weather0.description ? capitalize(weather0.description) : '—';
        heroIcon.src = ICON(weather0.icon || '01d');
        heroIcon.alt = weather0.description || 'weather';
    
        const precipMm = (d.current.rain?.['1h'] ?? d.current.snow?.['1h'] ?? 0);
        precipEl.textContent = `${precipMm.toFixed(1)} mm`;
        humidityEl.textContent = `${Math.round(d.current.humidity)}%`;
        windEl.textContent = windAsUnit(d.current.wind_speed);
    
        // 🌤️ THEME + BACKGROUND
        setThemeFromWeather(weather0.main || '');
        updateBackground((weather0.main || '').toLowerCase());
    
        document.body.classList.remove('theme-loading');
    }
    
    
    

    function renderDaily() {
        const d = state.data.daily;
        daysWrap.innerHTML = '';
        d.dt.forEach((ts, i) => {
            const date = new Date(ts * 1000);
            const node = dayTpl.content.firstElementChild.cloneNode(true);
            $('.dow', node).textContent = shortDay(date);
            const max = d.temp.max[i];
            const min = d.temp.min[i];
            $('.range', node).innerHTML = `<b>${Math.round(unit === 'c' ? max : toF(max))}</b> / ${Math.round(unit === 'c' ? min : toF(min))}`;
            const main = d.weather[i]?.main?.toLowerCase() || '';
            $('.dot', node).style.color = ({
                clear: '#fb923c', clouds: '#94a3b8', rain: '#38bdf8', snow: '#e2e8f0', thunder: '#c084fc', fog: '#94a3b8'
            })[toKey(main)] || '#94a3b8';
            node.addEventListener('click', () => {
                $$('.day').forEach(el => el.classList.remove('selected'));
                node.classList.add('selected');
                scrollHoursTo(date);
            });
            if (i === 0) node.classList.add('selected');
            daysWrap.appendChild(node);
        });
    }

    function renderHourly() {
        hoursWrap.innerHTML = '';
        const h = state.data.hourly;
        const tz = state.data.timezone_offset;
    
        for (let i = 0; i < 24 && i < h.length; i++) {
            const hour = h[i];
            const localDate = new Date((hour.dt + tz) * 1000);
    
            const node = hourTpl.content.firstElementChild.cloneNode(true);
            $('.time', node).textContent = localDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            $('.icon', node).src = ICON(hour.weather?.[0]?.icon || '01d');
            $('.icon', node).alt = hour.weather?.[0]?.description || 'Hour icon';
            $('.val', node).textContent = asUnit(hour.temp);
            $('.meta', node).textContent = `${Math.round(kmh(hour.wind_speed))} km/h`;
            hoursWrap.appendChild(node);
        }
    }
    
    function renderAll() {
        renderCurrent();
        renderDaily();
        renderHourly();
    }

    function scrollHoursTo(dayDate) {
        const idx = state.data.hourly.findIndex(h => {
            const d = new Date(h.dt * 1000);
            return d.getFullYear() === dayDate.getFullYear() &&
                d.getMonth() === dayDate.getMonth() &&
                d.getDate() === dayDate.getDate() &&
                d.getHours() === 0;
        });
        if (idx >= 0) {
            const target = hoursWrap.children[idx];
            target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    // -------------- LOADERS ---------------------
    async function loadByCoords({ lat, lon }, labelMain = '', labelSuffix = '') {
        try {
            document.body.classList.add('theme-loading');
            placeEl.textContent = 'Loading…';
            const label = labelMain ? [labelMain, labelSuffix].filter(Boolean).join(', ') : await reverseGeocode(lat, lon);
            state.locationLabel = label;
            state.coords = { lat, lon };
            persistLocation(state.coords, label);

            const data = await fetchOneCall(lat, lon);
            state.data = {
                current: data.current,
                hourly: data.hourly,
                daily: {
                    dt: data.daily.map(x => x.dt),
                    temp: { max: data.daily.map(x => x.temp.max), min: data.daily.map(x => x.temp.min) },
                    weather: data.daily.map(x => x.weather?.[0] || {})
                },
                timezone_offset: data.timezone_offset
            };
            
            renderAll();
        } catch (e) {
            console.error(e);
            alert('Failed to load weather data. Check your API key and network.');
            placeEl.textContent = 'Error loading data';
        }
    }

    async function detect() {
        if (!('geolocation' in navigator)) {
            alert('Geolocation not available.');
            return;
        }
        navigator.geolocation.getCurrentPosition(async pos => {
            const { latitude: lat, longitude: lon } = pos.coords;
            await loadByCoords({ lat, lon });
        }, () => {
            alert('Could not access location. Use search instead.');
            openSearch();
        }, { enableHighAccuracy: true, timeout: 10000 });
    }

    // -------------- SEARCH MODAL ----------------
    const openSearch = () => { $('#q').value = ''; resultsEl.innerHTML = ''; searchModal.showModal(); setTimeout(() => $('#q').focus(), 0); };
    
    
    async function handleSearchInput(e) {
        const q = e.target.value.trim();
        resultsEl.innerHTML = '';
        if (q.length < 2) return;
    
        try {
            const items = await geocodeCity(q);
            if (!items.length) {
                resultsEl.innerHTML = `<div class="result">No results found</div>`;
                return;
            }
    
            const frag = document.createDocumentFragment();
            for (const r of items) {
                const btn = document.createElement('button');
                btn.type = 'button'; 
                btn.className = 'result'; 
                btn.setAttribute('role', 'option');
    
                const flag = r.country ? getFlagEmoji(r.country) : "🌍";
                const locationName = [r.name, r.state, r.country].filter(Boolean).join(', ');
    
                btn.innerHTML = `
                    <div><strong>${flag} ${locationName}</strong></div>
                `;
    
                btn.addEventListener('click', async () => {
                    searchModal.close();
                    await loadByCoords({ lat: r.lat, lon: r.lon }, locationName, r.country);
                });
                frag.appendChild(btn);
            }
            resultsEl.appendChild(frag);
    
        } catch (err) {
            console.error(err);
            resultsEl.innerHTML = `<div class="result">Search failed</div>`;
        }
    }
    
    // Convert ISO country code → emoji flag
    function getFlagEmoji(countryCode) {
        return countryCode
            .toUpperCase()
            .replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt()));
    }
    
  //ooooooo    

    
    document.querySelectorAll(".quick-cities button").forEach(btn => {
        btn.addEventListener("click", async () => {
          const city = btn.dataset.city;
          const items = await geocodeCity(city);
          if (items.length > 0) {
            searchModal.close();
            await loadByCoords({ lat: items[0].lat, lon: items[0].lon }, items[0].name, items[0].country);
          }
        });
      });
      
      // Enter selects first search result
      document.getElementById("q").addEventListener("keydown", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          const firstResult = document.querySelector("#results button");
          if (firstResult) firstResult.click();
        }
      });
      
    // -------------- EVENTS ---------------------
    changeBtn.addEventListener('click', openSearch);
    changeBtn2.addEventListener('click', openSearch);
    detectBtn.addEventListener('click', detect);
    $('#q').addEventListener('input', debounce(handleSearchInput, 300));

    cBtn.addEventListener('click', () => { if (unit !== 'c') { unit = 'c'; updateUnitUI(); renderAll(); } });
    fBtn.addEventListener('click', () => { if (unit !== 'f') { unit = 'f'; updateUnitUI(); renderAll(); } });
    function updateUnitUI() { cBtn.classList.toggle('active', unit === 'c'); fBtn.classList.toggle('active', unit === 'f'); }

    function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
    const capitalize = s => s ? s[0].toUpperCase() + s.slice(1) : s;
    const toKey = main => {
        const m = (main || '').toLowerCase();
        if (m.includes('clear')) return 'clear';
        if (m.includes('rain') || m.includes('drizzle')) return 'rain';
        if (m.includes('thunder')) return 'thunder';
        if (m.includes('snow')) return 'snow';
        if (m.includes('fog') || m.includes('mist') || m.includes('haze')) return 'fog';
        return 'clouds';
    };

    // -------------- INIT -----------------------
    (async function init() {
        updateUnitUI();
        if (!API_KEY || API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
            alert('Please set your OpenWeatherMap API key in app.js (API_KEY).');
        }
        if (restoreLocation()) {
            await loadByCoords(state.coords, state.locationLabel);
            return;
        }
        try {
            await new Promise((res, rej) => {
                if (!('geolocation' in navigator)) return rej();
                navigator.geolocation.getCurrentPosition(p => res(p), () => rej(), { timeout: 8000 });
            }).then(async p => {
                const { latitude: lat, longitude: lon } = p.coords;
                await loadByCoords({ lat, lon });
            }).catch(async () => {
                await loadByCoords({ lat: 41.0082, lon: 28.9784 }, 'Istanbul', 'TR');
            });
        } catch {
            await loadByCoords({ lat: 41.0082, lon: 28.9784 }, 'Istanbul', 'TR');
        }
    })();
})();

/*My Signature*/
console.log("%c Designed & Coded by Eiba Anas | github.com/ebaa-anas ❤️ ", "color: white; background: #6C63FF; padding: 6px 12px; border-radius: 8px; font-size: 14px;");
