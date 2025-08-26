import React, { useEffect, useMemo, useRef, useState } from "react";

// ================================
// Moo Mines – Updated Version
// - Multiplier starts at 1.00x, only increases after first safe tile
// - Removed Safe Revealed counter for minimal UI
// - Balance + claim system (100 pts every 6hrs)
// - Uses localStorage to persist balance and claim cooldown
// ================================

const COW_IMG =
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f404.svg"; // 🐄
const BEAR_IMG =
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f43b.svg"; // 🐻

const MOO_SFX = "https://actions.google.com/sounds/v1/animals/cow.ogg";
const BEAR_SFX = "https://actions.google.com/sounds/v1/animals/bear_growl.ogg";

const SIZE = 5;
const TOTAL_TILES = SIZE * SIZE;
const SAFE_TILES = TOTAL_TILES - 1;
const MIN_MULT = 1.0;
const MAX_MULT = 20.0;
const CLAIM_AMOUNT = 100;
const CLAIM_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in ms

function curvedMultiplier(safeRevealed) {
  if (safeRevealed === 0) return 1.0; // baseline
  const gamma = 2.2;
  const t = Math.min(Math.max(safeRevealed / SAFE_TILES, 0), 1);
  const m = 1.05 + (MAX_MULT - 1.05) * Math.pow(t, gamma);
  return Number(m.toFixed(2));
}

function randomMineIndex() {
  return Math.floor(Math.random() * TOTAL_TILES);
}

function useAudio(url) {
  const ref = useRef(null);
  useEffect(() => {
    const audio = new Audio(url);
    audio.preload = "auto";
    ref.current = audio;
    return () => {
      audio.pause();
      ref.current = null;
    };
  }, [url]);
  const play = () => {
    if (ref.current) {
      ref.current.currentTime = 0;
      ref.current.play();
    }
  };
  return play;
}

export default function MooMines() {
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem("moo_balance");
    return saved ? Number(saved) : 1000;
  });
  const [wager, setWager] = useState(50);
  const [mineIdx, setMineIdx] = useState(() => randomMineIndex());
  const [revealed, setRevealed] = useState(() => Array(TOTAL_TILES).fill(false));
  const [gameState, setGameState] = useState("idle");
  const [safeRevealed, setSafeRevealed] = useState(0);

  const [lastClaim, setLastClaim] = useState(() => {
    const saved = localStorage.getItem("moo_lastClaim");
    return saved ? Number(saved) : 0;
  });

  const moo = useAudio(MOO_SFX);
  const bear = useAudio(BEAR_SFX);

  const currentMultiplier = useMemo(
    () => curvedMultiplier(safeRevealed),
    [safeRevealed]
  );

  const potentialPayout = useMemo(
    () => Number((wager * currentMultiplier).toFixed(2)),
    [wager, currentMultiplier]
  );

  // Persist balance & last claim
  useEffect(() => {
    localStorage.setItem("moo_balance", balance);
  }, [balance]);

  useEffect(() => {
    localStorage.setItem("moo_lastClaim", lastClaim);
  }, [lastClaim]);

  const startGame = () => {
    const w = Math.max(1, Math.min(wager, balance));
    if (w <= 0) return;
    setWager(w);
    setBalance((b) => Number((b - w).toFixed(2)));
    setRevealed(Array(TOTAL_TILES).fill(false));
    setMineIdx(randomMineIndex());
    setSafeRevealed(0);
    setGameState("playing");
  };

  const revealTile = (idx) => {
    if (gameState !== "playing") return;
    if (revealed[idx]) return;

    const newRevealed = revealed.slice();
    newRevealed[idx] = true;
    setRevealed(newRevealed);

    if (idx === mineIdx) {
      bear();
      setGameState("busted");
      return;
    }

    moo();
    setSafeRevealed((n) => n + 1);
  };

  const cashOut = () => {
    if (gameState !== "playing") return;
    const payout = potentialPayout;
    setBalance((b) => Number((b + payout).toFixed(2)));
    setGameState("cashout");
  };

  const resetRound = () => {
    setRevealed(Array(TOTAL_TILES).fill(false));
    setMineIdx(randomMineIndex());
    setSafeRevealed(0);
    setGameState("idle");
  };

  // Claim system
  const now = Date.now();
  const timeSinceClaim = now - lastClaim;
  const canClaim = timeSinceClaim >= CLAIM_INTERVAL;
  const timeLeft = CLAIM_INTERVAL - timeSinceClaim;

  const claimPoints = () => {
    if (!canClaim) return;
    setBalance((b) => b + CLAIM_AMOUNT);
    setLastClaim(Date.now());
  };

  // Format countdown
  function formatTime(ms) {
    if (ms <= 0) return "Ready!";
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  }

  const tileBase =
    "relative aspect-square w-full rounded-2xl shadow transition-all duration-200 select-none";

  const canClickTiles = gameState === "playing";
  const tiles = Array.from({ length: TOTAL_TILES }, (_, i) => i);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-green-200 via-emerald-100 to-amber-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">🐄 Moo Mines</h1>
            <p className="text-sm md:text-base text-neutral-700">
              5x5 board • 1 mine • Cash out anytime
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/70 backdrop-blur px-4 py-2 shadow">
              <div className="text-xs text-neutral-500">Balance</div>
              <div className="text-xl font-bold">{balance.toFixed(2)} MILK</div>
              {balance <= 0 && (
                <div className="mt-2 flex flex-col items-center">
                  <button
                    onClick={claimPoints}
                    disabled={!canClaim}
                    className="rounded-xl bg-emerald-500 text-white px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Claim {CLAIM_AMOUNT}
                  </button>
                  <span className="text-[10px] mt-1 text-neutral-500">
                    {canClaim ? "Ready to claim" : `Next: ${formatTime(timeLeft)}`}
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-white/70 backdrop-blur px-4 py-2 shadow">
              <div className="text-xs text-neutral-500">Wager</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={wager}
                  disabled={gameState === "playing"}
                  onChange={(e) => setWager(Number(e.target.value))}
                  className="w-24 rounded-xl border border-neutral-300 bg-white px-3 py-1 text-right focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <span className="text-sm text-neutral-600">pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={startGame}
            disabled={gameState === "playing" || balance <= 0}
            className="rounded-2xl px-5 py-2 font-semibold shadow bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gameState === "idle"
              ? "Start Round"
              : gameState === "cashout" || gameState === "busted"
                ? "Start New Round"
                : "Playing..."}
          </button>

          {gameState === "playing" && (
            <button
              onClick={cashOut}
              className="rounded-2xl px-5 py-2 font-semibold shadow bg-amber-500 text-white hover:bg-amber-600"
            >
              Cash Out ({potentialPayout.toFixed(2)} pts)
            </button>
          )}

          {(gameState === "cashout" || gameState === "busted") && (
            <button
              onClick={resetRound}
              className="rounded-2xl px-5 py-2 font-semibold shadow bg-neutral-600 text-white hover:bg-neutral-700"
            >
              Reset Board
            </button>
          )}

          <div className="ml-auto flex gap-3 text-sm">
            <InfoPill label="Multiplier" value={`${currentMultiplier.toFixed(2)}x`} />
          </div>
        </div>

        {/* Board */}
        <div className="grid grid-cols-5 gap-3 md:gap-4">
          {tiles.map((idx) => {
            const isOpen = revealed[idx];
            const isMine = idx === mineIdx;
            return (
              <button
                key={idx}
                onClick={() => revealTile(idx)}
                disabled={!canClickTiles || isOpen}
                className={
                  tileBase +
                  " bg-emerald-700/20 hover:bg-emerald-700/30 disabled:hover:bg-emerald-700/20 " +
                  (isOpen ? " bg-white " : "")
                }
                style={{
                  backgroundImage: !isOpen
                    ? "linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2)), url('https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?q=80&w=800&auto=format&fit=crop')"
                    : undefined,
                  backgroundSize: !isOpen ? "cover" : undefined,
                  backgroundPosition: !isOpen ? "center" : undefined,
                }}
              >
                {!isOpen ? (
                  <div className="absolute inset-0 rounded-2xl border-2 border-white/50 backdrop-blur-[1px]"></div>
                ) : (
                  <div className="absolute inset-0 p-2 flex flex-col items-center justify-center">
                    <img
                      src={isMine ? BEAR_IMG : COW_IMG}
                      alt={isMine ? "Bear" : "Cow"}
                      className="w-12 h-12 md:w-16 md:h-16 drop-shadow"
                    />
                    {!isMine ? (
                      <div className="mt-2 text-sm md:text-base font-semibold text-emerald-700">
                        {currentMultiplier.toFixed(2)}x
                      </div>
                    ) : (
                      <div className="mt-2 text-sm md:text-base font-semibold text-red-600">Boo</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Status Bar */}
        <div className="mt-6 rounded-2xl bg-white/70 backdrop-blur shadow p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌾</span>
            <span className="text-sm md:text-base text-neutral-700">
              {gameState === "idle" && "Set your wager and start the round."}
              {gameState === "playing" && "Pick tiles carefully. Cash out anytime!"}
              {gameState === "cashout" && "Nice! Winnings added to your balance."}
              {gameState === "busted" && "Oh no! You hit the bear. Wager lost."}
            </span>
          </div>
          <div className="text-xs md:text-sm text-neutral-500">
            Claim {CLAIM_AMOUNT} free pts every 6hrs if balance hits 0.
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur px-3 py-1 shadow flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}


