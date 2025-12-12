"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { sounds } from "@/lib/sounds"
import { drawPlayer, drawBall, drawField, type PlayerRenderState } from "@/lib/player-renderer"

interface GameCanvasProps {
  roomId: string
  playerTeam: "home" | "away"
  playerName: string
  onExit: () => void
}

interface Player {
  id: string
  name: string
  x: number
  y: number
  team: "home" | "away"
  isGoalkeeper: boolean
  hasBall: boolean
  isSliding: boolean
  slideTimer: number
  velocityX: number
  velocityY: number
  facingX: number
  facingY: number
  animFrame?: number
}

interface Ball {
  x: number
  y: number
  velocityX: number
  velocityY: number
  ownerId: string | null
  isGrabbed: boolean
}

interface GameStateNet {
  players: Player[]
  ball: Ball
  score: { home: number; away: number }
  gameTime: number
  isPlaying: boolean
  lastGoalTeam: "home" | "away" | null
  goalCelebration: number
}

const FIELD_WIDTH = 800
const FIELD_HEIGHT = 500
const BALL_SIZE = 12

const DEFAULT_STATE: GameStateNet = {
  players: [],
  ball: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, velocityX: 0, velocityY: 0, ownerId: null, isGrabbed: false },
  score: { home: 0, away: 0 },
  gameTime: 180,
  isPlaying: true,
  lastGoalTeam: null,
  goalCelebration: 0,
}

export function GameCanvas({ roomId, playerTeam, playerName, onExit }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number | null>(null)
  const keysRef = useRef<Set<string>>(new Set())
  const playerIdRef = useRef<string>(`player_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  const animFrameRef = useRef<number>(0)
  const lastScoreRef = useRef({ home: 0, away: 0 })
  const lastGoalCelebrationRef = useRef(0)

  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState<GameStateNet>(DEFAULT_STATE)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Initialize sounds
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

  useEffect(() => {
    let mounted = true
    let retryTimeout: NodeJS.Timeout | null = null

    const joinGame = async (attempt = 0) => {
      if (!mounted) return

      try {
        setConnectionError(null)
        const response = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "join",
            roomId,
            playerId: playerIdRef.current,
            playerName,
            team: playerTeam,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        if (data.success && mounted) {
          setConnected(true)
          setRetryCount(0)
          sounds.select()
        }
      } catch (error) {
        console.error("Failed to join game:", error)
        if (mounted && attempt < 5) {
          setConnectionError(`Connecting... (attempt ${attempt + 1}/5)`)
          retryTimeout = setTimeout(() => joinGame(attempt + 1), 1000 * (attempt + 1))
          setRetryCount(attempt + 1)
        } else if (mounted) {
          setConnectionError("Failed to connect. Please try again.")
        }
      }
    }

    joinGame()

    return () => {
      mounted = false
      if (retryTimeout) clearTimeout(retryTimeout)

      // Best-effort leave
      fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "leave",
          roomId,
          playerId: playerIdRef.current,
        }),
      }).catch(() => {})
    }
  }, [roomId, playerTeam, playerName])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase())
      if (
        ["w", "a", "s", "d", " ", "shift", "e", "q", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(
          e.key.toLowerCase(),
        )
      ) {
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const sendInputAndFetch = useCallback(async () => {
    if (!connected) return

    const keys = keysRef.current
    let dx = 0
    let dy = 0

    if (keys.has("w") || keys.has("arrowup")) dy -= 1
    if (keys.has("s") || keys.has("arrowdown")) dy += 1
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1
    if (keys.has("d") || keys.has("arrowright")) dx += 1

    const input = {
      dx,
      dy,
      shoot: keys.has(" "),
      slide: keys.has("shift"),
      grab: keys.has("e"),
      pass: keys.has("q"),
    }

    // Clear one-shot inputs
    if (input.shoot) keys.delete(" ")
    if (input.slide) keys.delete("shift")
    if (input.grab) keys.delete("e")
    if (input.pass) keys.delete("q")

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)

      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "input",
          roomId,
          playerId: playerIdRef.current,
          input,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const data = await response.json()
      if (data.state) {
        // Play sounds based on state changes
        const newState = data.state as GameStateNet

        // Goal scored
        if (newState.goalCelebration > 0 && lastGoalCelebrationRef.current === 0) {
          sounds.goal()
        }
        lastGoalCelebrationRef.current = newState.goalCelebration

        setGameState(newState)
        setConnectionError(null)
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Input error:", error)
      }
    }
  }, [roomId, connected])

  // Game loop for rendering and polling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let lastPollTime = 0
    const POLL_INTERVAL = 50

    const render = (timestamp: number) => {
      // Poll server at fixed interval
      if (timestamp - lastPollTime > POLL_INTERVAL && connected) {
        sendInputAndFetch()
        lastPollTime = timestamp
      }

      animFrameRef.current++

      const state = gameState || DEFAULT_STATE
      const players = state.players || []
      const ball = state.ball || DEFAULT_STATE.ball

      // Draw field using shared renderer
      drawField(ctx, FIELD_WIDTH, FIELD_HEIGHT)

      // Draw players sorted by Y
      const sortedPlayers = [...players].sort((a, b) => (a?.y || 0) - (b?.y || 0))
      sortedPlayers.forEach((player) => {
        if (!player) return
        const isCurrentPlayer = player.id === playerIdRef.current

        const renderState: PlayerRenderState = {
          x: player.x,
          y: player.y,
          team: player.team,
          isGoalkeeper: player.isGoalkeeper,
          isSliding: player.isSliding,
          hasBall: player.hasBall,
          facingX: player.facingX,
          facingY: player.facingY,
          isHuman: isCurrentPlayer,
          name: player.name || "PLAYER",
          animFrame: player.animFrame ?? animFrameRef.current,
          velocityX: player.velocityX,
          velocityY: player.velocityY,
        }

        drawPlayer(ctx, renderState)
      })

      // Draw ball
      if (!ball.isGrabbed || !ball.ownerId) {
        drawBall(ctx, ball.x, ball.y, BALL_SIZE)
      }

      // Goal celebration
      if (state.goalCelebration > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
        ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT)

        const flash = Math.floor(state.goalCelebration / 10) % 2 === 0
        ctx.fillStyle = flash ? (state.lastGoalTeam === "home" ? "#ff6b6b" : "#6b9fff") : "#ffffff"
        ctx.font = "bold 64px monospace"
        ctx.textAlign = "center"
        ctx.strokeStyle = "#000"
        ctx.lineWidth = 4
        ctx.strokeText("GOAL!", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 20)
        ctx.fillText("GOAL!", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 20)

        ctx.fillStyle = "#fff"
        ctx.font = "bold 24px monospace"
        ctx.fillText(
          state.lastGoalTeam === "home" ? "HOME TEAM SCORES!" : "AWAY TEAM SCORES!",
          FIELD_WIDTH / 2,
          FIELD_HEIGHT / 2 + 30,
        )
      }

      gameLoopRef.current = requestAnimationFrame(render)
    }

    gameLoopRef.current = requestAnimationFrame(render)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState, sendInputAndFetch, connected])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds) % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleExit = () => {
    sounds.back()
    onExit()
  }

  const displayScore = gameState?.score || { home: 0, away: 0 }
  const displayTime = gameState?.gameTime ?? 180

  return (
    <div className="flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4 px-4">
        <button onClick={handleExit} className="text-[#00ff88] font-mono hover:text-[#00cc6a] transition-colors">
          &larr; EXIT
        </button>

        <div className="text-center">
          <div className="flex items-center gap-8">
            <div className="text-[#ff4444] font-mono text-4xl font-bold">{displayScore.home}</div>
            <div className="text-[#888] font-mono text-2xl">{formatTime(displayTime)}</div>
            <div className="text-[#4444ff] font-mono text-4xl font-bold">{displayScore.away}</div>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm font-mono">
            <span className="text-[#ff4444]">HOME</span>
            <span className="text-[#4444ff]">AWAY</span>
          </div>
        </div>

        <div
          className={`px-3 py-1 rounded font-mono text-sm ${
            connected ? "bg-[#00ff88] text-[#1a1a2e]" : "bg-[#ff4444] text-white"
          }`}
        >
          {connected ? "ONLINE" : connectionError || "CONNECTING..."}
        </div>
      </div>

      {/* Game Canvas */}
      <div className="border-8 border-[#252542] shadow-[0_0_40px_rgba(0,255,136,0.2)] rounded">
        <canvas ref={canvasRef} width={FIELD_WIDTH} height={FIELD_HEIGHT} className="block" />
      </div>

      {/* Controls reminder */}
      <div className="mt-4 bg-[#252542] p-3 rounded border border-[#3a3a5c]">
        <div className="text-[#666] font-mono text-xs text-center space-x-4">
          <span>WASD/ARROWS: Move</span>
          <span>SPACE: Shoot</span>
          <span>Q: Pass</span>
          <span>SHIFT: Slide</span>
          <span>E: Grab (GK)</span>
        </div>
      </div>

      {/* Team indicator */}
      <div className="mt-2 font-mono text-sm">
        <span className="text-[#888]">You are playing for: </span>
        <span className={playerTeam === "home" ? "text-[#ff4444]" : "text-[#4444ff]"}>
          {playerTeam === "home" ? "HOME (RED)" : "AWAY (BLUE)"}
        </span>
      </div>

      {/* Player count */}
      <div className="mt-1 text-[#666] font-mono text-xs">Players in game: {gameState?.players?.length || 0}/10</div>
    </div>
  )
}
