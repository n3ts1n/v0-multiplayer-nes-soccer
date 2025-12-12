import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Key prefixes for Redis
const ROOM_KEY = "soccer:room:"
const ROOM_LIST_KEY = "soccer:rooms"
const ROOM_PLAYERS_KEY = "soccer:room:players:"

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
  lastUpdate: number
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

interface GameRoom {
  id: string
  name: string
  ball: Ball
  score: { home: number; away: number }
  gameTime: number
  isPlaying: boolean
  lastGoalTeam: "home" | "away" | null
  goalCelebration: number
  lastTick: number
  createdAt: number
}

// Game constants
export const FIELD_WIDTH = 800
export const FIELD_HEIGHT = 500
export const GOAL_HEIGHT = 150
export const PLAYER_SIZE = 24
export const BALL_SIZE = 12
export const PLAYER_SPEED = 3.5
export const BALL_FRICTION = 0.98
export const SHOOT_POWER = 14
export const PASS_POWER = 9
export const SLIDE_SPEED = 7
export const SLIDE_DURATION = 25

export function createInitialBall(): Ball {
  return {
    x: FIELD_WIDTH / 2,
    y: FIELD_HEIGHT / 2,
    velocityX: 0,
    velocityY: 0,
    ownerId: null,
    isGrabbed: false,
  }
}

export function getInitialPlayerPosition(
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

export async function getRoom(roomId: string): Promise<GameRoom | null> {
  try {
    const room = await redis.get<GameRoom>(`${ROOM_KEY}${roomId}`)
    return room
  } catch {
    return null
  }
}

export async function getPlayers(roomId: string): Promise<Map<string, Player>> {
  try {
    const playersObj = await redis.hgetall<Record<string, Player>>(`${ROOM_PLAYERS_KEY}${roomId}`)
    const map = new Map<string, Player>()
    if (playersObj) {
      Object.entries(playersObj).forEach(([id, player]) => {
        map.set(id, player as Player)
      })
    }
    return map
  } catch {
    return new Map()
  }
}

export async function saveRoom(room: GameRoom): Promise<void> {
  try {
    await redis.set(`${ROOM_KEY}${room.id}`, room, { ex: 3600 }) // 1 hour expiry
  } catch (e) {
    console.error("Failed to save room:", e)
  }
}

export async function savePlayer(roomId: string, player: Player): Promise<void> {
  try {
    await redis.hset(`${ROOM_PLAYERS_KEY}${roomId}`, { [player.id]: player })
    await redis.expire(`${ROOM_PLAYERS_KEY}${roomId}`, 3600)
  } catch (e) {
    console.error("Failed to save player:", e)
  }
}

export async function removePlayer(roomId: string, playerId: string): Promise<void> {
  try {
    await redis.hdel(`${ROOM_PLAYERS_KEY}${roomId}`, playerId)
  } catch (e) {
    console.error("Failed to remove player:", e)
  }
}

export async function createRoom(roomId: string, name: string): Promise<GameRoom> {
  const room: GameRoom = {
    id: roomId,
    name,
    ball: createInitialBall(),
    score: { home: 0, away: 0 },
    gameTime: 180,
    isPlaying: true,
    lastGoalTeam: null,
    goalCelebration: 0,
    lastTick: Date.now(),
    createdAt: Date.now(),
  }

  await saveRoom(room)
  await redis.sadd(ROOM_LIST_KEY, roomId)
  await redis.expire(ROOM_LIST_KEY, 86400)

  return room
}

export async function getRoomList(): Promise<
  { id: string; name: string; players: number; maxPlayers: number; status: string }[]
> {
  try {
    const roomIds = await redis.smembers(ROOM_LIST_KEY)
    const now = Date.now()
    const result: { id: string; name: string; players: number; maxPlayers: number; status: string }[] = []

    for (const roomId of roomIds) {
      const room = await getRoom(roomId)
      if (!room) {
        await redis.srem(ROOM_LIST_KEY, roomId)
        continue
      }

      // Clean up old rooms (30 minutes with no activity)
      if (now - room.lastTick > 30 * 60 * 1000) {
        await redis.srem(ROOM_LIST_KEY, roomId)
        await redis.del(`${ROOM_KEY}${roomId}`)
        await redis.del(`${ROOM_PLAYERS_KEY}${roomId}`)
        continue
      }

      const players = await getPlayers(roomId)

      // Remove inactive players (15 seconds no update)
      for (const [playerId, player] of players.entries()) {
        if (now - player.lastUpdate > 15000) {
          await removePlayer(roomId, playerId)
          players.delete(playerId)

          // Reset ball if player had it
          if (player.hasBall) {
            room.ball.ownerId = null
            room.ball.isGrabbed = false
            await saveRoom(room)
          }
        }
      }

      result.push({
        id: room.id,
        name: room.name,
        players: players.size,
        maxPlayers: 10,
        status: room.isPlaying ? "playing" : "waiting",
      })
    }

    return result
  } catch (e) {
    console.error("Failed to get room list:", e)
    return []
  }
}

export async function joinRoom(
  roomId: string,
  playerId: string,
  playerName: string,
  team: "home" | "away",
): Promise<Player | null> {
  let room = await getRoom(roomId)
  if (!room) {
    room = await createRoom(roomId, `Room ${roomId.slice(-6)}`)
  }

  const players = await getPlayers(roomId)

  // Check if player already exists
  const existingPlayer = players.get(playerId)
  if (existingPlayer) {
    existingPlayer.lastUpdate = Date.now()
    await savePlayer(roomId, existingPlayer)
    return existingPlayer
  }

  // Count players on each team
  let homeCount = 0
  let awayCount = 0
  players.forEach((p) => {
    if (p.team === "home") homeCount++
    else awayCount++
  })

  // Limit to 5 per team
  if ((team === "home" && homeCount >= 5) || (team === "away" && awayCount >= 5)) {
    return null
  }

  const isGoalkeeper = team === "home" ? homeCount === 0 : awayCount === 0
  const playerIndex = team === "home" ? homeCount : awayCount
  const pos = getInitialPlayerPosition(team, playerIndex, isGoalkeeper)

  const player: Player = {
    id: playerId,
    name: playerName.slice(0, 16) || `Player ${players.size + 1}`,
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
    lastUpdate: Date.now(),
    animFrame: Math.random() * 100,
  }

  await savePlayer(roomId, player)
  return player
}

export async function leaveRoom(roomId: string, playerId: string) {
  const room = await getRoom(roomId)
  const players = await getPlayers(roomId)
  const player = players.get(playerId)

  if (room && player?.hasBall) {
    room.ball.ownerId = null
    room.ball.isGrabbed = false
    await saveRoom(room)
  }

  await removePlayer(roomId, playerId)
}

function findNearestTeammate(players: Map<string, Player>, fromPlayer: Player): Player | null {
  let nearest: Player | null = null
  let minDist = Number.POSITIVE_INFINITY

  players.forEach((p) => {
    if (p.id === fromPlayer.id || p.team !== fromPlayer.team) return

    const dx = p.x - fromPlayer.x
    const dy = p.y - fromPlayer.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    const dotProduct = dx * fromPlayer.facingX + dy * fromPlayer.facingY
    const adjustedDist = dotProduct > 0 ? dist * 0.6 : dist * 1.4

    if (adjustedDist < minDist) {
      minDist = adjustedDist
      nearest = p
    }
  })

  return nearest
}

export async function handleInput(
  roomId: string,
  playerId: string,
  input: { dx: number; dy: number; shoot: boolean; slide: boolean; grab: boolean; pass?: boolean },
) {
  const room = await getRoom(roomId)
  if (!room) return

  const players = await getPlayers(roomId)
  const player = players.get(playerId)
  if (!player) return

  player.lastUpdate = Date.now()

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

  // Handle passing
  if (input.pass && player.hasBall) {
    const teammate = findNearestTeammate(players, player)
    if (teammate) {
      player.hasBall = false
      room.ball.ownerId = null
      room.ball.isGrabbed = false
      const dx = teammate.x - player.x
      const dy = teammate.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      room.ball.velocityX = (dx / dist) * PASS_POWER
      room.ball.velocityY = (dy / dist) * PASS_POWER
    }
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

    if (dist < PLAYER_SIZE * 2.5) {
      player.hasBall = true
      room.ball.ownerId = player.id
      room.ball.isGrabbed = true
    }
  }

  await savePlayer(roomId, player)
  await saveRoom(room)
}

function resetPositions(room: GameRoom, players: Map<string, Player>): Map<string, Player> {
  room.ball = createInitialBall()

  let homeIndex = 0
  let awayIndex = 0

  players.forEach((player) => {
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

  return players
}

export async function updateGame(roomId: string) {
  const room = await getRoom(roomId)
  if (!room || !room.isPlaying) return

  const players = await getPlayers(roomId)
  const now = Date.now()
  const deltaMs = now - room.lastTick

  // Only update if enough time has passed (prevent too frequent updates)
  if (deltaMs < 16) return

  const deltaFrames = Math.min(10, Math.floor(deltaMs / 16.67))
  room.lastTick = now

  let needsReset = false

  for (let frame = 0; frame < deltaFrames; frame++) {
    // Handle goal celebration
    if (room.goalCelebration > 0) {
      room.goalCelebration--
      if (room.goalCelebration === 0) {
        needsReset = true
      }
      continue
    }

    // Update game time
    if (room.gameTime > 0 && Math.random() < 0.0167) {
      room.gameTime--
    }

    // Update players
    players.forEach((player) => {
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

      if (player.hasBall && !room.ball.isGrabbed) {
        room.ball.x = player.x + player.facingX * (PLAYER_SIZE / 2 + BALL_SIZE / 2 + 2)
        room.ball.y = player.y + player.facingY * (PLAYER_SIZE / 2 + BALL_SIZE / 2 + 2)
        room.ball.velocityX = 0
        room.ball.velocityY = 0
        room.ball.ownerId = player.id
      }

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

      if (room.ball.y < BALL_SIZE || room.ball.y > FIELD_HEIGHT - BALL_SIZE) {
        room.ball.velocityY *= -0.8
        room.ball.y = Math.max(BALL_SIZE, Math.min(FIELD_HEIGHT - BALL_SIZE, room.ball.y))
      }

      const goalTop = FIELD_HEIGHT / 2 - GOAL_HEIGHT / 2
      const goalBottom = FIELD_HEIGHT / 2 + GOAL_HEIGHT / 2

      if (room.ball.x < 25 && room.ball.y > goalTop && room.ball.y < goalBottom) {
        room.score.away++
        room.lastGoalTeam = "away"
        room.goalCelebration = 150
        continue
      }

      if (room.ball.x > FIELD_WIDTH - 25 && room.ball.y > goalTop && room.ball.y < goalBottom) {
        room.score.home++
        room.lastGoalTeam = "home"
        room.goalCelebration = 150
        continue
      }

      if (room.ball.x < BALL_SIZE || room.ball.x > FIELD_WIDTH - BALL_SIZE) {
        room.ball.velocityX *= -0.8
        room.ball.x = Math.max(BALL_SIZE, Math.min(FIELD_WIDTH - BALL_SIZE, room.ball.x))
      }
    }

    // Check ball pickup
    players.forEach((player) => {
      if (player.hasBall || room.ball.ownerId) return

      const dx = player.x - room.ball.x
      const dy = player.y - room.ball.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < PLAYER_SIZE / 2 + BALL_SIZE / 2 + 4) {
        player.hasBall = true
        room.ball.ownerId = player.id
        room.ball.isGrabbed = false
      }
    })

    // Check slide tackles
    players.forEach((slidingPlayer) => {
      if (!slidingPlayer.isSliding) return

      players.forEach((targetPlayer) => {
        if (targetPlayer.id === slidingPlayer.id) return
        if (targetPlayer.team === slidingPlayer.team) return
        if (!targetPlayer.hasBall) return

        const dx = slidingPlayer.x - targetPlayer.x
        const dy = slidingPlayer.y - targetPlayer.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < PLAYER_SIZE * 1.8) {
          targetPlayer.hasBall = false
          room.ball.ownerId = null
          room.ball.isGrabbed = false
          room.ball.velocityX = (Math.random() - 0.5) * 6
          room.ball.velocityY = (Math.random() - 0.5) * 6
        }
      })
    })
  }

  if (needsReset) {
    const resetPlayers = resetPositions(room, players)
    for (const [id, player] of resetPlayers.entries()) {
      await savePlayer(roomId, player)
    }
  } else {
    for (const [id, player] of players.entries()) {
      await savePlayer(roomId, player)
    }
  }

  await saveRoom(room)
}

export async function getGameState(roomId: string) {
  const room = await getRoom(roomId)
  if (!room) return null

  await updateGame(roomId)

  // Refetch after update
  const updatedRoom = await getRoom(roomId)
  const players = await getPlayers(roomId)

  if (!updatedRoom) return null

  return {
    players: Array.from(players.values()).map((p) => ({
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
      animFrame: p.animFrame,
    })),
    ball: updatedRoom.ball,
    score: updatedRoom.score,
    gameTime: updatedRoom.gameTime,
    isPlaying: updatedRoom.isPlaying,
    lastGoalTeam: updatedRoom.lastGoalTeam,
    goalCelebration: updatedRoom.goalCelebration,
  }
}
