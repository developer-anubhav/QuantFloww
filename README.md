# QuantFloww - Enterprise FinTech Market Intelligence Console

QuantFloww is a production-grade financial technology platform designed to deliver real-time market data visualizations, stock analysis, and portfolio watchlists. It utilizes a high-frequency WebSocket-based ticker simulator connected to live Yahoo Finance quotes to emulate actual market behaviors.

The project demonstrates enterprise software engineering standards, utilizing a **Clean Architecture (Domain-Driven Design)** backend built on ASP.NET Core 8 and a modern **Reactive Single Page Application** frontend built on Vite, React 19, Tailwind CSS v4, and Redux Toolkit.

---

## 🚀 Key Features

*   **Live Dashboard**: Interactive index trackers and stock tickers grid with sub-second update highlights (green/red flash animations) powered by SignalR WebSockets.
*   **TradingView Interactive Charts**: Historical daily charts supporting both line and candlestick views utilizing the official high-performance `lightweight-charts` library.
*   **Real-time Stock Details**: Merged view combining 90 days of daily historical candles from the live market with live price feeds, market capitalization, sector classification, and PE metrics.
*   **Dynamic Watchlists**: Authenticated stock watchlists showing live price modifications, active list creation, and custom portfolio management.
*   **Identity & Security**: Secure JSON Web Token (JWT) credentials authentication with custom encryption and fallback flows.
*   **Premium Dark Design**: Curated zinc color palette with smooth micro-animations, glassmorphism containers, and persistent local storage theme-syncing.

---

## 🛠️ Technology Stack

### Backend Architecture
*   **Framework**: .NET 8 (C#)
*   **API Standard**: ASP.NET Core Web API with CORS and Exception Handling Middleware
*   **Relational Database**: Microsoft SQL Server LocalDB (`MSSQLLocalDB`)
*   **ORM Mapping**: Entity Framework Core with Fluent Configuration mappings
*   **Caching**: Hybrid `CacheService` using StackExchange Redis with graceful ASP.NET Core In-Memory cache fallback
*   **Real-time Communication**: ASP.NET Core SignalR WebSockets
*   **Identity**: ASP.NET Core Identity Core framework with Microsoft SQL migration tables

### Frontend Console
*   **Build Pipeline**: Vite + TypeScript (React)
*   **Styling Engine**: Tailwind CSS v4 + PostCSS with unified CSS variables design system
*   **State Management**: Redux Toolkit (Auth, Theme)
*   **Data Fetching & Cache**: TanStack React Query (v5)
*   **Real-time Streaming**: `@microsoft/signalr`
*   **Charts Canvas**: `lightweight-charts` (v5) by TradingView
*   **Icons Library**: `lucide-react`

---

## 📁 Repository Structure

```text
QuantFloww/
│
├── QuantFloww.Domain/              # Core Domain: Entities, Constants, and Rules
│   └── Entities/                   # Stock, StockPriceHistory, Watchlist, WatchlistItem
│
├── QuantFloww.Application/         # Use Case Layer: DTOs, Repository interfaces, Cache limits
│   ├── DTOs/                       # StockDto, AuthDto, WatchlistDto
│   └── Persistence/                # IStockRepository, IWatchlistRepository
│
├── QuantFloww.Infrastructure/      # Adapters Layer: DbContext, Seeding, Real-time services, Caching
│   ├── Persistence/                # ApplicationDbContext, DatabaseSeeder (Yahoo Finance + Fallback)
│   ├── RealTime/                   # MarketDataHub, MockMarketDataBackgroundService (Simulator)
│   └── Caching/                    # CacheService (Redis/In-Memory hybrid)
│
├── QuantFloww.API/                 # Delivery Layer: Controllers, Program.cs, Launch configs
│   └── Controllers/                # AuthController, StocksController, WatchlistsController
│
└── quantfloww-ui/                  # Frontend Console (Vite React Client)
    ├── src/
    │   ├── components/             # StockChart (TradingView wrapper), DarkModeToggle
    │   ├── store/                  # Redux slices (auth, theme)
    │   ├── pages/                  # Dashboard, StockDetails, Watchlists, Login, Register
    │   └── hooks/                  # useSignalR (references caching hub connection)
    └── index.html
```

---

## ⚡ Quick Start Guide

### Prerequisites
*   [.NET 8 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
*   [Node.js (v18+) & npm](https://nodejs.org/en)
*   SQL Server LocalDB (installed by default with Visual Studio 2022 workloads or SQL Server Express)

---

### Step 1: Initialize Database & Run Backend API

1. Navigate to the project root directory:
   ```bash
   cd c:\Code\QuantFloww
   ```
2. Run database migrations to initialize tables:
   ```bash
   dotnet ef database update -p QuantFloww.Infrastructure -s QuantFloww.API
   ```
3. Start the ASP.NET Core API server:
   ```bash
   dotnet run --project QuantFloww.API/QuantFloww.API.csproj --launch-profile http
   ```
   * *Note*: On boot, `DatabaseSeeder` queries Yahoo Finance for `RELIANCE.NS`, `TCS.NS`, `HDFCBANK.NS`, `INFY.NS`, and `ICICIBANK.NS` data. It stores 90 days of daily historical candles and initializes the live background simulator.
   * Server starts on: **`http://localhost:5280`**

---

### Step 2: Start Frontend UI Console

1. Open a new terminal window and navigate to the UI directory:
   ```bash
   cd c:\Code\QuantFloww\quantfloww-ui
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
4. Access the web interface at: **`http://localhost:5173`**

---

## ⚙️ Real-time Price Simulation Details

The system integrates a random-walk generator inside [MockMarketDataBackgroundService.cs](file:///c:/Code/QuantFloww/QuantFloww.Infrastructure/RealTime/MockMarketDataBackgroundService.cs):
1. Every **2 seconds**, it applies a random price fluctuation between `-0.15%` and `+0.15%` to all loaded stock assets.
2. The updated quote is stored in the cache (Redis with memory fallback) and broadcasted globally over SignalR WebSockets.
3. Every **30 seconds**, the accumulated price ticks are batched and written back to the SQL database to persist history.
