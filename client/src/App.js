import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CircleDollarSign,
  Flame,
  Gauge,
  Play,
  RotateCcw,
  Share2,
  Shield,
  Shuffle,
  Swords,
  Target,
  Trophy,
  TrendingDown,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";
import "./App.css";
import { MARKET_DATA } from "./services/marketData";

const STORAGE_KEY = "trading-arcade-profile";
const DAILY_BOT_ROTATION = ["ape", "scalper", "mean-reverter", "diamond-hands"];
const FEATURED_TICKERS = ["BTC", "ETH", "SOL", "XRP", "ADA", "AVAX", "DOT", "LINK", "LTC", "ATOM", "NEAR", "DOGE"];
const BOTS = {
  ape: {
    id: "ape",
    name: "Ape",
    title: "Momentum Mauler",
    flavor: "Chases breakouts and doubles down when the tape catches fire.",
    accent: "#ff8f3f",
    style: "Aggressive",
  },
  scalper: {
    id: "scalper",
    name: "Scalper",
    title: "Micro Burst",
    flavor: "Cuts fast, flips often, and locks tiny edges before they fade.",
    accent: "#63f5c8",
    style: "Fast",
  },
  "mean-reverter": {
    id: "mean-reverter",
    name: "Mean Reverter",
    title: "Snapback Sage",
    flavor: "Fades stretched moves and waits for price to drift home.",
    accent: "#7de0ff",
    style: "Counter",
  },
  "diamond-hands": {
    id: "diamond-hands",
    name: "Diamond Hands",
    title: "Endurance Titan",
    flavor: "Builds conviction slowly and prefers to sit through turbulence.",
    accent: "#ffd166",
    style: "Stoic",
  },
};
const DEFAULT_PROFILE = {
  callsign: "Guest Pilot",
  runsPlayed: 0,
  wins: 0,
  bestScore: 0,
  cumulativePnl: 0,
  biggestWin: 0,
  biggestLoss: 0,
  streak: 0,
  latestScore: 0,
  unlockedBots: ["ape"],
  lastBot: "ape",
  favoriteMode: "daily",
};
const PREVIEW_BARS = 18;
const RUN_BARS = 36;
const STARTING_BANKROLL = 1000;
const LEVERAGE_OPTIONS = [1, 2, 3, 4];
const DATASETS = MARKET_DATA.filter((market) => market.candles.length >= PREVIEW_BARS + RUN_BARS + 4);

function App() {
  const [profile, setProfile] = useState(() => loadProfile());
  const [shareMessage, setShareMessage] = useState("");
  const initialConfig = useMemo(() => getInitialConfig(), []);
  const [config, setConfig] = useState(initialConfig);
  const [run, setRun] = useState(() => createRun(initialConfig));

  useEffect(() => {
    persistProfile(profile);
  }, [profile]);

  useEffect(() => {
    updateUrl(config);
  }, [config]);

  useEffect(() => {
    setRun(createRun(config));
  }, [config]);

  const bot = BOTS[run.botId];
  const playerBar = run.playerSegment[run.currentIndex];
  const previousPlayerBar = run.playerSegment[Math.max(0, run.currentIndex - 1)];
  const aiBar = run.aiSegment[run.currentIndex];
  const playerBars = run.playerSegment.slice(0, run.currentIndex + 1);
  const aiBars = run.aiSegment.slice(0, run.currentIndex + 1);
  const isFinished = run.status === "finished";
  const playerPnl = getPnl(run.player);
  const aiPnl = getPnl(run.ai);
  const playerAdvantage = playerPnl - aiPnl;
  const runProgress = Math.round((run.turn / run.maxTurns) * 100);
  const portfolioStats = getPortfolioStats(profile, run);
  const priceChange = (playerBar.close - previousPlayerBar.close) / previousPlayerBar.close;
  const replayUrl = `${window.location.origin}${window.location.pathname}?seed=${encodeURIComponent(run.seed)}&ticker=${encodeURIComponent(run.market.id)}`;
  const featuredMarkets = getFeaturedMarkets();

  function startMode(mode) {
    const nextConfig =
      mode === "daily"
        ? createDailyConfig(profile.lastBot, config.marketId)
        : mode === "ai"
          ? createConfig(randomSeed(), profile.lastBot, mode, config.marketId)
          : createConfig(randomSeed(), "ape", mode, config.marketId);

    setConfig(nextConfig);
    setShareMessage("");
  }

  function restartRun() {
    setRun(createRun(config));
    setShareMessage("");
  }

  function rematchBot() {
    setConfig(createConfig(randomSeed(), run.botId, config.mode, run.market.id));
    setShareMessage("");
  }

  function handleAction(action) {
    if (isFinished) return;
    const nextRun = advanceRun(run, action);
    setRun(nextRun);

    if (nextRun.status === "finished") {
      const win = nextRun.summary.winner === "player";
      const nextUnlocked = unlockBots(profile.unlockedBots, nextRun.botId, win);
      setProfile((current) => ({
        ...current,
        runsPlayed: current.runsPlayed + 1,
        wins: current.wins + (win ? 1 : 0),
        bestScore: Math.max(current.bestScore, Math.round(nextRun.summary.playerTotal)),
        cumulativePnl: current.cumulativePnl + nextRun.summary.playerTotal,
        biggestWin: Math.max(current.biggestWin, nextRun.summary.playerTotal),
        biggestLoss: Math.min(current.biggestLoss, nextRun.summary.playerTotal),
        streak: win ? Math.max(1, current.streak + 1) : Math.min(-1, current.streak - 1),
        latestScore: Math.round(nextRun.summary.playerTotal),
        unlockedBots: nextUnlocked,
        lastBot: nextRun.botId,
        favoriteMode: config.mode,
      }));
    }
  }

  function handleCallsignChange(event) {
    const value = event.target.value.slice(0, 18);
    setProfile((current) => ({
      ...current,
      callsign: value || DEFAULT_PROFILE.callsign,
    }));
  }

  function changeBot(botId) {
    if (!profile.unlockedBots.includes(botId)) return;
    setConfig((current) => ({ ...current, botId, mode: "ai" }));
    setProfile((current) => ({ ...current, lastBot: botId }));
  }

  function changeLeverage(leverage) {
    if (isFinished) return;
    setRun((current) => ({
      ...current,
      player: {
        ...current.player,
        leverage,
      },
    }));
  }

  function changeMarket(marketId) {
    const parsedMarketId = Number(marketId);
    setConfig((current) => ({
      ...current,
      marketId: Number.isFinite(parsedMarketId) ? parsedMarketId : current.marketId,
      seed: current.mode === "daily" ? current.seed : randomSeed(),
    }));
    setShareMessage("");
  }

  async function shareRun() {
    const message = buildShareMessage(run, profile.callsign, replayUrl);
    setShareMessage(message);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Trading Arcade Replay",
          text: message,
          url: replayUrl,
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
    }
  }

  return (
    <main className="arcade-shell" style={{ "--bot-accent": bot.accent }}>
      <header className="top-bar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Swords size={20} />
          </div>
          <div>
            <p>Trading Arcade</p>
            <h1>{run.market.symbol} Split Battle</h1>
          </div>
        </div>

        <div className="ticker-rack" aria-label="Ticker selector">
          {featuredMarkets.map((market) => (
            <button
              key={market.id}
              type="button"
              className={market.id === run.market.id ? "ticker-chip active" : "ticker-chip"}
              onClick={() => changeMarket(market.id)}
            >
              {market.symbol}
            </button>
          ))}
          <select aria-label="All tickers" value={run.market.id} onChange={(event) => changeMarket(event.target.value)}>
            {DATASETS.map((market) => (
              <option key={market.id} value={market.id}>
                {market.symbol}
              </option>
            ))}
          </select>
        </div>

        <label className="callsign-field">
          <UserRound size={15} />
          <input aria-label="Callsign" value={profile.callsign} onChange={handleCallsignChange} />
        </label>
      </header>

      <section className="score-strip" aria-label="Portfolio statistics">
        <StatTile icon={CircleDollarSign} label="Equity" value={formatCurrency(portfolioStats.equity)} trend={portfolioStats.livePnl} />
        <StatTile icon={Activity} label="Live PnL" value={formatCurrency(portfolioStats.livePnl)} trend={portfolioStats.livePnl} />
        <StatTile icon={Trophy} label="Best Run" value={formatCurrency(profile.bestScore)} trend={profile.bestScore} />
        <StatTile icon={BarChart3} label="Win Rate" value={`${portfolioStats.winRate}%`} />
        <StatTile icon={Zap} label="Streak" value={formatStreak(profile.streak)} trend={profile.streak} />
        <StatTile icon={Gauge} label="Risk" value={getRiskState(run.player)} />
      </section>

      <section className="battle-stage" aria-label="Split battle arena">
        <ArenaPanel
          side="ai"
          title={bot.name}
          subtitle={bot.title}
          symbol={run.market.symbol}
          bars={aiBars}
          trader={run.ai}
          pnl={aiPnl}
          status={run.summary.aiActionLabel}
          detail={run.summary.aiTell}
          price={aiBar.close}
          change={getLastChange(aiBars)}
          accent={bot.accent}
        />

        <div className="center-console">
          <div className="versus-core">
            <span>Round {Math.min(run.turn + 1, run.maxTurns)}</span>
            <strong>{isFinished ? run.summary.winnerLabel : "VS"}</strong>
            <div className="progress-track">
              <span style={{ width: `${runProgress}%` }} />
            </div>
            <p className={playerAdvantage >= 0 ? "up" : "down"}>{formatCurrency(playerAdvantage)} advantage</p>
          </div>

          <div className="mode-switcher" aria-label="Game modes">
            <button type="button" className={config.mode === "daily" ? "mode-tab active" : "mode-tab"} onClick={() => startMode("daily")}>
              <Flame size={14} />
              Daily
            </button>
            <button type="button" className={config.mode === "ai" ? "mode-tab active" : "mode-tab"} onClick={() => startMode("ai")}>
              <Bot size={14} />
              AI
            </button>
            <button type="button" className={config.mode === "free" ? "mode-tab active" : "mode-tab"} onClick={() => startMode("free")}>
              <Play size={14} />
              Free
            </button>
          </div>

          <div className="bot-roster">
            {Object.values(BOTS).map((entry) => {
              const locked = !profile.unlockedBots.includes(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={entry.id === config.botId ? "bot-chip active" : "bot-chip"}
                  onClick={() => changeBot(entry.id)}
                  disabled={locked}
                  style={{ "--tile-accent": entry.accent }}
                >
                  {locked ? "LOCK" : entry.name}
                </button>
              );
            })}
          </div>

          <div className="ticket-panel" aria-label="Order Ticket">
            <div className="ticket-title">
              <Target size={15} />
              <strong>Order Ticket</strong>
            </div>
            <div className="lever-row">
              {LEVERAGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === run.player.leverage ? "lever-button active" : "lever-button"}
                  onClick={() => changeLeverage(option)}
                  aria-label={`Set leverage to ${option}x`}
                >
                  {option}x
                </button>
              ))}
            </div>
            <div className="action-grid">
              <button type="button" className="action-button buy" onClick={() => handleAction("long")}>
                <TrendingUp size={18} />
                Long
              </button>
              <button type="button" className="action-button sell" onClick={() => handleAction("short")}>
                <TrendingDown size={18} />
                Short
              </button>
              <button type="button" className="action-button hold" onClick={() => handleAction("hold")}>
                <Shield size={18} />
                Hold
              </button>
              <button type="button" className="action-button close" onClick={() => handleAction("close")}>
                <Target size={18} />
                Close
              </button>
            </div>
          </div>

          <div className="utility-row">
            <button type="button" className="icon-button" onClick={restartRun} aria-label="Restart run">
              <RotateCcw size={15} />
              Restart
            </button>
            <button type="button" className="icon-button" onClick={rematchBot} aria-label="Generate new seed">
              <Shuffle size={15} />
              Seed
            </button>
            <button type="button" className="icon-button" onClick={shareRun} aria-label="Share run">
              <Share2 size={15} />
              Share
            </button>
          </div>

          <p className="battle-copy">{shareMessage || run.summary.narrative}</p>
        </div>

        <ArenaPanel
          side="player"
          title={profile.callsign}
          subtitle="Player Desk"
          symbol={run.market.symbol}
          bars={playerBars}
          trader={run.player}
          pnl={playerPnl}
          status={run.player.position.toUpperCase()}
          detail={`${run.player.leverage}x leverage`}
          price={playerBar.close}
          change={priceChange}
          accent="#45f39b"
        />
      </section>
    </main>
  );
}

function ArenaPanel({ side, title, subtitle, symbol, bars, trader, pnl, status, detail, price, change, accent }) {
  return (
    <article className={`arena-panel ${side}`} style={{ "--panel-accent": accent }}>
      <div className="panel-head">
        <div>
          <p>{side === "ai" ? "AI Lane" : "Player Lane"}</p>
          <h2>{title}</h2>
        </div>
        <span className="lane-badge">{subtitle}</span>
      </div>
      <div className="lane-meta">
        <MetricCard label={symbol} value={formatPrice(price)} />
        <MetricCard label="Move" value={formatPercent(change)} positive={change >= 0} />
        <MetricCard label="PnL" value={formatCurrency(pnl)} positive={pnl >= 0} />
        <MetricCard label={status} value={detail} />
      </div>
      <PriceChart bars={bars} trader={trader} marker={side === "ai" ? "AI" : "YOU"} accent={accent} />
    </article>
  );
}

function StatTile({ icon: Icon, label, value, trend }) {
  const trendClass = trend === undefined ? "" : trend >= 0 ? " positive" : " negative";
  return (
    <div className={`stat-tile${trendClass}`}>
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({ label, value, positive }) {
  return (
    <div className={positive === undefined ? "metric-card" : positive ? "metric-card positive" : "metric-card negative"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PriceChart({ bars, trader, marker, accent }) {
  const width = 560;
  const height = 410;
  const padding = 22;
  const lows = bars.map((bar) => bar.low);
  const highs = bars.map((bar) => bar.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;
  const candleWidth = Math.max(3, (width - padding * 2) / bars.length - 2);

  function scaleX(index) {
    return padding + ((width - padding * 2) / Math.max(1, bars.length - 1)) * index;
  }

  function scaleY(value) {
    return height - padding - ((value - min) / range) * (height - padding * 2);
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={`${marker} market chart`}>
        <rect x="0" y="0" width={width} height={height} rx="18" fill="rgba(5, 8, 13, 0.94)" />
        {[0, 1, 2, 3, 4].map((line) => {
          const y = padding + ((height - padding * 2) / 4) * line;
          return <line key={line} x1={padding} y1={y} x2={width - padding} y2={y} className="grid-line" />;
        })}
        <path
          d={`M ${bars.map((bar, index) => `${scaleX(index)} ${scaleY(bar.close)}`).join(" L ")}`}
          fill="none"
          stroke={accent}
          strokeOpacity="0.28"
          strokeWidth="4"
        />
        {bars.map((bar, index) => {
          const x = scaleX(index);
          const yOpen = scaleY(bar.open);
          const yClose = scaleY(bar.close);
          const yHigh = scaleY(bar.high);
          const yLow = scaleY(bar.low);
          const rising = bar.close >= bar.open;
          return (
            <g key={`${bar.time}-${index}`}>
              <line x1={x} y1={yHigh} x2={x} y2={yLow} className={rising ? "wick up" : "wick down"} />
              <rect
                x={x - candleWidth / 2}
                y={Math.min(yOpen, yClose)}
                width={candleWidth}
                height={Math.max(3, Math.abs(yOpen - yClose))}
                rx="2"
                className={rising ? "candle up" : "candle down"}
              />
            </g>
          );
        })}
        <PositionMarker label={marker} color={accent} price={trader.entryPrice} visible={trader.position !== "flat"} scaleY={scaleY} width={width} />
      </svg>
    </div>
  );
}

function PositionMarker({ label, color, price, visible, scaleY, width }) {
  if (!visible || !price) return null;
  const y = scaleY(price);
  return (
    <g>
      <line x1="18" y1={y} x2={width - 18} y2={y} stroke={color} strokeDasharray="7 8" strokeWidth="1.5" opacity="0.8" />
      <rect x={width - 78} y={y - 13} width="60" height="26" rx="13" fill={color} />
      <text x={width - 48} y={y + 5} textAnchor="middle" fill="#06100a" fontSize="11" fontWeight="900">
        {label}
      </text>
    </g>
  );
}

function createRun(config) {
  const random = mulberry32(hashSeed(`${config.seed}:${config.marketId || "auto"}`));
  const market = getMarketById(config.marketId) || DATASETS[Math.floor(random() * DATASETS.length)];
  const span = PREVIEW_BARS + RUN_BARS + 2;
  const maxStart = Math.max(PREVIEW_BARS + 1, market.candles.length - span - 1);
  const playerStart = PREVIEW_BARS + Math.floor(random() * maxStart);
  const aiOffset = 8 + Math.floor(random() * 24);
  const aiStart = Math.min(maxStart, Math.max(PREVIEW_BARS, playerStart + (random() > 0.5 ? aiOffset : -aiOffset)));

  return {
    seed: config.seed,
    mode: config.mode,
    botId: config.botId,
    market,
    playerSegment: market.candles.slice(playerStart - PREVIEW_BARS, playerStart + RUN_BARS + 1),
    aiSegment: market.candles.slice(aiStart - PREVIEW_BARS, aiStart + RUN_BARS + 1),
    turn: 0,
    currentIndex: PREVIEW_BARS,
    maxTurns: RUN_BARS,
    status: "running",
    player: createTraderState(),
    ai: createTraderState(),
    summary: {
      aiReason: "Reading the opening tape.",
      aiTell: "Awaiting setup",
      aiActionLabel: "Neutral",
      playerTotal: 0,
      aiTotal: 0,
      winner: "pending",
      winnerLabel: "Pending",
      narrative: "Two tapes, one duel. Read your lane and beat the bot's PnL.",
    },
  };
}

function createTraderState() {
  return {
    bankroll: STARTING_BANKROLL,
    realized: 0,
    unrealized: 0,
    position: "flat",
    entryPrice: null,
    leverage: 1,
  };
}

function advanceRun(run, action) {
  const playerBar = run.playerSegment[run.currentIndex];
  const nextPlayerBar = run.playerSegment[run.currentIndex + 1];
  const aiBar = run.aiSegment[run.currentIndex];
  const nextAiBar = run.aiSegment[run.currentIndex + 1];
  if (!nextPlayerBar || !nextAiBar) return finishRun(run);

  const botDecision = decideBotAction(run, aiBar);
  const player = settleTrader(applyAction(run.player, action, playerBar.close), playerBar.close, nextPlayerBar.close);
  const ai = settleTrader(applyAction(run.ai, botDecision.action, aiBar.close), aiBar.close, nextAiBar.close);
  const currentIndex = run.currentIndex + 1;
  const turn = run.turn + 1;

  const updated = {
    ...run,
    turn,
    currentIndex,
    player,
    ai,
    summary: {
      ...run.summary,
      aiReason: botDecision.reason,
      aiTell: botDecision.tell,
      aiActionLabel: botDecision.label,
      narrative: buildNarrative(player, ai),
    },
  };

  return turn >= run.maxTurns ? finishRun(updated) : updated;
}

function applyAction(trader, action, price) {
  if (action === "hold") return trader;
  if (action === "close") {
    return {
      ...trader,
      realized: trader.realized + trader.unrealized,
      bankroll: STARTING_BANKROLL + trader.realized + trader.unrealized,
      unrealized: 0,
      position: "flat",
      entryPrice: null,
    };
  }

  const nextSide = action === "long" ? "long" : "short";
  const flipped = trader.position !== "flat" && trader.position !== nextSide;
  const base = flipped
    ? {
        ...trader,
        realized: trader.realized + trader.unrealized,
        bankroll: STARTING_BANKROLL + trader.realized + trader.unrealized,
        unrealized: 0,
      }
    : trader;

  if (base.position === nextSide && base.entryPrice) {
    return {
      ...base,
      leverage: Math.min(4, base.leverage + 1),
    };
  }

  return {
    ...base,
    position: nextSide,
    entryPrice: price,
    unrealized: 0,
  };
}

function settleTrader(trader, currentPrice, nextPrice) {
  if (trader.position === "flat" || !trader.entryPrice) {
    return {
      ...trader,
      bankroll: STARTING_BANKROLL + trader.realized,
      unrealized: 0,
    };
  }

  const direction = trader.position === "long" ? 1 : -1;
  const priceDelta = ((nextPrice - trader.entryPrice) / trader.entryPrice) * STARTING_BANKROLL * trader.leverage * direction;

  return {
    ...trader,
    bankroll: STARTING_BANKROLL + trader.realized,
    unrealized: priceDelta,
  };
}

function finishRun(run) {
  const playerTotal = getPnl(run.player);
  const aiTotal = getPnl(run.ai);
  const winner = playerTotal === aiTotal ? "draw" : playerTotal > aiTotal ? "player" : "ai";
  return {
    ...run,
    status: "finished",
    summary: {
      ...run.summary,
      playerTotal,
      aiTotal,
      winner,
      winnerLabel: winner === "player" ? "Player Win" : winner === "ai" ? "AI Win" : "Draw",
      narrative:
        winner === "player"
          ? "You beat the bot across the split tape."
          : winner === "ai"
            ? "The bot extracted more from its lane. Run it back."
            : "Dead heat. Fresh seed, fresh lane.",
    },
  };
}

function decideBotAction(run, currentBar) {
  const bot = run.botId;
  const closes = run.aiSegment.slice(Math.max(0, run.currentIndex - 5), run.currentIndex + 1).map((bar) => bar.close);
  const momentum = closes.length > 1 ? (closes[closes.length - 1] - closes[0]) / closes[0] : 0;
  const shortSwing = closes.length > 2 ? (closes[closes.length - 1] - closes[closes.length - 3]) / closes[closes.length - 3] : 0;
  const volatility = currentBar.high && currentBar.low ? (currentBar.high - currentBar.low) / currentBar.close : 0;

  if (bot === "ape") {
    if (momentum > 0.02) return { action: "long", label: "Breakout", tell: "Adds strength", reason: "Ape saw upside momentum and piled in." };
    if (momentum < -0.02) return { action: "short", label: "Flush", tell: "Sells panic", reason: "Ape detected a downside cascade and pressed short." };
    return { action: "hold", label: "Loading", tell: "Needs impulse", reason: "Ape wants a cleaner move before committing." };
  }

  if (bot === "scalper") {
    if (Math.abs(shortSwing) > 0.012) {
      return {
        action: shortSwing > 0 ? "long" : "short",
        label: "Micro Burst",
        tell: "Fast entry",
        reason: "Scalper reacted to a short burst and wants one more bar.",
      };
    }
    return { action: "close", label: "Flat Reset", tell: "Books quickly", reason: "Scalper saw no immediate edge and flattened." };
  }

  if (bot === "mean-reverter") {
    if (momentum > 0.025 || volatility > 0.03) {
      return { action: "short", label: "Fade High", tell: "Against stretch", reason: "Mean Reverter expects the spike to cool off." };
    }
    if (momentum < -0.025) {
      return { action: "long", label: "Snapback", tell: "Buys exhaustion", reason: "Mean Reverter is fading an overstretched selloff." };
    }
    return { action: "hold", label: "Balanced", tell: "Near fair value", reason: "Mean Reverter does not see enough dislocation yet." };
  }

  if (momentum > 0.015) {
    return { action: run.ai.position === "long" ? "hold" : "long", label: "Build", tell: "Keeps core on", reason: "Diamond Hands is building a long bias." };
  }
  if (momentum < -0.015) {
    return { action: run.ai.position === "short" ? "hold" : "short", label: "Hedge", tell: "Sits through chop", reason: "Diamond Hands wants the downside trend." };
  }
  return { action: "hold", label: "Stoic", tell: "Minimal churn", reason: "Diamond Hands avoids a flat tape." };
}

function buildNarrative(player, ai) {
  const spread = getPnl(player) - getPnl(ai);
  if (spread > 120) return "You are ahead. Protect the lead or press the advantage.";
  if (spread < -120) return "The bot has tempo. You need a cleaner entry or better exit.";
  if (player.position === "flat") return "You are flat. Choose the next entry before the tape moves.";
  return "Both lanes are live. Your open risk still matters.";
}

function buildShareMessage(run, callsign, replayUrl) {
  const playerTotal = Math.round(getPnl(run.player));
  const aiTotal = Math.round(getPnl(run.ai));
  return `${callsign} posted ${playerTotal} on ${run.market.symbol} in Trading Arcade against ${BOTS[run.botId].name} (${aiTotal}). Replay seed ${run.seed}: ${replayUrl}`;
}

function getFeaturedMarkets() {
  const featured = FEATURED_TICKERS.map((symbol) => DATASETS.find((market) => market.symbol === symbol)).filter(Boolean);
  return featured.length ? featured : DATASETS.slice(0, 12);
}

function getMarketById(marketId) {
  return DATASETS.find((market) => market.id === Number(marketId));
}

function getLastChange(bars) {
  if (bars.length < 2) return 0;
  const latest = bars[bars.length - 1];
  const previous = bars[bars.length - 2];
  return (latest.close - previous.close) / previous.close;
}

function getPnl(trader) {
  return trader.realized + trader.unrealized;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getEquity(trader) {
  return STARTING_BANKROLL + getPnl(trader);
}

function getPortfolioStats(profile, run) {
  const livePnl = getPnl(run.player);
  const wins = profile.wins || 0;
  const played = profile.runsPlayed || 0;
  return {
    equity: getEquity(run.player),
    livePnl,
    winRate: played ? Math.round((wins / played) * 100) : 0,
  };
}

function formatStreak(streak) {
  if (!streak) return "0";
  return streak > 0 ? `W${streak}` : `L${Math.abs(streak)}`;
}

function getRiskState(player) {
  const total = getPnl(player);
  if (player.position === "flat") return "Neutral";
  if (player.leverage >= 4 || total < -120) return "Critical";
  if (player.leverage >= 3 || total < 0) return "Charged";
  return "Stable";
}

function loadProfile() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return parsed ? { ...DEFAULT_PROFILE, ...parsed } : DEFAULT_PROFILE;
  } catch (error) {
    return DEFAULT_PROFILE;
  }
}

function persistProfile(profile) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function unlockBots(currentUnlocked, botId, win) {
  const order = Object.keys(BOTS);
  if (!win) return currentUnlocked;
  const index = order.indexOf(botId);
  const nextBot = order[Math.min(order.length - 1, index + 1)];
  return Array.from(new Set([...currentUnlocked, botId, nextBot]));
}

function createConfig(seed, preferredBot = "ape", mode = "ai", marketId = DATASETS[0]?.id) {
  return {
    seed,
    botId: mode === "daily" ? createDailyConfig(preferredBot, marketId).botId : preferredBot,
    mode,
    marketId,
  };
}

function createDailyConfig(preferredBot = "ape", marketId = DATASETS[0]?.id) {
  const today = new Date();
  const dailySeed = `daily-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const botId = DAILY_BOT_ROTATION[hashSeed(dailySeed) % DAILY_BOT_ROTATION.length] || preferredBot;
  return {
    seed: dailySeed,
    botId,
    mode: "daily",
    marketId,
  };
}

function getInitialConfig() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get("seed");
  const marketId = Number(params.get("ticker")) || DATASETS[0]?.id;
  if (seed) return createConfig(seed, "ape", "ai", marketId);
  return createDailyConfig("ape", marketId);
}

function updateUrl(config) {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", config.seed);
  url.searchParams.set("ticker", config.marketId);
  window.history.replaceState({}, "", url);
}

function randomSeed() {
  return `run-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
}

function hashSeed(seed) {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return (hash ^= hash >>> 16) >>> 0;
}

function mulberry32(seed) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let result = Math.imul(state ^ (state >>> 15), state | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export default App;
