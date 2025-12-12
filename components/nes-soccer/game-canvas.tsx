"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { sounds } from "@/lib/sounds"
import { drawPlayer, drawBall, drawField, type PlayerRenderState } from "@/lib/player-renderer"
import { getGamepadInput } from "@/lib/gamepad"

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

interface InterpolatedPlayer extends Player {
  targetX: number
  targetY: number
  targetVelocityX: number
  targetVelocityY: number
  lastUpdateTime: number
}

interface InterpolatedBall extends Ball {
  targetX: number
  targetY: number
  lastUpdateTime: number
}

const FIELD_WIDTH = 800
const FIELD_HEIGHT = 500
const BALL_SIZE = 12
const PLAYER_SPEED = 4
const INTERPOLATION_SPEED = 0.15 // How fast to catch up to server position
const PREDICTION_BLEND = 0.3 // How much to blend prediction vs server

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
  const lastGoalCelebrationRef = useRef(0)

  const interpolatedPlayersRef = useRef<Map<string, InterpolatedPlayer>>(new Map())
  const interpolatedBallRef = useRef<InterpolatedBall>({
    ...DEFAULT_STATE.ball,
    targetX: DEFAULT_STATE.ball.x,
    targetY: DEFAULT_STATE.ball.y,
    lastUpdateTime: Date.now(),
  })
  const lastInputRef = useRef({ dx: 0, dy: 0 })
  const serverStateRef = useRef<GameStateNet>(DEFAULT_STATE)

  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState<GameStateNet>(DEFAULT_STATE)
  const [connectionError, setConnectionError] = useState<string | null>(null)

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
          sounds.select()
        }
      } catch (error) {
        console.error("Failed to join game:", error)
        if (mounted && attempt < 5) {
          setConnectionError(`Connecting... (attempt ${attempt + 1}/5)`)
          retryTimeout = setTimeout(() => joinGame(attempt + 1), 1000 * (attempt + 1))
        } else if (mounted) {
          setConnectionError("Failed to connect. Please try again.")
        }
      }
    }

    joinGame()

    return () => {
      mounted = false
      if (retryTimeout) clearTimeout(retryTimeout)
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

  const updateInterpolationTargets = useCallback((newState: GameStateNet) => {
    const now = Date.now()

    // Update players
    const currentPlayers = interpolatedPlayersRef.current
    const newPlayerIds = new Set(newState.players.map((p) => p.id))

    // Remove players that left
    for (const id of currentPlayers.keys()) {
      if (!newPlayerIds.has(id)) {
        currentPlayers.delete(id)
      }
    }

    // Update/add players
    for (const player of newState.players) {
      const existing = currentPlayers.get(player.id)
      if (existing) {
        // Update targets for interpolation
        existing.targetX = player.x
        existing.targetY = player.y
        existing.targetVelocityX = player.velocityX
        existing.targetVelocityY = player.velocityY
        existing.hasBall = player.hasBall
        existing.isSliding = player.isSliding
        existing.slideTimer = player.slideTimer
        existing.facingX = player.facingX
        existing.facingY = player.facingY
        existing.lastUpdateTime = now
      } else {
        // New player - start at their position
        currentPlayers.set(player.id, {
          ...player,
          targetX: player.x,
          targetY: player.y,
          targetVelocityX: player.velocityX,
          targetVelocityY: player.velocityY,
          lastUpdateTime: now,
        })
      }
    }

    // Update ball
    const ball = interpolatedBallRef.current
    ball.targetX = newState.ball.x
    ball.targetY = newState.ball.y
    ball.velocityX = newState.ball.velocityX
    ball.velocityY = newState.ball.velocityY
    ball.ownerId = newState.ball.ownerId
    ball.isGrabbed = newState.ball.isGrabbed
    ball.lastUpdateTime = now

    serverStateRef.current = newState
  }, [])

  const sendInputAndFetch = useCallback(async () => {
    if (!connected) return

    const keys = keysRef.current
    const gamepad = getGamepadInput(0)

    let dx = 0
    let dy = 0

    if (keys.has("w") || keys.has("arrowup") || gamepad.up) dy -= 1
    if (keys.has("s") || keys.has("arrowdown") || gamepad.down) dy += 1
    if (keys.has("a") || keys.has("arrowleft") || gamepad.left) dx -= 1
    if (keys.has("d") || keys.has("arrowright") || gamepad.right) dx += 1

    // Apply analog stick
    if (Math.abs(gamepad.leftStickX) > 0.1) dx = gamepad.leftStickX
    if (Math.abs(gamepad.leftStickY) > 0.1) dy = gamepad.leftStickY

    const input = {
      dx,
      dy,
      shoot: keys.has(" ") || gamepad.shoot,
      slide: keys.has("shift") || gamepad.slide,
      grab: keys.has("e") || gamepad.grab,
      pass: keys.has("q") || gamepad.pass,
    }

    // Store for local prediction
    lastInputRef.current = { dx, dy }

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
        const newState = data.state as GameStateNet

        // Goal celebration sound
        if (newState.goalCelebration > 0 && lastGoalCelebrationRef.current === 0) {
          sounds.goal()
        }
        lastGoalCelebrationRef.current = newState.goalCelebration

        updateInterpolationTargets(newState)
        setGameState(newState)
        setConnectionError(null)
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Input error:", error)
      }
    }
  }, [roomId, connected, updateInterpolationTargets])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let lastPollTime = 0
    const POLL_INTERVAL = 50 // Poll server every 50ms

    const render = (timestamp: number) => {
      // Poll server at fixed interval (separate from render)
      if (timestamp - lastPollTime > POLL_INTERVAL && connected) {
        sendInputAndFetch()
        lastPollTime = timestamp
      }

      animFrameRef.current++

      const players = interpolatedPlayersRef.current
      const ball = interpolatedBallRef.current
      const myId = playerIdRef.current

      // Interpolate each player toward their target
      for (const [id, player] of players) {
        if (id === myId) {
          // Local player: use client-side prediction for immediate response
          const input = lastInputRef.current
          const predictedX = player.x + input.dx * PLAYER_SPEED
          const predictedY = player.y + input.dy * PLAYER_SPEED

          // Blend prediction with server position
          player.x = player.x + (player.targetX - player.x) * INTERPOLATION_SPEED
          player.y = player.y + (player.targetY - player.y) * INTERPOLATION_SPEED

          // Apply prediction on top
          if (input.dx !== 0 || input.dy !== 0) {
            player.x += input.dx * PLAYER_SPEED * PREDICTION_BLEND
            player.y += input.dy * PLAYER_SPEED * PREDICTION_BLEND
          }

          // Update velocity for animation
          player.velocityX = player.velocityX + (player.targetVelocityX - player.velocityX) * 0.3
          player.velocityY = player.velocityY + (player.targetVelocityY - player.velocityY) * 0.3
        } else {
          // Remote players: smooth interpolation
          player.x = player.x + (player.targetX - player.x) * INTERPOLATION_SPEED
          player.y = player.y + (player.targetY - player.y) * INTERPOLATION_SPEED
          player.velocityX = player.velocityX + (player.targetVelocityX - player.velocityX) * 0.2
          player.velocityY = player.velocityY + (player.targetVelocityY - player.velocityY) * 0.2
        }

        // Clamp to field bounds
        player.x = Math.max(20, Math.min(FIELD_WIDTH - 20, player.x))
        player.y = Math.max(20, Math.min(FIELD_HEIGHT - 20, player.y))
      }

      // Interpolate ball
      if (!ball.isGrabbed) {
        ball.x = ball.x + (ball.targetX - ball.x) * INTERPOLATION_SPEED
        ball.y = ball.y + (ball.targetY - ball.y) * INTERPOLATION_SPEED
      } else {
        // Ball is grabbed - snap to owner position
        const owner = players.get(ball.ownerId || "")
        if (owner) {
          ball.x = owner.x + owner.facingX * 15
          ball.y = owner.y + owner.facingY * 15
        }
      }

      // Draw field
      drawField(ctx, FIELD_WIDTH, FIELD_HEIGHT)

      // Draw players sorted by Y
      const sortedPlayers = Array.from(players.values()).sort((a, b) => a.y - b.y)
      sortedPlayers.forEach((player) => {
        const isCurrentPlayer = player.id === myId

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
          animFrame: animFrameRef.current,
          velocityX: player.velocityX,
          velocityY: player.velocityY,
        }

        drawPlayer(ctx, renderState)
      })

      // Draw ball
      if (!ball.isGrabbed || !ball.ownerId) {
        drawBall(ctx, ball.x, ball.y, BALL_SIZE)
      }

      // Goal celebration overlay
      const state = serverStateRef.current
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
  }, [sendInputAndFetch, connected])

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
            <div className="text-[#ff4444] font-mono text-4xl font-bold drop-shadow-[0_0_10px_rgba(255,68,68,0.5)]">
              {displayScore.home}
            </div>
            <div className="text-[#00ff88] font-mono text-2xl">{formatTime(displayTime)}</div>
            <div className="text-[#4444ff] font-mono text-4xl font-bold drop-shadow-[0_0_10px_rgba(68,68,255,0.5)]">
              {displayScore.away}
            </div>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm font-mono">
            <span className="text-[#ff4444]">HOME</span>
            <span className="text-[#4444ff]">AWAY</span>
          </div>
        </div>

        <div
          className={`px-3 py-1 rounded font-mono text-sm ${connected ? "bg-[#00ff88] text-[#0a0a0f]" : "bg-[#ff4444] text-white"}`}
        >
          {connected ? "● ONLINE" : connectionError || "CONNECTING..."}
        </div>
      </div>

      {/* Game Canvas with CRT effect */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f] rounded-lg" />
        <div className="absolute -inset-3 bg-[#252542] rounded-lg" />
        <div className="absolute -inset-2 bg-gradient-to-br from-[#3a3a5c] to-[#1a1a2e] rounded" />
        <div className="relative border-4 border-[#0a0a0f] rounded shadow-[inset_0_0_30px_rgba(0,0,0,0.5),0_0_40px_rgba(0,255,136,0.15)]">
          <canvas ref={canvasRef} width={FIELD_WIDTH} height={FIELD_HEIGHT} className="block rounded-sm" />
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.3)_2px,rgba(0,0,0,0.3)_4px)]" />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 bg-[#0a0a0f] p-3 rounded border border-[#00ff88]/20">
        <div className="text-[#00ff88]/60 font-mono text-xs text-center space-x-4">
          <span>WASD/ARROWS: Move</span>
          <span>SPACE: Shoot</span>
          <span>Q: Pass</span>
          <span>SHIFT: Slide</span>
          <span>E: Grab</span>
        </div>
      </div>

      {/* Team indicator */}
      <div className="mt-2 font-mono text-sm">
        <span className="text-[#888]">Playing for: </span>
        <span
          className={
            playerTeam === "home"
              ? "text-[#ff4444] drop-shadow-[0_0_5px_rgba(255,68,68,0.5)]"
              : "text-[#4444ff] drop-shadow-[0_0_5px_rgba(68,68,255,0.5)]"
          }
        >
          {playerTeam === "home" ? "HOME (RED)" : "AWAY (BLUE)"}
        </span>
      </div>

      <div className="mt-1 text-[#00ff88]/40 font-mono text-xs">
        Players: {gameState?.players?.length || 0}/10 | Room: {roomId}
      </div>
    </div>
  )
}
