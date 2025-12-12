"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { sounds } from "@/lib/sounds"
import { drawPlayer, drawBall, drawField, type PlayerRenderState } from "@/lib/player-renderer"

interface LocalGameCanvasProps {
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
  isHuman: boolean
  animFrame: number
}

interface Ball {
  x: number
  y: number
  velocityX: number
  velocityY: number
  ownerId: string | null
  isGrabbed: boolean
}

interface GameState {
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
const GOAL_HEIGHT = 150
const PLAYER_SIZE = 24
const BALL_SIZE = 12
const PLAYER_SPEED = 3.5
const BALL_FRICTION = 0.98
const SHOOT_POWER = 14
const PASS_POWER = 9
const SLIDE_SPEED = 7
const SLIDE_DURATION = 25
const AI_SPEED = 2.8

function createInitialState(): GameState {
  const players: Player[] = []

  const homePositions = [
    { x: 50, y: FIELD_HEIGHT / 2, isGoalkeeper: true },
    { x: 150, y: 150, isGoalkeeper: false },
    { x: 150, y: 350, isGoalkeeper: false },
    { x: 300, y: 200, isGoalkeeper: false },
    { x: 300, y: 300, isGoalkeeper: false },
  ]

  homePositions.forEach((pos, i) => {
    players.push({
      id: `home_${i}`,
      name: i === 0 ? "GK1" : `P${i}`,
      x: pos.x,
      y: pos.y,
      team: "home",
      isGoalkeeper: pos.isGoalkeeper,
      hasBall: false,
      isSliding: false,
      slideTimer: 0,
      velocityX: 0,
      velocityY: 0,
      facingX: 1,
      facingY: 0,
      isHuman: false,
      animFrame: Math.random() * 100,
    })
  })

  const awayPositions = [
    { x: FIELD_WIDTH - 50, y: FIELD_HEIGHT / 2, isGoalkeeper: true },
    { x: FIELD_WIDTH - 150, y: 150, isGoalkeeper: false },
    { x: FIELD_WIDTH - 150, y: 350, isGoalkeeper: false },
    { x: FIELD_WIDTH - 300, y: 200, isGoalkeeper: false },
    { x: FIELD_WIDTH - 300, y: 300, isGoalkeeper: false },
  ]

  awayPositions.forEach((pos, i) => {
    players.push({
      id: `away_${i}`,
      name: i === 0 ? "GK2" : `A${i}`,
      x: pos.x,
      y: pos.y,
      team: "away",
      isGoalkeeper: pos.isGoalkeeper,
      hasBall: false,
      isSliding: false,
      slideTimer: 0,
      velocityX: 0,
      velocityY: 0,
      facingX: -1,
      facingY: 0,
      isHuman: false,
      animFrame: Math.random() * 100,
    })
  })

  return {
    players,
    ball: {
      x: FIELD_WIDTH / 2,
      y: FIELD_HEIGHT / 2,
      velocityX: 0,
      velocityY: 0,
      ownerId: null,
      isGrabbed: false,
    },
    score: { home: 0, away: 0 },
    gameTime: 180,
    isPlaying: true,
    lastGoalTeam: null,
    goalCelebration: 0,
  }
}

export function LocalGameCanvas({ onExit }: LocalGameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number | null>(null)
  const keysRef = useRef<Set<string>>(new Set())
  const gameStateRef = useRef<GameState>(createInitialState())
  const lastTimeRef = useRef<number>(0)
  const timeAccumulatorRef = useRef<number>(0)

  const [displayState, setDisplayState] = useState<GameState>(gameStateRef.current)

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysRef.current.add(key)

      const preventKeys = [
        "w",
        "a",
        "s",
        "d",
        " ",
        "shift",
        "e",
        "q",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        "enter",
        "/",
        "0",
        ".",
      ]
      if (preventKeys.includes(key)) {
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

  const resetPositions = useCallback((scoringTeam: "home" | "away" | null) => {
    const state = gameStateRef.current
    state.ball = {
      x: FIELD_WIDTH / 2,
      y: FIELD_HEIGHT / 2,
      velocityX: 0,
      velocityY: 0,
      ownerId: null,
      isGrabbed: false,
    }

    const homePositions = [
      { x: 50, y: FIELD_HEIGHT / 2 },
      { x: 150, y: 150 },
      { x: 150, y: 350 },
      { x: 300, y: 200 },
      { x: 300, y: 300 },
    ]

    const awayPositions = [
      { x: FIELD_WIDTH - 50, y: FIELD_HEIGHT / 2 },
      { x: FIELD_WIDTH - 150, y: 150 },
      { x: FIELD_WIDTH - 150, y: 350 },
      { x: FIELD_WIDTH - 300, y: 200 },
      { x: FIELD_WIDTH - 300, y: 300 },
    ]

    state.players.forEach((player) => {
      const positions = player.team === "home" ? homePositions : awayPositions
      const index = Number.parseInt(player.id.split("_")[1])
      player.x = positions[index].x
      player.y = positions[index].y
      player.hasBall = false
      player.isSliding = false
      player.velocityX = 0
      player.velocityY = 0
      player.facingX = player.team === "home" ? 1 : -1
      player.facingY = 0
    })

    sounds.whistle()
  }, [])

  const findClosestPlayerToBall = useCallback((team: "home" | "away") => {
    const state = gameStateRef.current
    const teamPlayers = state.players.filter((p) => p.team === team)
    let closest: Player | null = null
    let minDist = Number.POSITIVE_INFINITY

    teamPlayers.forEach((player) => {
      const dx = player.x - state.ball.x
      const dy = player.y - state.ball.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist) {
        minDist = dist
        closest = player
      }
    })

    return closest
  }, [])

  const findNearestTeammate = useCallback((fromPlayer: Player): Player | null => {
    const state = gameStateRef.current
    const teammates = state.players.filter((p) => p.team === fromPlayer.team && p.id !== fromPlayer.id)

    if (teammates.length === 0) return null

    let nearest: Player | null = null
    let minDist = Number.POSITIVE_INFINITY

    teammates.forEach((tm) => {
      const dx = tm.x - fromPlayer.x
      const dy = tm.y - fromPlayer.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const dotProduct = dx * fromPlayer.facingX + dy * fromPlayer.facingY
      const adjustedDist = dotProduct > 0 ? dist * 0.6 : dist * 1.4

      if (adjustedDist < minDist) {
        minDist = adjustedDist
        nearest = tm
      }
    })

    return nearest
  }, [])

  const updateControlledPlayers = useCallback(() => {
    const state = gameStateRef.current
    const closestHome = findClosestPlayerToBall("home")
    const closestAway = findClosestPlayerToBall("away")

    state.players.forEach((player) => {
      if (player.team === "home") {
        player.isHuman = player === closestHome
      } else {
        player.isHuman = player === closestAway
      }
    })
  }, [findClosestPlayerToBall])

  const updateAI = useCallback((player: Player) => {
    const state = gameStateRef.current
    const ball = state.ball

    if (player.isSliding) return

    let targetX = player.x
    let targetY = player.y

    if (player.hasBall) {
      targetX = player.team === "home" ? FIELD_WIDTH - 100 : 100
      targetY = FIELD_HEIGHT / 2

      const goalX = player.team === "home" ? FIELD_WIDTH - 50 : 50
      const distToGoal = Math.abs(player.x - goalX)
      if (distToGoal < 200) {
        player.hasBall = false
        state.ball.ownerId = null
        state.ball.isGrabbed = false
        state.ball.velocityX = player.facingX * SHOOT_POWER
        state.ball.velocityY = (Math.random() - 0.5) * 6
        sounds.kick()
      }
    } else if (player.isGoalkeeper) {
      targetX = player.team === "home" ? 50 : FIELD_WIDTH - 50
      targetY = Math.max(FIELD_HEIGHT / 2 - 70, Math.min(FIELD_HEIGHT / 2 + 70, ball.y))
    } else {
      if (!ball.ownerId) {
        targetX = ball.x
        targetY = ball.y
      } else {
        const ballOwner = state.players.find((p) => p.id === ball.ownerId)
        if (ballOwner && ballOwner.team !== player.team) {
          targetX = ballOwner.x + (player.team === "home" ? -40 : 40)
          targetY = ballOwner.y
        } else {
          const baseX = player.team === "home" ? FIELD_WIDTH * 0.6 : FIELD_WIDTH * 0.4
          targetX = baseX + (Math.random() - 0.5) * 80
          targetY = player.y + (Math.random() - 0.5) * 40
        }
      }
    }

    const dx = targetX - player.x
    const dy = targetY - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 5) {
      player.velocityX = (dx / dist) * AI_SPEED
      player.velocityY = (dy / dist) * AI_SPEED
      player.facingX = dx / dist
      player.facingY = dy / dist
    } else {
      player.velocityX *= 0.8
      player.velocityY *= 0.8
    }
  }, [])

  const updateGame = useCallback(() => {
    const state = gameStateRef.current
    const keys = keysRef.current

    if (state.goalCelebration > 0) {
      state.goalCelebration--
      if (state.goalCelebration === 0) {
        resetPositions(state.lastGoalTeam)
      }
      return
    }

    updateControlledPlayers()

    // Player 1 input (WASD + Space/Shift/E/Q)
    const p1 = state.players.find((p) => p.team === "home" && p.isHuman)
    if (p1 && !p1.isSliding) {
      let dx = 0
      let dy = 0
      if (keys.has("w")) dy -= 1
      if (keys.has("s")) dy += 1
      if (keys.has("a")) dx -= 1
      if (keys.has("d")) dx += 1

      if (dx !== 0 || dy !== 0) {
        const mag = Math.sqrt(dx * dx + dy * dy)
        p1.facingX = dx / mag
        p1.facingY = dy / mag
        p1.velocityX = (dx / mag) * PLAYER_SPEED
        p1.velocityY = (dy / mag) * PLAYER_SPEED
      }

      if (keys.has(" ") && p1.hasBall) {
        p1.hasBall = false
        state.ball.ownerId = null
        state.ball.isGrabbed = false
        state.ball.velocityX = p1.facingX * SHOOT_POWER
        state.ball.velocityY = p1.facingY * SHOOT_POWER
        sounds.kick()
        keys.delete(" ")
      }

      if (keys.has("q") && p1.hasBall) {
        const teammate = findNearestTeammate(p1)
        if (teammate) {
          p1.hasBall = false
          state.ball.ownerId = null
          state.ball.isGrabbed = false
          const passDir = { x: teammate.x - p1.x, y: teammate.y - p1.y }
          const passDist = Math.sqrt(passDir.x ** 2 + passDir.y ** 2)
          state.ball.velocityX = (passDir.x / passDist) * PASS_POWER
          state.ball.velocityY = (passDir.y / passDist) * PASS_POWER
          sounds.pass()
        }
        keys.delete("q")
      }

      if (keys.has("shift") && !p1.isSliding && !p1.hasBall) {
        p1.isSliding = true
        p1.slideTimer = SLIDE_DURATION
        sounds.slide()
        keys.delete("shift")
      }

      if (keys.has("e") && p1.isGoalkeeper && !state.ball.ownerId) {
        const bdx = p1.x - state.ball.x
        const bdy = p1.y - state.ball.y
        const dist = Math.sqrt(bdx * bdx + bdy * bdy)
        if (dist < PLAYER_SIZE * 2.5) {
          p1.hasBall = true
          state.ball.ownerId = p1.id
          state.ball.isGrabbed = true
          sounds.grab()
        }
        keys.delete("e")
      }
    }

    // Player 2 input (Arrows + Enter/Slash/0/Period)
    const p2 = state.players.find((p) => p.team === "away" && p.isHuman)
    if (p2 && !p2.isSliding) {
      let dx = 0
      let dy = 0
      if (keys.has("arrowup")) dy -= 1
      if (keys.has("arrowdown")) dy += 1
      if (keys.has("arrowleft")) dx -= 1
      if (keys.has("arrowright")) dx += 1

      if (dx !== 0 || dy !== 0) {
        const mag = Math.sqrt(dx * dx + dy * dy)
        p2.facingX = dx / mag
        p2.facingY = dy / mag
        p2.velocityX = (dx / mag) * PLAYER_SPEED
        p2.velocityY = (dy / mag) * PLAYER_SPEED
      }

      if (keys.has("enter") && p2.hasBall) {
        p2.hasBall = false
        state.ball.ownerId = null
        state.ball.isGrabbed = false
        state.ball.velocityX = p2.facingX * SHOOT_POWER
        state.ball.velocityY = p2.facingY * SHOOT_POWER
        sounds.kick()
        keys.delete("enter")
      }

      if (keys.has(".") && p2.hasBall) {
        const teammate = findNearestTeammate(p2)
        if (teammate) {
          p2.hasBall = false
          state.ball.ownerId = null
          state.ball.isGrabbed = false
          const passDir = { x: teammate.x - p2.x, y: teammate.y - p2.y }
          const passDist = Math.sqrt(passDir.x ** 2 + passDir.y ** 2)
          state.ball.velocityX = (passDir.x / passDist) * PASS_POWER
          state.ball.velocityY = (passDir.y / passDist) * PASS_POWER
          sounds.pass()
        }
        keys.delete(".")
      }

      if (keys.has("/") && !p2.isSliding && !p2.hasBall) {
        p2.isSliding = true
        p2.slideTimer = SLIDE_DURATION
        sounds.slide()
        keys.delete("/")
      }

      if (keys.has("0") && p2.isGoalkeeper && !state.ball.ownerId) {
        const bdx = p2.x - state.ball.x
        const bdy = p2.y - state.ball.y
        const dist = Math.sqrt(bdx * bdx + bdy * bdy)
        if (dist < PLAYER_SIZE * 2.5) {
          p2.hasBall = true
          state.ball.ownerId = p2.id
          state.ball.isGrabbed = true
          sounds.grab()
        }
        keys.delete("0")
      }
    }

    // Update all players
    state.players.forEach((player) => {
      if (!player.isHuman) {
        updateAI(player)
      }

      // Update animation frame based on movement
      if (Math.abs(player.velocityX) > 0.3 || Math.abs(player.velocityY) > 0.3) {
        player.animFrame += 0.5
      }

      if (player.isSliding) {
        player.slideTimer--
        if (player.slideTimer <= 0) {
          player.isSliding = false
        } else {
          player.x += player.facingX * SLIDE_SPEED
          player.y += player.facingY * SLIDE_SPEED
        }
      }

      player.x += player.velocityX
      player.y += player.velocityY
      player.velocityX *= 0.88
      player.velocityY *= 0.88

      player.x = Math.max(PLAYER_SIZE, Math.min(FIELD_WIDTH - PLAYER_SIZE, player.x))
      player.y = Math.max(PLAYER_SIZE, Math.min(FIELD_HEIGHT - PLAYER_SIZE, player.y))

      if (player.hasBall && !state.ball.isGrabbed) {
        state.ball.x = player.x + player.facingX * (PLAYER_SIZE / 2 + BALL_SIZE / 2 + 2)
        state.ball.y = player.y + player.facingY * (PLAYER_SIZE / 2 + BALL_SIZE / 2 + 2)
        state.ball.velocityX = 0
        state.ball.velocityY = 0
        state.ball.ownerId = player.id
      }

      if (player.isGoalkeeper && player.hasBall && state.ball.isGrabbed) {
        state.ball.x = player.x
        state.ball.y = player.y - PLAYER_SIZE / 2 - BALL_SIZE
      }
    })

    // Ball physics
    if (!state.ball.ownerId) {
      state.ball.x += state.ball.velocityX
      state.ball.y += state.ball.velocityY
      state.ball.velocityX *= BALL_FRICTION
      state.ball.velocityY *= BALL_FRICTION

      // Wall collisions
      if (state.ball.y < BALL_SIZE || state.ball.y > FIELD_HEIGHT - BALL_SIZE) {
        state.ball.velocityY *= -0.8
        state.ball.y = Math.max(BALL_SIZE, Math.min(FIELD_HEIGHT - BALL_SIZE, state.ball.y))
        sounds.bounce()
      }

      const goalTop = FIELD_HEIGHT / 2 - GOAL_HEIGHT / 2
      const goalBottom = FIELD_HEIGHT / 2 + GOAL_HEIGHT / 2

      // Goal check - left
      if (state.ball.x < 25 && state.ball.y > goalTop && state.ball.y < goalBottom) {
        state.score.away++
        state.lastGoalTeam = "away"
        state.goalCelebration = 150
        sounds.goal()
        return
      }

      // Goal check - right
      if (state.ball.x > FIELD_WIDTH - 25 && state.ball.y > goalTop && state.ball.y < goalBottom) {
        state.score.home++
        state.lastGoalTeam = "home"
        state.goalCelebration = 150
        sounds.goal()
        return
      }

      // Side walls
      if (state.ball.x < BALL_SIZE || state.ball.x > FIELD_WIDTH - BALL_SIZE) {
        state.ball.velocityX *= -0.8
        state.ball.x = Math.max(BALL_SIZE, Math.min(FIELD_WIDTH - BALL_SIZE, state.ball.x))
        sounds.bounce()
      }
    }

    // Ball pickup
    state.players.forEach((player) => {
      if (player.hasBall || state.ball.ownerId) return

      const dx = player.x - state.ball.x
      const dy = player.y - state.ball.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < PLAYER_SIZE / 2 + BALL_SIZE / 2 + 4) {
        player.hasBall = true
        state.ball.ownerId = player.id
        state.ball.isGrabbed = false
      }
    })

    // Slide tackles
    state.players.forEach((slidingPlayer) => {
      if (!slidingPlayer.isSliding) return

      state.players.forEach((targetPlayer) => {
        if (targetPlayer.id === slidingPlayer.id) return
        if (targetPlayer.team === slidingPlayer.team) return
        if (!targetPlayer.hasBall) return

        const dx = slidingPlayer.x - targetPlayer.x
        const dy = slidingPlayer.y - targetPlayer.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < PLAYER_SIZE * 1.8) {
          targetPlayer.hasBall = false
          state.ball.ownerId = null
          state.ball.isGrabbed = false
          state.ball.velocityX = (Math.random() - 0.5) * 6
          state.ball.velocityY = (Math.random() - 0.5) * 6
          sounds.tackle()
        }
      })
    })
  }, [updateControlledPlayers, updateAI, resetPositions, findNearestTeammate])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const gameLoop = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp
      }

      const deltaTime = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      timeAccumulatorRef.current += deltaTime

      // Game timer
      if (gameStateRef.current.gameTime > 0 && gameStateRef.current.goalCelebration === 0) {
        if (timeAccumulatorRef.current >= 1000) {
          gameStateRef.current.gameTime--
          timeAccumulatorRef.current -= 1000
        }
      }

      // Fixed timestep updates
      const FIXED_STEP = 1000 / 60
      let steps = 0
      while (timeAccumulatorRef.current >= FIXED_STEP && steps < 4) {
        updateGame()
        timeAccumulatorRef.current -= FIXED_STEP
        steps++
      }

      // Render
      const state = gameStateRef.current

      // Draw field
      drawField(ctx, FIELD_WIDTH, FIELD_HEIGHT)

      // Draw players (sorted by Y for depth)
      const sortedPlayers = [...state.players].sort((a, b) => a.y - b.y)
      sortedPlayers.forEach((player) => {
        const renderState: PlayerRenderState = {
          ...player,
          velocityX: player.velocityX,
          velocityY: player.velocityY,
        }
        drawPlayer(ctx, renderState)
      })

      // Draw ball
      if (!state.ball.isGrabbed) {
        drawBall(ctx, state.ball.x, state.ball.y, BALL_SIZE)
      }

      // Goal celebration overlay
      if (state.goalCelebration > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
        ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT)

        // Flashing text
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

      setDisplayState({ ...state })
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [updateGame])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleExit = () => {
    sounds.back()
    onExit()
  }

  return (
    <div className="flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4 px-4">
        <button onClick={handleExit} className="text-[#00ff88] font-mono hover:text-[#00cc6a] transition-colors">
          &larr; EXIT
        </button>

        <div className="text-center">
          <div className="flex items-center gap-8">
            <div className="text-[#ff4444] font-mono text-4xl font-bold">{displayState.score.home}</div>
            <div className="text-[#888] font-mono text-2xl">{formatTime(displayState.gameTime)}</div>
            <div className="text-[#4444ff] font-mono text-4xl font-bold">{displayState.score.away}</div>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm font-mono">
            <span className="text-[#ff4444]">HOME</span>
            <span className="text-[#4444ff]">AWAY</span>
          </div>
        </div>

        <div className="px-3 py-1 rounded font-mono text-sm bg-[#00ff88] text-[#1a1a2e]">LOCAL 2P</div>
      </div>

      {/* Game Canvas */}
      <div className="border-8 border-[#252542] shadow-[0_0_40px_rgba(0,255,136,0.2)] rounded">
        <canvas ref={canvasRef} width={FIELD_WIDTH} height={FIELD_HEIGHT} className="block" />
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-2 gap-8 text-xs font-mono max-w-[800px]">
        <div className="bg-[#252542] p-3 rounded border-2 border-[#ff4444]">
          <div className="text-[#ff4444] font-bold mb-2">PLAYER 1 (HOME)</div>
          <div className="text-[#aaa] space-y-1">
            <div>WASD: Move</div>
            <div>SPACE: Shoot</div>
            <div>Q: Pass</div>
            <div>SHIFT: Slide Tackle</div>
            <div>E: Grab (GK only)</div>
          </div>
        </div>
        <div className="bg-[#252542] p-3 rounded border-2 border-[#4444ff]">
          <div className="text-[#4444ff] font-bold mb-2">PLAYER 2 (AWAY)</div>
          <div className="text-[#aaa] space-y-1">
            <div>ARROWS: Move</div>
            <div>ENTER: Shoot</div>
            <div>PERIOD (.): Pass</div>
            <div>SLASH (/): Slide Tackle</div>
            <div>0: Grab (GK only)</div>
          </div>
        </div>
      </div>
    </div>
  )
}
