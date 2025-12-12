"use client"

import { useState, useEffect } from "react"
import { GameLobby } from "./game-lobby"
import { GameCanvas } from "./game-canvas"
import { LocalGameCanvas } from "./local-game-canvas"
import { GameProvider } from "./game-context"
import { sounds } from "@/lib/sounds"

export type GameScreen = "menu" | "lobby" | "game" | "local"

export function NESGame() {
  const [screen, setScreen] = useState<GameScreen>("menu")
  const [roomId, setRoomId] = useState<string | null>(null)
  const [playerTeam, setPlayerTeam] = useState<"home" | "away">("home")
  const [playerName, setPlayerName] = useState("Player")

  // Initialize sounds on first interaction
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

  return (
    <GameProvider>
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
        {screen === "menu" && <MainMenu onPlayOnline={handlePlayOnline} onPlayLocal={handlePlayLocal} />}
        {screen === "lobby" && <GameLobby onJoinGame={handleJoinGame} onBack={handleBackToMenu} />}
        {screen === "game" && roomId && (
          <GameCanvas roomId={roomId} playerTeam={playerTeam} playerName={playerName} onExit={handleBackToMenu} />
        )}
        {screen === "local" && <LocalGameCanvas onExit={handleBackToMenu} />}
      </div>
    </GameProvider>
  )
}

function MainMenu({ onPlayOnline, onPlayLocal }: { onPlayOnline: () => void; onPlayLocal: () => void }) {
  return (
    <div className="text-center">
      {/* Title with glow effect */}
      <div className="mb-8">
        <h1 className="text-6xl font-bold text-[#00ff88] mb-2 font-mono tracking-wider drop-shadow-[0_0_10px_rgba(0,255,136,0.5)]">
          NES SOCCER
        </h1>
        <p className="text-[#888] font-mono text-sm">5v5 MULTIPLAYER</p>
      </div>

      {/* Menu buttons */}
      <div className="space-y-4">
        <button
          onClick={onPlayOnline}
          className="w-64 py-4 bg-[#00ff88] text-[#1a1a2e] font-mono font-bold text-xl 
                     hover:bg-[#00cc6a] transition-all border-4 border-[#00cc6a]
                     shadow-[4px_4px_0px_#008844] active:shadow-none active:translate-x-1 active:translate-y-1
                     hover:scale-105"
        >
          PLAY ONLINE
        </button>

        <button
          onClick={onPlayLocal}
          className="w-64 py-4 bg-[#ff8844] text-[#1a1a2e] font-mono font-bold text-xl 
                     hover:bg-[#cc6633] transition-all border-4 border-[#cc6633]
                     shadow-[4px_4px_0px_#884422] active:shadow-none active:translate-x-1 active:translate-y-1
                     hover:scale-105"
        >
          LOCAL 2P
        </button>
      </div>

      {/* Controls reference */}
      <div className="mt-10 bg-[#252542] border-4 border-[#3a3a5c] p-4 rounded max-w-md mx-auto">
        <h3 className="text-[#00ff88] font-mono font-bold mb-3">CONTROLS</h3>

        <div className="grid grid-cols-2 gap-4 text-left">
          <div className="border-r border-[#3a3a5c] pr-4">
            <p className="text-[#ff6b6b] font-mono text-xs font-bold mb-2">PLAYER 1 (HOME)</p>
            <div className="text-[#888] font-mono text-xs space-y-1">
              <p>
                <span className="text-[#aaa]">WASD</span> - Move
              </p>
              <p>
                <span className="text-[#aaa]">SPACE</span> - Shoot
              </p>
              <p>
                <span className="text-[#aaa]">Q</span> - Pass
              </p>
              <p>
                <span className="text-[#aaa]">SHIFT</span> - Slide
              </p>
              <p>
                <span className="text-[#aaa]">E</span> - Grab (GK)
              </p>
            </div>
          </div>

          <div className="pl-2">
            <p className="text-[#6b9fff] font-mono text-xs font-bold mb-2">PLAYER 2 (AWAY)</p>
            <div className="text-[#888] font-mono text-xs space-y-1">
              <p>
                <span className="text-[#aaa]">ARROWS</span> - Move
              </p>
              <p>
                <span className="text-[#aaa]">ENTER</span> - Shoot
              </p>
              <p>
                <span className="text-[#aaa]">.</span> - Pass
              </p>
              <p>
                <span className="text-[#aaa]">/</span> - Slide
              </p>
              <p>
                <span className="text-[#aaa]">0</span> - Grab (GK)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="mt-8 text-[#444] font-mono text-xs">v1.2 - CLASSIC EDITION</div>
    </div>
  )
}
