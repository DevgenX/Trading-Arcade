import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CircleDollarSign,
  Crosshair,
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
const DAILY_BOT_ROTATION = [
  "ape",
  "scalper",
  "mean-reverter",
  "diamond-hands",
];
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
const PREVIEW_BARS = 24;
const RUN_BARS = 48;
const STARTING_BANKROLL = 1000;
const LEVERAGE_OPTIONS = [1, 2, 3, 4];
const DATASETS = MARKET_DATA;

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
    updateUrlSeed(config.seed);
  }, [config.seed]);

  useEffect(() => {
    setRun(createRun(config));
  }, [config]);

  const bot = BOTS[run.botId];
  const currentBar = run.segment[run.currentIndex];
  const previousBar = run.segment[Math.max(0, run.currentIndex - 1)];
  const historyBars = run.segment.slice(0, run.currentIndex + 1);
  const isFinished = run.status === "finished";
  const playerPnl = run.player.realized + run.player.unrealized;
  const aiPnl = run.ai.realized + run.ai.unrealized;
  const playerAdvantage = playerPnl - aiPnl;
  const runProgress = Math.round((run.turn / run.maxTurns) * 100);
  const portfolioStats = getPortfolioStats(profile, run);
  const priceChange = (currentBar.close - previousBar.close) / previousBar.close;
  const replayUrl = `${window.location.origin}${window.location.pathname}?seed=${encodeURIComponent(run.seed)}`;

  function startMode(mode) {
    const nextConfig =
      mode === "daily"
        ? createDailyConfig(profile.lastBot)
        : mode === "ai"
          ? createConfig(randomSeed(), profile.lastBot)
          : createConfig(randomSeed(), "ape");

    setConfig({
      ...nextConfig,
      mode,
      botId: mode === "free" ? "ape" : nextConfig.botId,
    });
    setShareMessage("");
  }

  function restartRun() {
    setRun(createRun(config));
    setShareMessage("");
  }

  function rematchBot() {
    const nextConfig = createConfig(randomSeed(), run.botId, config.mode);
    setConfig(nextConfig);
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
    setConfig((current) => ({
      ...current,
      botId,
      mode: "ai",
    }));
    setProfile((current) => ({
      ...current,
      lastBot: botId,
    }));
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
      <header className="command-bar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Swords size={22} />
          </div>
          <div>
            <p>Trading Arcade</p>
            <h1>{run.market.symbol} Blitz</h1>
          </div>
        </div>

        <div className="mode-switcher" aria-label="Game modes">
          <button type="button" className={config.mode === "daily" ? "mode-tab active" : "mode-tab"} onClick={() => startMode("daily")}>
            <Flame size={16} />
            Daily
          </button>
          <button type="button" className={config.mode === "ai" ? "mode-tab active" : "mode-tab"} onClick={() => startMode("ai")}>
            <Bot size={16} />
            AI Battle
          </button>
          <button type="button" className={config.mode === "free" ? "mode-tab active" : "mode-tab"} onClick={() => startMode("free")}>
            <Play size={16} />
            Free Play
          </button>
        </div>

        <label className="callsign-field">
          <UserRound size={16} />
          <input aria-label="Callsign" value={profile.callsign} onChange={handleCallsignChange} />
        </label>
      </header>

      <section className="portfolio-strip" aria-label="Portfolio statistics">
        <StatTile icon={CircleDollarSign} label="Equity" value={formatCurrency(portfolioStats.equity)} trend={portfolioStats.livePnl} />
        <StatTile icon={Activity} label="Live PnL" value={formatCurrency(portfolioStats.livePnl)} trend={portfolioStats.livePnl} />
        <StatTile icon={Trophy} label="Best Run" value={formatCurrency(profile.bestScore)} trend={profile.bestScore} />
        <StatTile icon={BarChart3} label="Win Rate" value={`${portfolioStats.winRate}%`} />
        <StatTile icon={Zap} label="Streak" value={formatStreak(profile.streak)} trend={profile.streak} />
        <StatTile icon={Gauge} label="Risk" value={getRiskState(run.player)} />
      </section>

      <section className="cockpit-grid">
        <div className="market-panel panel">
          <div className="market-header">
            <div>
              <p className="section-kicker">Live Arena</p>
              <div className="instrument-row">
                <h2>{run.market.symbol}</h2>
                <span className={priceChange >= 0 ? "price-pill up" : "price-pill down"}>
                  {priceChange >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {formatPercent(priceChange)}
                </span>
              </div>
            </div>
            <div className="price-stack">
              <span>Last Close</span>
              <strong>{formatPrice(currentBar.close)}</strong>
            </div>
          </div>

          <div className="progress-rail">
            <div>
              <span>Round {run.turn + 1}</span>
              <strong>{run.maxTurns - run.turn} bars left</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${runProgress}%` }} />
            </div>
            <div>
              <span>Advantage</span>
              <strong className={playerAdvantage >= 0 ? "up" : "down"}>{formatCurrency(playerAdvantage)}</strong>
            </div>
          </div>

          <PriceChart bars={historyBars} player={run.player} ai={run.ai} />

          <div className="market-stats">
            <MetricCard label="Player PnL" value={formatCurrency(playerPnl)} positive={playerPnl >= 0} />
            <MetricCard label="AI PnL" value={formatCurrency(aiPnl)} positive={aiPnl >= 0} />
            <MetricCard label="Position" value={run.player.position.toUpperCase()} />
            <MetricCard label="Replay" value={run.seed} compact />
          </div>
        </div>

        <aside className="side-stack">
          <div className="rival-panel panel">
            <div className="rival-glow" />
            <div className="rival-head">
              <div>
                <p className="section-kicker">Opponent</p>
                <h2>{bot.name}</h2>
              </div>
              <span>{bot.style}</span>
            </div>
            <p className="rival-title">{bot.title}</p>
            <p className="rival-copy">{bot.flavor}</p>
            <div className="tell-box">
              <span>{run.summary.aiActionLabel}</span>
              <strong>{run.summary.aiTell}</strong>
              <p>{run.summary.aiReason}</p>
            </div>
          </div>

          <div className="ticket-panel panel">
            <div className="panel-title">
              <Crosshair size={18} />
              <h3>Order Ticket</h3>
            </div>
            <div className="leverage-control">
              <span>Leverage</span>
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
            </div>
            <div className="action-grid">
              <button type="button" className="action-button buy" onClick={() => handleAction("long")}>
                <TrendingUp size={20} />
                Long
              </button>
              <button type="button" className="action-button sell" onClick={() => handleAction("short")}>
                <TrendingDown size={20} />
                Short
              </button>
              <button type="button" className="action-button hold" onClick={() => handleAction("hold")}>
                <Shield size={20} />
                Hold
              </button>
              <button type="button" className="action-button close" onClick={() => handleAction("close")}>
                <Target size={20} />
                Close
              </button>
            </div>
            <div className="utility-row">
              <button type="button" className="icon-button" onClick={restartRun} aria-label="Restart run">
                <RotateCcw size={18} />
                Restart
              </button>
              <button type="button" className="icon-button" onClick={rematchBot} aria-label="Generate new seed">
                <Shuffle size={18} />
                Seed
              </button>
              <button type="button" className="icon-button" onClick={shareRun} aria-label="Share run">
                <Share2 size={18} />
                Share
              </button>
            </div>
            {shareMessage ? <p className="share-output">{shareMessage}</p> : null}
          </div>
        </aside>
      </section>

      <section className="systems-grid">
        <div className="panel mode-panel">
          <div className="panel-title">
            <Play size={18} />
            <h3>Mode Deck</h3>
          </div>
          <div className="mode-list">
            <ModeCard title="Daily Run" description="Same seed for everyone today." active={config.mode === "daily"} onClick={() => startMode("daily")} />
            <ModeCard title="AI Battle" description="Pick an unlocked bot profile." active={config.mode === "ai"} onClick={() => startMode("ai")} />
            <ModeCard title="Free Play" description="Random sandbox seed." active={config.mode === "free"} onClick={() => startMode("free")} />
          </div>
        </div>

        <div className="panel bot-panel">
          <div className="panel-title">
            <Bot size={18} />
            <h3>Bot Roster</h3>
          </div>
          <div className="bot-list">
            {Object.values(BOTS).map((entry) => {
              const locked = !profile.unlockedBots.includes(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={entry.id === config.botId ? "bot-tile active" : "bot-tile"}
                  onClick={() => changeBot(entry.id)}
                  disabled={locked}
                  style={{ "--tile-accent": entry.accent }}
                >
                  <span>{entry.name}</span>
                  <small>{locked ? "Locked" : entry.title}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel summary-panel">
          <div className="panel-title">
            <Trophy size={18} />
            <h3>Run Summary</h3>
          </div>
          <div className="summary-grid">
            <MetricCard label="Player" value={Math.round(run.summary.playerTotal)} positive={run.summary.playerTotal >= run.summary.aiTotal} />
            <MetricCard label="AI" value={Math.round(run.summary.aiTotal)} positive={run.summary.aiTotal > run.summary.playerTotal} />
            <MetricCard label="Winner" value={isFinished ? run.summary.winnerLabel : "Pending"} />
            <MetricCard label="Total PnL" value={formatCurrency(profile.cumulativePnl)} positive={profile.cumulativePnl >= 0} />
          </div>
          <p className="summary-copy">{run.summary.narrative}</p>
        </div>
      </section>
    </main>
  );
}

function StatTile({ icon: Icon, label, value, trend }) {
  const trendClass = trend === undefined ? "" : trend >= 0 ? " positive" : " negative";
  return (
    <div className={`stat-tile${trendClass}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({ label, value, positive, compact }) {
  return (
    <div className={`${positive === undefined ? "metric-card" : positive ? "metric-card positive" : "metric-card negative"}${compact ? " compact-metric" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ModeCard({ title, description, active, onClick }) {
  return (
    <button type="button" className={active ? "mode-card active" : "mode-card"} onClick={onClick}>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

function PriceChart({ bars, player, ai }) {
  const width = 960;
  const height = 420;
  const padding = 28;
  const lows = bars.map((bar) => bar.low);
  const highs = bars.map((bar) => bar.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;
  const candleWidth = Math.max(4, (width - padding * 2) / bars.length - 2);

  function scaleX(index) {
    return padding + ((width - padding * 2) / Math.max(1, bars.length - 1)) * index;
  }

  function scaleY(value) {
    return height - padding - ((value - min) / range) * (height - padding * 2);
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Market chart">
        <defs>
          <linearGradient id="bg-glow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(123, 236, 255, 0.18)" />
            <stop offset="100%" stopColor="rgba(123, 236, 255, 0)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="24" fill="rgba(4, 12, 35, 0.88)" />
        {[0, 1, 2, 3].map((line) => {
          const y = padding + ((height - padding * 2) / 3) * line;
          return <line key={line} x1={padding} y1={y} x2={width - padding} y2={y} className="grid-line" />;
        })}
        <path
          d={`M ${bars.map((bar, index) => `${scaleX(index)} ${scaleY(bar.close)}`).join(" L ")}`}
          fill="none"
          stroke="rgba(125, 224, 255, 0.25)"
          strokeWidth="3"
        />
        {bars.map((bar, index) => {
          const x = scaleX(index);
          const yOpen = scaleY(bar.open);
          const yClose = scaleY(bar.close);
          const yHigh = scaleY(bar.high);
          const yLow = scaleY(bar.low);
          const rising = bar.close >= bar.open;
          return (
            <g key={bar.time}>
              <line x1={x} y1={yHigh} x2={x} y2={yLow} className={rising ? "wick up" : "wick down"} />
              <rect
                x={x - candleWidth / 2}
                y={Math.min(yOpen, yClose)}
                width={candleWidth}
                height={Math.max(3, Math.abs(yOpen - yClose))}
                rx="3"
                className={rising ? "candle up" : "candle down"}
              />
            </g>
          );
        })}
        <PositionMarker label="YOU" color="#8cff9c" price={player.entryPrice} visible={player.position !== "flat"} scaleY={scaleY} width={width} />
        <PositionMarker label="AI" color="#ffb86b" price={ai.entryPrice} visible={ai.position !== "flat"} scaleY={scaleY} width={width} />
      </svg>
    </div>
  );
}

function PositionMarker({ label, color, price, visible, scaleY, width }) {
  if (!visible || !price) return null;
  const y = scaleY(price);
  return (
    <g>
      <line x1="24" y1={y} x2={width - 24} y2={y} stroke={color} strokeDasharray="8 10" strokeWidth="1.5" opacity="0.8" />
      <rect x={width - 92} y={y - 15} width="68" height="30" rx="15" fill={color} />
      <text x={width - 58} y={y + 5} textAnchor="middle" fill="#08111f" fontSize="12" fontWeight="700">
        {label}
      </text>
    </g>
  );
}

function createRun(config) {
  const random = mulberry32(hashSeed(config.seed));
  const market = DATASETS[Math.floor(random() * DATASETS.length)];
  const span = PREVIEW_BARS + RUN_BARS + 2;
  const maxStart = Math.max(PREVIEW_BARS + 1, market.candles.length - span - 1);
  const start = PREVIEW_BARS + Math.floor(random() * maxStart);
  const segment = market.candles.slice(start - PREVIEW_BARS, start + RUN_BARS + 1);

  return {
    seed: config.seed,
    mode: config.mode,
    botId: config.botId,
    market,
    segment,
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
      narrative: "Take a position before the next bar resolves.",
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
  const currentBar = run.segment[run.currentIndex];
  const nextBar = run.segment[run.currentIndex + 1];
  if (!nextBar) return finishRun(run);

  const botDecision = decideBotAction(run, currentBar);
  const player = settleTrader(applyAction(run.player, action, currentBar.close), currentBar.close, nextBar.close);
  const ai = settleTrader(applyAction(run.ai, botDecision.action, currentBar.close), currentBar.close, nextBar.close);
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
  const playerTotal = run.player.realized + run.player.unrealized;
  const aiTotal = run.ai.realized + run.ai.unrealized;
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
          ? "You managed the tape better than the bot."
          : winner === "ai"
            ? "The bot exploited the run more efficiently."
            : "Dead heat. Run it back on a fresh seed.",
    },
  };
}

function decideBotAction(run, currentBar) {
  const bot = run.botId;
  const closes = run.segment.slice(Math.max(0, run.currentIndex - 5), run.currentIndex + 1).map((bar) => bar.close);
  const momentum = closes.length > 1 ? (closes[closes.length - 1] - closes[0]) / closes[0] : 0;
  const shortSwing = closes.length > 2 ? (closes[closes.length - 1] - closes[closes.length - 3]) / closes[closes.length - 3] : 0;
  const volatility = currentBar.high && currentBar.low ? (currentBar.high - currentBar.low) / currentBar.close : 0;

  if (bot === "ape") {
    if (momentum > 0.02) return { action: "long", label: "Breakout Chase", tell: "Adds into strength", reason: "Ape saw persistent upside momentum and piled into the move." };
    if (momentum < -0.02) return { action: "short", label: "Flush Chase", tell: "Sells the panic", reason: "Ape detected a downside cascade and pressed the short." };
    return { action: "hold", label: "Loading", tell: "Waiting for ignition", reason: "Ape wants a cleaner impulse before committing." };
  }

  if (bot === "scalper") {
    if (Math.abs(shortSwing) > 0.012) {
      return {
        action: shortSwing > 0 ? "long" : "short",
        label: "Micro Burst",
        tell: "Fast entry",
        reason: "Scalper reacted to a short-term burst and wants the next bar only.",
      };
    }
    return { action: "close", label: "Flat Reset", tell: "Books quickly", reason: "Scalper saw no immediate edge and flattened risk." };
  }

  if (bot === "mean-reverter") {
    if (momentum > 0.025 || volatility > 0.03) {
      return { action: "short", label: "Fade High", tell: "Leans against stretch", reason: "Mean Reverter expects the spike to cool off." };
    }
    if (momentum < -0.025) {
      return { action: "long", label: "Catch Snapback", tell: "Buys exhaustion", reason: "Mean Reverter is fading a move that looks overstretched." };
    }
    return { action: "hold", label: "Balanced", tell: "Waiting near fair value", reason: "Mean Reverter does not see enough dislocation yet." };
  }

  if (momentum > 0.015) {
    return { action: run.ai.position === "long" ? "hold" : "long", label: "Conviction Build", tell: "Keeps core on", reason: "Diamond Hands is building and holding a long bias." };
  }
  if (momentum < -0.015) {
    return { action: run.ai.position === "short" ? "hold" : "short", label: "Conviction Hedge", tell: "Sits through chop", reason: "Diamond Hands wants to stay with the dominant downside move." };
  }
  return { action: "hold", label: "Stoic Hold", tell: "Minimal churn", reason: "Diamond Hands prefers not to overtrade a flat tape." };
}

function buildNarrative(player, ai) {
  const spread = player.realized + player.unrealized - (ai.realized + ai.unrealized);
  if (spread > 120) return "You are decisively ahead. Protect the lead or press the advantage.";
  if (spread < -120) return "The bot has tempo. You need a cleaner entry or better exit discipline.";
  if (player.position === "flat") return "You are flat. The next decision determines your next edge.";
  return "The battle is tight. Your open risk still matters.";
}

function buildShareMessage(run, callsign, replayUrl) {
  const playerTotal = Math.round(run.player.realized + run.player.unrealized);
  const aiTotal = Math.round(run.ai.realized + run.ai.unrealized);
  return `${callsign} posted ${playerTotal} in Trading Arcade against ${BOTS[run.botId].name} (${aiTotal}). Replay seed ${run.seed}: ${replayUrl}`;
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
  return STARTING_BANKROLL + trader.realized + trader.unrealized;
}

function getPortfolioStats(profile, run) {
  const livePnl = run.player.realized + run.player.unrealized;
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
  const total = player.realized + player.unrealized;
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

function createConfig(seed, preferredBot = "ape", mode = "ai") {
  return {
    seed,
    botId: mode === "daily" ? createDailyConfig(preferredBot).botId : preferredBot,
    mode,
  };
}

function createDailyConfig(preferredBot = "ape") {
  const today = new Date();
  const dailySeed = `daily-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const botId = DAILY_BOT_ROTATION[hashSeed(dailySeed) % DAILY_BOT_ROTATION.length] || preferredBot;
  return {
    seed: dailySeed,
    botId,
    mode: "daily",
  };
}

function getInitialConfig() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get("seed");
  if (seed) return createConfig(seed, "ape");
  return createDailyConfig();
}

function updateUrlSeed(seed) {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", seed);
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
