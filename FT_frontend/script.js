// ======================
// STOCK SIMULATOR PRO
// Complete Implementation
// ======================

// Global State
const state = {
    chart: null,
    data: {
      history: { dates: [], prices: [] },
      projection: { dates: [], prices: [] },
      currentDay: 0,
      color: '#3b82f6',
      lastPrice: 0
    },
    ui: {
      loading: document.getElementById('loading'),
      error: document.getElementById('error'),
      newsEvents: document.getElementById('newsEvents'),
      currentPrice: document.getElementById('currentPrice'),
      dayCounter: document.getElementById('dayCounter'),
      dailyChange: document.getElementById('dailyChange')
    },
    timeframe: '1Y' 
  };
  
  // Initialize Application
  function init() {
    setupEventListeners();
    checkBackend();
  }
  
  // Event Listeners
  function setupEventListeners() {
    document.getElementById('loadBtn').addEventListener('click', loadStock);
    document.getElementById('nextDayBtn').addEventListener('click', simulateNextDay);
    document.getElementById('fastForwardBtn').addEventListener('click', () => fastForward(10));
  
    // ⏱ Timeframe button logic
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.timeframe = this.dataset.timeframe;
        updateChartView();
      });
    });
  }  
  
  // Backend Connection Check
  async function checkBackend() {
    try {
      await axios.get('http://localhost:5000/', { timeout: 2000 });
      console.log("Backend connected");
    } catch (error) {
      showError("Backend not running - using demo data");
      loadDemoData('AAPL');
    }
  }
  
  // Main Stock Loading Function
  async function loadStock() {
    const symbol = document.getElementById('stockSelector').value;
    console.log("[DEBUG] Attempting to load:", symbol);
    
    showLoading(true);
    clearError();
  
    try {
      // Test backend connection first
      console.log("[DEBUG] Testing backend connection...");
      const testResponse = await axios.get('http://localhost:5000/');
      console.log("[DEBUG] Backend response:", testResponse.data);
  
      // Load stock data
      console.log("[DEBUG] Fetching stock data...");
      const startTime = Date.now();
      const response = await axios.get(`http://localhost:5000/stock/${symbol}`);
      console.log(`[DEBUG] Received data in ${Date.now() - startTime}ms`, response.data);
  
      if (!response.data.history || !response.data.history.prices) {
        throw new Error("Invalid data format from server");
      }
  
      // Process data
      stockData = {
        history: response.data.history,
        projection: {
          dates: generateProjectionDates(365),
          prices: Array(365).fill(null)
        },
        currentDay: 0,
        lastRealPrice: response.data.history.prices.slice(-1)[0],
        isRealData: response.data.status === "real_data"
      };
  
      updateChart();
      updateStats();
      
      if (!stockData.isRealData) {
        showWarning("Using simulated data - Yahoo Finance unavailable");
        console.warn("Fallback data details:", response.data);
      }
  
    } catch (error) {
      console.error("[ERROR] Loading failed:", error);
      showError(`Failed to load: ${error.message}`);
      loadDemoData(symbol);
    } finally {
      showLoading(false);
    }
  }
  
  // Stock Simulation
  async function simulateNextDay() {
    if (state.data.currentDay >= 365) {
      showError("Reached end of 1-year projection");
      return;
    }
  
    showLoading(true);
  
    try {
      const currentPrice = getCurrentPrice();
      const response = await axios.post('http://localhost:5000/simulate-next-day', {
        current_price: currentPrice
      });
  
      // Update projection
      state.data.projection.prices[state.data.currentDay] = response.data.new_price;
      state.data.currentDay++;
  
      // Random news event (15% chance)
      if (Math.random() < 0.15) {
        addNewsEvent(response.data.new_price, response.data.shock);
      }
  
      updateChart();
      updateUI();
  
    } catch (error) {
      console.error("Simulation failed:", error);
      simulateDayLocally();
    } finally {
      showLoading(false);
    }
  }
  
  function simulateDayLocally() {
    if (state.data.currentDay >= 365) return;
  
    const dt = 1/252;
    const mu = 0.1;
    const sigma = 0.2;
    const shock = sigma * Math.sqrt(dt) * gaussianRandom();
    const newPrice = getCurrentPrice() * Math.exp((mu - 0.5*sigma**2)*dt + shock);
  
    state.data.projection.prices[state.data.currentDay] = parseFloat(newPrice.toFixed(2));
    state.data.currentDay++;
  
    if (Math.random() < 0.15) {
      addNewsEvent(newPrice, shock);
    }
  
    updateChart();
    updateUI();
  }
  
  function fastForward(days) {
    let remaining = Math.min(days, 365 - state.data.currentDay);
    if (remaining <= 0) return;
  
    const simulate = async () => {
      if (remaining <= 0) return;
      await simulateNextDay();
      remaining--;
      setTimeout(simulate, 50);
    };
  
    simulate();
  }
  
  // Chart Management
  function updateChart() {
    const ctx = document.getElementById('stockChart').getContext('2d');
    const projectionStart = state.data.history.dates.length;
  
    if (state.chart) state.chart.destroy();
  
    const latestReal = state.data.history.prices.at(-1);
    const latestSim = state.data.projection.prices[state.data.currentDay - 1] || latestReal;
    const isUp = latestSim >= latestReal;
    const simColor = isUp ? '#10b981' : '#ef4444';
    const simFill = isUp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
  
    state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [...state.data.history.dates, ...state.data.projection.dates],
        datasets: [
          {
            label: 'Historical Prices',
            data: [...state.data.history.prices, ...Array(state.data.projection.dates.length).fill(null)],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.05)',
            tension: 0.3,
            fill: true,
            pointRadius: 0,
          },
          {
            label: 'Projection',
            data: [...Array(state.data.history.dates.length).fill(null), 
                  ...state.data.projection.prices.slice(0, state.data.currentDay)],
            borderColor: simColor,
            backgroundColor: simFill,
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0,
            fill: true,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            ticks: {
              callback: value => `$${value.toFixed(2)}`,
              color: '#e2e8f0'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              autoSkip: true,
              maxTicksLimit: 15,
              color: '#e2e8f0'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => {
                let label = ctx.dataset.label || '';
                if (label) label += ': ';
                if (ctx.parsed.y !== null) {
                  label += `$${ctx.parsed.y.toFixed(2)}`;
                }
                return label;
              }
            }
          },
          legend: {
            labels: {
              color: '#e2e8f0'
            }
          }
        }
      }
    });
  }  
  
  // UI Updates
  function updateUI() {
    const currentPrice = getCurrentPrice();
    const prevPrice = state.data.currentDay > 0 
      ? (state.data.currentDay > 1 
        ? state.data.projection.prices[state.data.currentDay - 2] 
        : state.data.lastPrice)
      : state.data.lastPrice;
  
    const dailyChange = ((currentPrice - prevPrice) / prevPrice * 100).toFixed(2);
    const totalChange = ((currentPrice - state.data.lastPrice) / state.data.lastPrice * 100).toFixed(2);
  
    state.ui.currentPrice.textContent = `$${currentPrice.toFixed(2)}`;
  state.ui.dayCounter.textContent = `Day ${state.data.currentDay}/365`;
  state.ui.dailyChange.textContent = `${dailyChange >= 0 ? '+' : ''}${dailyChange}%`;
  state.ui.dailyChange.className = `stat-value ${dailyChange >= 0 ? 'positive' : 'negative'}`;

  const priceChangeEl = document.getElementById('priceChange');
  if (priceChangeEl) {
    priceChangeEl.textContent = `${dailyChange >= 0 ? '+' : ''}${dailyChange}%`;
    priceChangeEl.className = dailyChange >= 0 ? 'positive' : 'negative';
  }
}
  
  // News Events
  function addNewsEvent(price, shock) {
    const newsTypes = {
      positive: [
        "Positive earnings report",
        "New product launch",
        "Analyst upgrade",
        "Market rally"
      ],
      negative: [
        "Earnings miss",
        "Regulatory concerns",
        "CEO resignation",
        "Market correction"
      ]
    };
  
    const type = shock > 0 ? 'positive' : 'negative';
    const eventText = newsTypes[type][Math.floor(Math.random() * newsTypes[type].length)];
    
    const newsItem = document.createElement('div');
    newsItem.className = `news-event ${type}`;
    newsItem.innerHTML = `
      <strong>${state.data.projection.dates[state.data.currentDay - 1] || 'Today'}:</strong>
      ${eventText}<br>
      <small>Price: $${price.toFixed(2)} (${shock > 0 ? '+' : ''}${(shock*100).toFixed(2)}%)</small>
    `;
    state.ui.newsEvents.prepend(newsItem);
  }
  
  // Fallback Data
  function loadDemoData(symbol) {
    console.warn("Loading demo data for", symbol);
    
    const basePrice = {
      AAPL: 175, TSLA: 250, SPY: 450
    }[symbol] || 100;
  
    // Generate historical data
    const historyDates = [];
    const historyPrices = [];
    for (let i = 0; i < 365; i++) {
      const date = new Date();
      date.setDate(date.getDate() - 365 + i);
      if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip weekends
        historyDates.push(date.toISOString().split('T')[0]);
        historyPrices.push(
          basePrice * (1 + 0.005*i + 0.02*Math.sin(i/30) + (0.02 * Math.random()))
        );
      }
    }
  
    // Generate projection dates
    const projectionDates = [];
    let currentDate = new Date();
    for (let i = 0; i < 365; i++) {
      currentDate = new Date(currentDate.getTime() + 86400000);
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 86400000);
      }
      projectionDates.push(currentDate.toISOString().split('T')[0]);
    }
  
    // Update state
    state.data = {
      history: {
        dates: historyDates,
        prices: historyPrices.map(p => parseFloat(p.toFixed(2)))
      },
      projection: {
        dates: projectionDates,
        prices: Array(365).fill(null)
      },
      currentDay: 0,
      color: '#3b82f6',
      lastPrice: historyPrices[historyPrices.length - 1]
    };
  
    updateChart();
    updateUI();
  }
  
  // Helper Functions
  function getCurrentPrice() {
    return state.data.currentDay > 0 
      ? state.data.projection.prices[state.data.currentDay - 1] 
      : state.data.lastPrice;
  }
  
  function showLoading(show) {
    state.ui.loading.style.display = show ? 'block' : 'none';
  }
  
  function showError(message) {
    state.ui.error.textContent = message;
    state.ui.error.style.display = 'block';
    setTimeout(() => {
      state.ui.error.style.display = 'none';
    }, 5000);
  }
  
  function showWarning(message) {
    console.warn(message);
  }
  
  function clearError() {
    state.ui.error.style.display = 'none';
  }
  
  function gaussianRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  function updateChartView() {
    if (!state.chart) return;
  
    state.chart.options.scales.x.time = {
      unit:
        state.timeframe === '1Y' ? 'month' :
        state.timeframe === '1M' ? 'week' :
        'day'
    };
  
    state.chart.update();
  }
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

