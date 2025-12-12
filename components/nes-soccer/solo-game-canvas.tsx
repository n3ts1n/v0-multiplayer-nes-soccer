"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { sounds } from "@/lib/sounds"
import { drawPlayer, drawBall, drawField, type PlayerRenderState } from "@/lib/player-renderer"
import { CPUAI, type Difficulty } from "@/lib/cpu-ai"
import { getGamepadState } from "@/lib/gamepad"

interface SoloGameCanvasProps {
  difficulty: Difficulty
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
  ai?: CPUAI
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
  countdown: number
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

function createInitialState(difficulty: Difficulty): GameState {
  const players: Player[] = []

  // Home team (human controlled - closest to ball)
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
      name: i === 0 ? "GK" : `P${i}`,
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
      ai: new CPUAI(difficulty), // AI for non-controlled teammates
    })
  })

  // Away team (CPU controlled)
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
      name: i === 0 ? "CPU" : `C${i}`,
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
      ai: new CPUAI(difficulty),
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
    isPlaying: false,
    lastGoalTeam: null,
    goalCelebration: 0,
    countdown: 3,
  }
}

export function SoloGameCanvas({ difficulty, onExit }: SoloGameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number | null>(null)
  const keysRef = useRef<Set<string>>(new Set())
  const gameStateRef = useRef<GameState>(createInitialState(difficulty))
  const lastTimeRef = useRef<number>(0)
  const timeAccumulatorRef = useRef<number>(0)
  const countdownTimerRef = useRef<number>(0)
  const buttonStatesRef = useRef<{ shoot: boolean; pass: boolean; slide: boolean; grab: boolean }>({
    shoot: false,
    pass: false,
    slide: false,
    grab: false,
  })

  const [displayState, setDisplayState] = useState<GameState>(gameStateRef.current)

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

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysRef.current.add(key)

      const preventKeys = ["w", "a", "s", "d", " ", "shift", "e", "q"]
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

  const updateGame = useCallback(() => {
    const state = gameStateRef.current
    const keys = keysRef.current
    const btnStates = buttonStatesRef.current

    // Countdown before game starts
    if (state.countdown > 0) {
      return
    }

    if (state.goalCelebration > 0) {
      state.goalCelebration--
      if (state.goalCelebration === 0) {
        resetPositions(state.lastGoalTeam)
      }
      return
    }

    // Update which player is human controlled (closest to ball on home team)
    const closestHome = findClosestPlayerToBall("home")
    state.players.forEach((player) => {
      if (player.team === "home") {
        player.isHuman = player === closestHome
      } else {
        player.isHuman = false
      }
    })

    // Get gamepad input
    const gamepad = getGamepadState(0)

    // Human player input
    const humanPlayer = state.players.find((p) => p.team === "home" && p.isHuman)
    if (humanPlayer && !humanPlayer.isSliding) {
      let dx = 0
      let dy = 0

      // Keyboard
      if (keys.has("w")) dy -= 1
      if (keys.has("s")) dy += 1
      if (keys.has("a")) dx -= 1
      if (keys.has("d")) dx += 1

      // Gamepad
      if (gamepad.connected) {
        dx += gamepad.moveX
        dy += gamepad.moveY
      }

      // Normalize diagonal movement
      if (dx !== 0 || dy !== 0) {
        const mag = Math.sqrt(dx * dx + dy * dy)
        humanPlayer.facingX = dx / mag
        humanPlayer.facingY = dy / mag
        humanPlayer.velocityX = (dx / mag) * PLAYER_SPEED
        humanPlayer.velocityY = (dy / mag) * PLAYER_SPEED
      }

      // Shoot (keyboard or gamepad)
      const wantsShoot = keys.has(" ") || gamepad.shoot
      if (wantsShoot && !btnStates.shoot && humanPlayer.hasBall) {
        humanPlayer.hasBall = false
        state.ball.ownerId = null
        state.ball.isGrabbed = false
        state.ball.velocityX = humanPlayer.facingX * SHOOT_POWER
        state.ball.velocityY = humanPlayer.facingY * SHOOT_POWER
        sounds.kick()
      }
      btnStates.shoot = wantsShoot

      // Pass
      const wantsPass = keys.has("q") || gamepad.pass
      if (wantsPass && !btnStates.pass && humanPlayer.hasBall) {
        const teammate = findNearestTeammate(humanPlayer)
        if (teammate) {
          humanPlayer.hasBall = false
          state.ball.ownerId = null
          state.ball.isGrabbed = false
          const passDir = { x: teammate.x - humanPlayer.x, y: teammate.y - humanPlayer.y }
          const passDist = Math.sqrt(passDir.x ** 2 + passDir.y ** 2)
          state.ball.velocityX = (passDir.x / passDist) * PASS_POWER
          state.ball.velocityY = (passDir.y / passDist) * PASS_POWER
          sounds.pass()
        }
      }
      btnStates.pass = wantsPass

      // Slide
      const wantsSlide = keys.has("shift") || gamepad.slide
      if (wantsSlide && !btnStates.slide && !humanPlayer.isSliding && !humanPlayer.hasBall) {
        humanPlayer.isSliding = true
        humanPlayer.slideTimer = SLIDE_DURATION
        sounds.slide()
      }
      btnStates.slide = wantsSlide

      // Grab (goalkeeper)
      const wantsGrab = keys.has("e") || gamepad.grab
      if (wantsGrab && !btnStates.grab && humanPlayer.isGoalkeeper && !state.ball.ownerId) {
        const bdx = humanPlayer.x - state.ball.x
        const bdy = humanPlayer.y - state.ball.y
        const dist = Math.sqrt(bdx * bdx + bdy * bdy)
        if (dist < PLAYER_SIZE * 2.5) {
          humanPlayer.hasBall = true
          state.ball.ownerId = humanPlayer.id
          state.ball.isGrabbed = true
          sounds.grab()
        }
      }
      btnStates.grab = wantsGrab
    }

    // Update all players
    state.players.forEach((player) => {
      // AI for non-human controlled players
      if (!player.isHuman && player.ai) {
        const teammates = state.players.filter((p) => p.team === player.team && p.id !== player.id)
        const opponents = state.players.filter((p) => p.team !== player.team)

        const aiAction = player.ai.update({
          player: {
            x: player.x,
            y: player.y,
            team: player.team,
            isGoalkeeper: player.isGoalkeeper,
            hasBall: player.hasBall,
          },
          ball: state.ball,
          teammates: teammates.map((t) => ({ id: t.id, x: t.x, y: t.y, hasBall: t.hasBall })),
          opponents: opponents.map((o) => ({ id: o.id, x: o.x, y: o.y, hasBall: o.hasBall })),
          fieldWidth: FIELD_WIDTH,
          fieldHeight: FIELD_HEIGHT,
          ownGoalX: player.team === "home" ? 0 : FIELD_WIDTH,
          opponentGoalX: player.team === "home" ? FIELD_WIDTH : 0,
        })

        // Apply AI movement (same speed as human - fair!)
        if (!player.isSliding) {
          if (aiAction.moveX !== 0 || aiAction.moveY !== 0) {
            const mag = Math.sqrt(aiAction.moveX ** 2 + aiAction.moveY ** 2)
            player.velocityX = (aiAction.moveX / mag) * PLAYER_SPEED
            player.velocityY = (aiAction.moveY / mag) * PLAYER_SPEED
            player.facingX = aiAction.moveX / mag
            player.facingY = aiAction.moveY / mag
          }

          // AI shoot
          if (aiAction.shoot && player.hasBall) {
            player.hasBall = false
            state.ball.ownerId = null
            state.ball.isGrabbed = false
            const goalY = FIELD_HEIGHT / 2 + (Math.random() - 0.5) * 80
            const targetX = player.team === "home" ? FIELD_WIDTH - 25 : 25
            const shotDirX = targetX - player.x
            const shotDirY = goalY - player.y
            const shotMag = Math.sqrt(shotDirX ** 2 + shotDirY ** 2)
            state.ball.velocityX = (shotDirX / shotMag) * SHOOT_POWER
            state.ball.velocityY = (shotDirY / shotMag) * SHOOT_POWER
            sounds.kick()
          }

          // AI pass
          if (aiAction.pass && player.hasBall) {
            const teammate = findNearestTeammate(player)
            if (teammate) {
              player.hasBall = false
              state.ball.ownerId = null
              state.ball.isGrabbed = false
              const passDir = { x: teammate.x - player.x, y: teammate.y - player.y }
              const passDist = Math.sqrt(passDir.x ** 2 + passDir.y ** 2)
              state.ball.velocityX = (passDir.x / passDist) * PASS_POWER
              state.ball.velocityY = (passDir.y / passDist) * PASS_POWER
              sounds.pass()
            }
          }

          // AI slide
          if (aiAction.slide && !player.hasBall && !player.isSliding) {
            player.isSliding = true
            player.slideTimer = SLIDE_DURATION
            sounds.slide()
          }
        }
      }

      // Update animation frame
      if (Math.abs(player.velocityX) > 0.3 || Math.abs(player.velocityY) > 0.3) {
        player.animFrame += 0.5
      }

      // Sliding physics
      if (player.isSliding) {
        player.slideTimer--
        if (player.slideTimer <= 0) {
          player.isSliding = false
        } else {
          player.x += player.facingX * SLIDE_SPEED
          player.y += player.facingY * SLIDE_SPEED
        }
      }

      // Apply velocity and friction
      player.x += player.velocityX
      player.y += player.velocityY
      player.velocityX *= 0.88
      player.velocityY *= 0.88

      // Keep in bounds
      player.x = Math.max(PLAYER_SIZE, Math.min(FIELD_WIDTH - PLAYER_SIZE, player.x))
      player.y = Math.max(PLAYER_SIZE, Math.min(FIELD_HEIGHT - PLAYER_SIZE, player.y))

      // Ball following
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
  }, [findClosestPlayerToBall, findNearestTeammate, resetPositions])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Start countdown
    sounds.gameStart()
    countdownTimerRef.current = 0

    const gameLoop = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp
      }

      const deltaTime = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      const state = gameStateRef.current

      // Handle countdown
      if (state.countdown > 0) {
        countdownTimerRef.current += deltaTime
        if (countdownTimerRef.current >= 1000) {
          state.countdown--
          countdownTimerRef.current = 0
          if (state.countdown > 0) {
            sounds.countdown()
          } else {
            sounds.whistle()
            state.isPlaying = true
          }
        }
      } else {
        timeAccumulatorRef.current += deltaTime

        // Game timer
        if (state.gameTime > 0 && state.goalCelebration === 0) {
          if (timeAccumulatorRef.current >= 1000) {
            state.gameTime--
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
      }

      // Render
      drawField(ctx, FIELD_WIDTH, FIELD_HEIGHT)

      // Draw players
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

      // Countdown overlay
      if (state.countdown > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
        ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT)

        ctx.fillStyle = "#00ff88"
        ctx.font = "bold 120px monospace"
        ctx.textAlign = "center"
        ctx.shadowColor = "#00ff88"
        ctx.shadowBlur = 30
        ctx.fillText(state.countdown.toString(), FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 40)
        ctx.shadowBlur = 0

        ctx.fillStyle = "#fff"
        ctx.font = "bold 24px monospace"
        ctx.fillText("GET READY!", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 80)
      }

      // Goal celebration overlay
      if (state.goalCelebration > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
        ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT)

        const flash = Math.floor(state.goalCelebration / 10) % 2 === 0
        ctx.fillStyle = flash ? (state.lastGoalTeam === "home" ? "#00ff88" : "#ff4488") : "#ffffff"
        ctx.font = "bold 64px monospace"
        ctx.textAlign = "center"
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = 20
        ctx.strokeStyle = "#000"
        ctx.lineWidth = 4
        ctx.strokeText("GOAL!", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 20)
        ctx.fillText("GOAL!", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 20)
        ctx.shadowBlur = 0

        ctx.fillStyle = "#fff"
        ctx.font = "bold 24px monospace"
        ctx.fillText(
          state.lastGoalTeam === "home" ? "YOU SCORED!" : "CPU SCORES!",
          FIELD_WIDTH / 2,
          FIELD_HEIGHT / 2 + 30,
        )
      }

      // Game over
      if (state.gameTime === 0 && state.goalCelebration === 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
        ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT)

        const winner =
          state.score.home > state.score.away ? "YOU WIN!" : state.score.away > state.score.home ? "CPU WINS!" : "DRAW!"

        ctx.fillStyle = state.score.home > state.score.away ? "#00ff88" : "#ff4488"
        ctx.font = "bold 48px monospace"
        ctx.textAlign = "center"
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = 20
        ctx.fillText(winner, FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 20)
        ctx.shadowBlur = 0

        ctx.fillStyle = "#fff"
        ctx.font = "bold 20px monospace"
        ctx.fillText(`Final Score: ${state.score.home} - ${state.score.away}`, FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 30)
        ctx.fillText("Press ESC to exit", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 70)
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

  // ESC to exit
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sounds.back()
        onExit()
      }
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [onExit])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleExit = () => {
    sounds.back()
    onExit()
  }

  const difficultyLabel = difficulty === "easy" ? "ROOKIE" : difficulty === "medium" ? "PRO" : "LEGEND"
  const difficultyColor = difficulty === "easy" ? "#4ade80" : difficulty === "medium" ? "#fbbf24" : "#f87171"

  return (
    <div className="flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4 px-4">
        <button onClick={handleExit} className="text-[#00ff88] font-mono hover:text-[#00cc6a] transition-colors">
          &larr; EXIT
        </button>

        <div className="text-center">
          <div className="flex items-center gap-8">
            <div className="text-[#00ff88] font-mono text-4xl font-bold drop-shadow-[0_0_10px_rgba(0,255,136,0.5)]">
              {displayState.score.home}
            </div>
            <div className="text-[#666] font-mono text-2xl tabular-nums">{formatTime(displayState.gameTime)}</div>
            <div className="text-[#ff4488] font-mono text-4xl font-bold drop-shadow-[0_0_10px_rgba(255,68,136,0.5)]">
              {displayState.score.away}
            </div>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm font-mono">
            <span className="text-[#00ff88]">YOU</span>
            <span className="text-[#ff4488]">CPU</span>
          </div>
        </div>

        <div
          className="px-3 py-1 rounded font-mono text-sm text-[#0a0a0f] font-bold"
          style={{ backgroundColor: difficultyColor }}
        >
          {difficultyLabel}
        </div>
      </div>

      {/* Game Canvas with CRT effect */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-b from-[#2a2a3a] via-[#1a1a2a] to-[#0a0a1a] rounded-xl" />
        <div className="absolute -inset-3 bg-gradient-to-b from-[#1d1d2d] to-[#0d0d1d] rounded-lg" />

        <div className="relative border-[6px] border-[#050510] rounded-lg shadow-[inset_0_2px_4px_rgba(0,255,136,0.1),0_0_60px_rgba(0,255,136,0.1)]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#00ff8808] to-transparent pointer-events-none rounded" />

          <canvas
            ref={canvasRef}
            width={FIELD_WIDTH}
            height={FIELD_HEIGHT}
            className="block rounded-sm relative z-10"
          />

          {/* Scanlines */}
          <div
            className="absolute inset-0 pointer-events-none z-20 rounded-sm opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.8) 1px, rgba(0,0,0,0.8) 2px)",
              backgroundSize: "100% 2px",
            }}
          />

          {/* Corner vignette */}
          <div
            className="absolute inset-0 pointer-events-none z-20 rounded-sm"
            style={{
              boxShadow: "inset 0 0 100px rgba(0,0,0,0.5), inset 0 0 30px rgba(0,0,0,0.3)",
            }}
          />
        </div>

        {/* Power LED */}
        <div className="absolute -bottom-1 right-4 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88] animate-pulse" />
        </div>
      </div>

      {/* Controls hint */}
      <div className="mt-4 text-xs font-mono text-[#444] text-center">
        <span className="text-[#666]">WASD</span> Move |<span className="text-[#666]"> SPACE</span> Shoot |
        <span className="text-[#666]"> Q</span> Pass |<span className="text-[#666]"> SHIFT</span> Slide |
        <span className="text-[#666]"> E</span> Grab (GK) |<span className="text-[#666]"> ESC</span> Exit
      </div>
    </div>
  )
}
