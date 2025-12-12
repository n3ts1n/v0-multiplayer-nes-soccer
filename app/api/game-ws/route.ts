import type { NextRequest } from "next/server"
import { WebSocket } from "ws"

// Game constants
const FIELD_WIDTH = 800
const FIELD_HEIGHT = 500
const GOAL_HEIGHT = 150
const PLAYER_SIZE = 24
const BALL_SIZE = 12
const PLAYER_SPEED = 3
const BALL_FRICTION = 0.98
const SHOOT_POWER = 12
const SLIDE_SPEED = 6
const SLIDE_DURATION = 30
const GRAB_DURATION = 60

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
  grabTimer: number
  velocityX: number
  velocityY: number
  facingX: number
  facingY: number
  socket: WebSocket
}

interface Ball {
  x: number
  y: number
  velocityX: number
  velocityY: number
  ownerId: string | null
  isGrabbed: boolean
}

interface GameRoom {
  id: string
  players: Map<string, Player>
  ball: Ball
  score: { home: number; away: number }
  gameTime: number
  isPlaying: boolean
  lastGoalTeam: "home" | "away" | null
  goalCelebration: number
  gameLoop: ReturnType<typeof setInterval> | null
}

// Store active game rooms
const gameRooms = new Map<string, GameRoom>()

function createInitialBall(): Ball {
  return {
    x: FIELD_WIDTH / 2,
    y: FIELD_HEIGHT / 2,
    velocityX: 0,
    velocityY: 0,
    ownerId: null,
    isGrabbed: false,
  }
}

function getInitialPlayerPosition(
  team: "home" | "away",
  playerIndex: number,
  isGoalkeeper: boolean,
): { x: number; y: number } {
  if (isGoalkeeper) {
    return {
      x: team === "home" ? 50 : FIELD_WIDTH - 50,
      y: FIELD_HEIGHT / 2,
    }
  }

  // Formation positions (4 outfield players per team)
  const formations = {
    home: [
      { x: 150, y: 150 },
      { x: 150, y: 350 },
      { x: 300, y: 200 },
      { x: 300, y: 300 },
    ],
    away: [
      { x: FIELD_WIDTH - 150, y: 150 },
      { x: FIELD_WIDTH - 150, y: 350 },
      { x: FIELD_WIDTH - 300, y: 200 },
      { x: FIELD_WIDTH - 300, y: 300 },
    ],
  }

  const pos = formations[team][playerIndex % 4]
  return pos || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 }
}

function createGameRoom(roomId: string): GameRoom {
  const room: GameRoom = {
    id: roomId,
    players: new Map(),
    ball: createInitialBall(),
    score: { home: 0, away: 0 },
    gameTime: 180,
    isPlaying: true,
    lastGoalTeam: null,
    goalCelebration: 0,
    gameLoop: null,
  }

  // Start game loop
  room.gameLoop = setInterval(() => updateGame(room), 1000 / 60)

  return room
}

function updateGame(room: GameRoom) {
  if (!room.isPlaying) return

  // Handle goal celebration
  if (room.goalCelebration > 0) {
    room.goalCelebration--
    if (room.goalCelebration === 0) {
      resetPositions(room)
    }
    broadcastState(room)
    return
  }

  // Update game time
  if (room.gameTime > 0) {
    // Decrease time every 60 frames (1 second)
    if (Math.random() < 0.0167) {
      room.gameTime--
    }
  }

  // Update players
  room.players.forEach((player) => {
    // Handle sliding
    if (player.isSliding) {
      player.slideTimer--
      if (player.slideTimer <= 0) {
        player.isSliding = false
      } else {
        player.x += player.facingX * SLIDE_SPEED
        player.y += player.facingY * SLIDE_SPEED
      }
    }

    // Handle ball grabbing
    if (player.grabTimer > 0) {
      player.grabTimer--
    }

    // Apply velocity and friction
    player.x += player.velocityX
    player.y += player.velocityY
    player.velocityX *= 0.9
    player.velocityY *= 0.9

    // Keep player in bounds
    player.x = Math.max(PLAYER_SIZE, Math.min(FIELD_WIDTH - PLAYER_SIZE, player.x))
    player.y = Math.max(PLAYER_SIZE, Math.min(FIELD_HEIGHT - PLAYER_SIZE, player.y))

    // If player has ball, ball follows them
    if (player.hasBall && !room.ball.isGrabbed) {
      room.ball.x = player.x + player.facingX * (PLAYER_SIZE / 2 + BALL_SIZE / 2)
      room.ball.y = player.y + player.facingY * (PLAYER_SIZE / 2 + BALL_SIZE / 2)
      room.ball.velocityX = 0
      room.ball.velocityY = 0
      room.ball.ownerId = player.id
    }

    // If goalkeeper has grabbed ball
    if (player.isGoalkeeper && player.hasBall && room.ball.isGrabbed) {
      room.ball.x = player.x
      room.ball.y = player.y - PLAYER_SIZE / 2 - BALL_SIZE
    }
  })

  // Update ball physics
  if (!room.ball.ownerId) {
    room.ball.x += room.ball.velocityX
    room.ball.y += room.ball.velocityY
    room.ball.velocityX *= BALL_FRICTION
    room.ball.velocityY *= BALL_FRICTION

    // Ball collision with walls
    if (room.ball.y < BALL_SIZE || room.ball.y > FIELD_HEIGHT - BALL_SIZE) {
      room.ball.velocityY *= -0.8
      room.ball.y = Math.max(BALL_SIZE, Math.min(FIELD_HEIGHT - BALL_SIZE, room.ball.y))
    }

    // Check for goals
    const goalTop = FIELD_HEIGHT / 2 - GOAL_HEIGHT / 2
    const goalBottom = FIELD_HEIGHT / 2 + GOAL_HEIGHT / 2

    // Home goal (left side)
    if (room.ball.x < 20 && room.ball.y > goalTop && room.ball.y < goalBottom) {
      room.score.away++
      room.lastGoalTeam = "away"
      room.goalCelebration = 120
      return
    }

    // Away goal (right side)
    if (room.ball.x > FIELD_WIDTH - 20 && room.ball.y > goalTop && room.ball.y < goalBottom) {
      room.score.home++
      room.lastGoalTeam = "home"
      room.goalCelebration = 120
      return
    }

    // Ball collision with side walls (not goal areas)
    if (room.ball.x < BALL_SIZE || room.ball.x > FIELD_WIDTH - BALL_SIZE) {
      room.ball.velocityX *= -0.8
      room.ball.x = Math.max(BALL_SIZE, Math.min(FIELD_WIDTH - BALL_SIZE, room.ball.x))
    }
  }

  // Check ball pickup
  room.players.forEach((player) => {
    if (player.hasBall || room.ball.ownerId) return

    const dx = player.x - room.ball.x
    const dy = player.y - room.ball.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < PLAYER_SIZE / 2 + BALL_SIZE / 2) {
      player.hasBall = true
      room.ball.ownerId = player.id
      room.ball.isGrabbed = false
    }
  })

  // Check slide tackles
  room.players.forEach((slidingPlayer) => {
    if (!slidingPlayer.isSliding) return

    room.players.forEach((targetPlayer) => {
      if (targetPlayer.id === slidingPlayer.id) return
      if (targetPlayer.team === slidingPlayer.team) return
      if (!targetPlayer.hasBall) return

      const dx = slidingPlayer.x - targetPlayer.x
      const dy = slidingPlayer.y - targetPlayer.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < PLAYER_SIZE * 1.5) {
        // Successful tackle!
        targetPlayer.hasBall = false
        room.ball.ownerId = null
        room.ball.isGrabbed = false
        room.ball.velocityX = (Math.random() - 0.5) * 5
        room.ball.velocityY = (Math.random() - 0.5) * 5
      }
    })
  })

  broadcastState(room)
}

function resetPositions(room: GameRoom) {
  room.ball = createInitialBall()

  let homeIndex = 0
  let awayIndex = 0

  room.players.forEach((player) => {
    const isGoalkeeper = player.team === "home" ? homeIndex === 0 : awayIndex === 0
    player.isGoalkeeper = isGoalkeeper

    const pos = getInitialPlayerPosition(player.team, player.team === "home" ? homeIndex : awayIndex, isGoalkeeper)
    player.x = pos.x
    player.y = pos.y
    player.hasBall = false
    player.isSliding = false
    player.velocityX = 0
    player.velocityY = 0

    if (player.team === "home") homeIndex++
    else awayIndex++
  })
}

function broadcastState(room: GameRoom) {
  const state = {
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      team: p.team,
      isGoalkeeper: p.isGoalkeeper,
      hasBall: p.hasBall,
      isSliding: p.isSliding,
      slideTimer: p.slideTimer,
      velocityX: p.velocityX,
      velocityY: p.velocityY,
      facingX: p.facingX,
      facingY: p.facingY,
    })),
    ball: room.ball,
    score: room.score,
    gameTime: room.gameTime,
    isPlaying: room.isPlaying,
    lastGoalTeam: room.lastGoalTeam,
    goalCelebration: room.goalCelebration,
  }

  room.players.forEach((player) => {
    try {
      if (player.socket.readyState === WebSocket.OPEN) {
        player.socket.send(JSON.stringify({ type: "state", state }))
      }
    } catch (e) {
      // Ignore send errors
    }
  })
}

function handlePlayerInput(room: GameRoom, playerId: string, input: any) {
  const player = room.players.get(playerId)
  if (!player) return

  // Handle movement
  if (input.dx !== 0 || input.dy !== 0) {
    const magnitude = Math.sqrt(input.dx * input.dx + input.dy * input.dy)
    if (magnitude > 0) {
      player.facingX = input.dx / magnitude
      player.facingY = input.dy / magnitude
    }

    if (!player.isSliding) {
      player.velocityX = input.dx * PLAYER_SPEED
      player.velocityY = input.dy * PLAYER_SPEED
    }
  }

  // Handle shooting
  if (input.shoot && player.hasBall) {
    player.hasBall = false
    room.ball.ownerId = null
    room.ball.isGrabbed = false
    room.ball.velocityX = player.facingX * SHOOT_POWER
    room.ball.velocityY = player.facingY * SHOOT_POWER
  }

  // Handle sliding
  if (input.slide && !player.isSliding && !player.hasBall) {
    player.isSliding = true
    player.slideTimer = SLIDE_DURATION
  }

  // Handle goalkeeper grab
  if (input.grab && player.isGoalkeeper && !room.ball.ownerId) {
    const dx = player.x - room.ball.x
    const dy = player.y - room.ball.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < PLAYER_SIZE * 2) {
      player.hasBall = true
      room.ball.ownerId = player.id
      room.ball.isGrabbed = true
      player.grabTimer = GRAB_DURATION
    }
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const roomId = searchParams.get("roomId")
  const playerId = searchParams.get("playerId")
  const team = searchParams.get("team") as "home" | "away"

  if (!roomId || !playerId || !team) {
    return new Response("Missing parameters", { status: 400 })
  }

  // Upgrade to WebSocket
  const { socket, response } = new WebSocket.Server({ noServer: true }).handleUpgrade(
    request,
    request.socket,
    request.socket.getPeerCertificate(),
  )

  // Get or create room
  let room = gameRooms.get(roomId)
  if (!room) {
    room = createGameRoom(roomId)
    gameRooms.set(roomId, room)
  }

  socket.onopen = () => {
    // Count existing players on each team
    let homeCount = 0
    let awayCount = 0
    room!.players.forEach((p) => {
      if (p.team === "home") homeCount++
      else awayCount++
    })

    const isGoalkeeper = team === "home" ? homeCount === 0 : awayCount === 0
    const playerIndex = team === "home" ? homeCount : awayCount
    const pos = getInitialPlayerPosition(team, playerIndex, isGoalkeeper)

    const player: Player = {
      id: playerId,
      name: `Player ${room!.players.size + 1}`,
      x: pos.x,
      y: pos.y,
      team,
      isGoalkeeper,
      hasBall: false,
      isSliding: false,
      slideTimer: 0,
      grabTimer: 0,
      velocityX: 0,
      velocityY: 0,
      facingX: team === "home" ? 1 : -1,
      facingY: 0,
      socket,
    }

    room!.players.set(playerId, player)
  }

  socket.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === "input") {
        handlePlayerInput(room!, playerId, data)
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  socket.onclose = () => {
    room!.players.delete(playerId)

    // Clean up empty rooms
    if (room!.players.size === 0) {
      if (room!.gameLoop) {
        clearInterval(room!.gameLoop)
      }
      gameRooms.delete(roomId)
    }
  }

  return response
}
