"use client"

import { useState, useEffect } from "react"
import { GameLobby } from "./game-lobby"
import { GameCanvas } from "./game-canvas"
import { LocalGameCanvas } from "./local-game-canvas"
import { SoloGameCanvas } from "./solo-game-canvas"
import { GameProvider } from "./game-context"
import { sounds } from "@/lib/sounds"
import type { Difficulty } from "@/lib/cpu-ai"

export type GameScreen = "menu" | "lobby" | "game" | "local" | "solo" | "difficulty"

export function NESGame() {
  const [screen, setScreen] = useState<GameScreen>("menu")
  const [roomId, setRoomId] = useState<string | null>(null)
  const [playerTeam, setPlayerTeam] = useState<"home" | "away">("home")
  const [playerName, setPlayerName] = useState("Player")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")

  useEffect(() => {
    const initSounds = () => {
      sounds.init()
      window.removeEventListener("click", initSounds)
      window.removeEventListener("keydown", initSounds)
    }
    window.addEventListener("click", initSounds)
    window.addEventListener("keydown", initSounds)
    return () => {
      window.removeEventListener("click", initSounds)
      window.removeEventListener("keydown", initSounds)
    }
  }, [])

  const handleJoinGame = (room: string, team: "home" | "away", name: string) => {
    setRoomId(room)
    setPlayerTeam(team)
    setPlayerName(name)
    setScreen("game")
  }

  const handleBackToMenu = () => {
    setScreen("menu")
    setRoomId(null)
  }

  const handlePlayOnline = () => {
    sounds.select()
    setScreen("lobby")
  }

  const handlePlayLocal = () => {
    sounds.select()
    setScreen("local")
  }

  const handlePlaySolo = () => {
    sounds.select()
    setScreen("difficulty")
  }

  const handleSelectDifficulty = (diff: Difficulty) => {
    sounds.select()
    setDifficulty(diff)
    setScreen("solo")
  }

  return (
    <GameProvider>
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
        <MatrixBackground />

        <div className="relative z-10">
          {screen === "menu" && (
            <MainMenu onPlayOnline={handlePlayOnline} onPlayLocal={handlePlayLocal} onPlaySolo={handlePlaySolo} />
          )}
          {screen === "difficulty" && <DifficultySelect onSelect={handleSelectDifficulty} onBack={handleBackToMenu} />}
          {screen === "lobby" && <GameLobby onJoinGame={handleJoinGame} onBack={handleBackToMenu} />}
          {screen === "game" && roomId && (
            <GameCanvas roomId={roomId} playerTeam={playerTeam} playerName={playerName} onExit={handleBackToMenu} />
          )}
          {screen === "local" && <LocalGameCanvas onExit={handleBackToMenu} />}
          {screen === "solo" && <SoloGameCanvas difficulty={difficulty} onExit={handleBackToMenu} />}
        </div>
      </div>
    </GameProvider>
  )
}

function MatrixBackground() {
  return (
    <>
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,136,0.1) 1px, rgba(0,255,136,0.1) 2px)",
          backgroundSize: "100% 3px",
        }}
      />

      {/* Matrix rain effect using CSS */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-[#00ff88] font-mono text-xs whitespace-nowrap animate-matrix-rain"
            style={{
              left: `${i * 5}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 10}s`,
            }}
          >
            {Array.from({ length: 30 }).map((_, j) => (
              <div key={j} className="opacity-30">
                {String.fromCharCode(0x30a0 + Math.random() * 96)}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Corner glow effects */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#00ff88] opacity-[0.02] blur-[100px] rounded-full" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#00ff88] opacity-[0.02] blur-[100px] rounded-full" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,136,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
    </>
  )
}

function DifficultySelect({
  onSelect,
  onBack,
}: {
  onSelect: (diff: Difficulty) => void
  onBack: () => void
}) {
  const [hoveredDiff, setHoveredDiff] = useState<Difficulty | null>(null)

  const difficulties: { key: Difficulty; label: string; desc: string; color: string }[] = [
    { key: "easy", label: "ROOKIE", desc: "Slower AI, more mistakes", color: "#4ade80" },
    { key: "medium", label: "PRO", desc: "Balanced challenge", color: "#fbbf24" },
    { key: "hard", label: "LEGEND", desc: "Quick reactions, smart plays", color: "#f87171" },
  ]

  return (
    <div className="text-center">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 text-[#00ff88] font-mono hover:text-[#00cc6a] transition-colors text-sm"
      >
        &larr; BACK
      </button>

      <h2 className="text-4xl font-bold text-[#00ff88] mb-2 font-mono tracking-wider drop-shadow-[0_0_10px_rgba(0,255,136,0.5)]">
        SELECT DIFFICULTY
      </h2>
      <p className="text-[#666] font-mono text-sm mb-8">Choose your challenge level</p>

      <div className="space-y-4">
        {difficulties.map((diff) => (
          <button
            key={diff.key}
            onClick={() => onSelect(diff.key)}
            onMouseEnter={() => {
              setHoveredDiff(diff.key)
              sounds.hover()
            }}
            onMouseLeave={() => setHoveredDiff(null)}
            className="w-72 py-4 px-6 font-mono font-bold text-xl transition-all border-2 block mx-auto relative overflow-hidden group"
            style={{
              backgroundColor: hoveredDiff === diff.key ? diff.color : "#1a1a2e",
              color: hoveredDiff === diff.key ? "#0a0a0f" : diff.color,
              borderColor: diff.color,
              boxShadow:
                hoveredDiff === diff.key
                  ? `0 0 20px ${diff.color}40, inset 0 0 20px ${diff.color}20`
                  : `4px 4px 0px ${diff.color}40`,
            }}
          >
            <span className="relative z-10">{diff.label}</span>
            <div className="text-xs font-normal mt-1 opacity-70 relative z-10">{diff.desc}</div>

            {/* Hover scanline effect */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)",
              }}
            />
          </button>
        ))}
      </div>

      {/* Gamepad hint */}
      <div className="mt-8 text-[#444] font-mono text-xs">
        <p>🎮 Gamepad supported: A=Shoot, X=Pass, B=Slide, Y=Grab</p>
      </div>
    </div>
  )
}

function MainMenu({
  onPlayOnline,
  onPlayLocal,
  onPlaySolo,
}: {
  onPlayOnline: () => void
  onPlayLocal: () => void
  onPlaySolo: () => void
}) {
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

  return (
    <div className="text-center">
      {/* Logo with enhanced glow */}
      <div className="mb-10 relative">
        <div className="absolute inset-0 blur-3xl bg-[#00ff88] opacity-10" />
        <h1
          className="text-7xl font-bold text-[#00ff88] mb-2 font-mono tracking-wider relative
                       drop-shadow-[0_0_20px_rgba(0,255,136,0.6)]
                       animate-pulse-subtle"
        >
          NES SOCCER
        </h1>
        <div className="flex items-center justify-center gap-2">
          <div className="h-px flex-1 max-w-20 bg-gradient-to-r from-transparent to-[#00ff88]" />
          <p className="text-[#00ff88] font-mono text-sm tracking-[0.3em]">5v5 MULTIPLAYER</p>
          <div className="h-px flex-1 max-w-20 bg-gradient-to-l from-transparent to-[#00ff88]" />
        </div>
      </div>

      {/* Menu buttons with hover effects */}
      <div className="space-y-4">
        <MenuButton
          label="1P VS CPU"
          color="#ff44ff"
          darkColor="#cc22cc"
          shadowColor="#881188"
          isHovered={hoveredBtn === "solo"}
          onHover={() => setHoveredBtn("solo")}
          onLeave={() => setHoveredBtn(null)}
          onClick={onPlaySolo}
        />

        <MenuButton
          label="LOCAL 2P"
          color="#ff8844"
          darkColor="#cc6633"
          shadowColor="#884422"
          isHovered={hoveredBtn === "local"}
          onHover={() => setHoveredBtn("local")}
          onLeave={() => setHoveredBtn(null)}
          onClick={onPlayLocal}
        />

        <MenuButton
          label="PLAY ONLINE"
          color="#00ff88"
          darkColor="#00cc6a"
          shadowColor="#008844"
          isHovered={hoveredBtn === "online"}
          onHover={() => setHoveredBtn("online")}
          onLeave={() => setHoveredBtn(null)}
          onClick={onPlayOnline}
        />
      </div>

      {/* Controls reference - updated */}
      <div
        className="mt-10 bg-[#12121a] border border-[#00ff8830] p-5 rounded-lg max-w-lg mx-auto
                      shadow-[0_0_30px_rgba(0,255,136,0.05),inset_0_1px_0_rgba(255,255,255,0.05)]"
      >
        <h3 className="text-[#00ff88] font-mono font-bold mb-4 tracking-wider">CONTROLS</h3>

        <div className="grid grid-cols-3 gap-4 text-left text-xs">
          <div className="border-r border-[#00ff8820] pr-4">
            <p className="text-[#ff6b9f] font-mono font-bold mb-2">PLAYER 1</p>
            <div className="text-[#777] font-mono space-y-1">
              <p>
                <span className="text-[#aaa]">WASD</span> Move
              </p>
              <p>
                <span className="text-[#aaa]">SPACE</span> Shoot
              </p>
              <p>
                <span className="text-[#aaa]">Q</span> Pass
              </p>
              <p>
                <span className="text-[#aaa]">SHIFT</span> Slide
              </p>
              <p>
                <span className="text-[#aaa]">E</span> Grab
              </p>
            </div>
          </div>

          <div className="border-r border-[#00ff8820] pr-4 pl-2">
            <p className="text-[#6bb5ff] font-mono font-bold mb-2">PLAYER 2</p>
            <div className="text-[#777] font-mono space-y-1">
              <p>
                <span className="text-[#aaa]">ARROWS</span> Move
              </p>
              <p>
                <span className="text-[#aaa]">ENTER</span> Shoot
              </p>
              <p>
                <span className="text-[#aaa]">.</span> Pass
              </p>
              <p>
                <span className="text-[#aaa]">/</span> Slide
              </p>
              <p>
                <span className="text-[#aaa]">0</span> Grab
              </p>
            </div>
          </div>

          <div className="pl-2">
            <p className="text-[#ffbb44] font-mono font-bold mb-2">GAMEPAD</p>
            <div className="text-[#777] font-mono space-y-1">
              <p>
                <span className="text-[#aaa]">L-STICK</span> Move
              </p>
              <p>
                <span className="text-[#aaa]">A/R1</span> Shoot
              </p>
              <p>
                <span className="text-[#aaa]">X/L1</span> Pass
              </p>
              <p>
                <span className="text-[#aaa]">B/L2</span> Slide
              </p>
              <p>
                <span className="text-[#aaa]">Y/R2</span> Grab
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="mt-8 text-[#333] font-mono text-xs tracking-widest">v2.0 // MATRIX EDITION</div>
    </div>
  )
}

function MenuButton({
  label,
  color,
  darkColor,
  shadowColor,
  isHovered,
  onHover,
  onLeave,
  onClick,
}: {
  label: string
  color: string
  darkColor: string
  shadowColor: string
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => {
        onHover()
        sounds.hover()
      }}
      onMouseLeave={onLeave}
      className="w-64 py-4 font-mono font-bold text-xl transition-all relative overflow-hidden group"
      style={{
        backgroundColor: color,
        color: "#0a0a0f",
        border: `3px solid ${darkColor}`,
        boxShadow: isHovered ? `0 0 30px ${color}60, 0 0 60px ${color}30` : `4px 4px 0px ${shadowColor}`,
        transform: isHovered ? "translate(-2px, -2px)" : "none",
      }}
    >
      <span className="relative z-10">{label}</span>

      {/* Scanline hover effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
        }}
      />

      {/* Shine effect */}
      <div
        className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
        }}
      />
    </button>
  )
}
