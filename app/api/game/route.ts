import { type NextRequest, NextResponse } from "next/server"
import { getGameState, handleInput, joinRoom, leaveRoom } from "@/lib/game-store"

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("roomId")

  if (!roomId) {
    return NextResponse.json({ error: "Room ID required" }, { status: 400 })
  }

  try {
    const state = await getGameState(roomId)

    if (!state) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    return NextResponse.json({ state })
  } catch (error) {
    console.error("Error getting game state:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, roomId, playerId, playerName, team, input } = body

    if (!roomId || !playerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (type === "join") {
      const player = await joinRoom(roomId, playerId, playerName || "Player", team || "home")
      return NextResponse.json({ success: true, player })
    }

    if (type === "leave") {
      await leaveRoom(roomId, playerId)
      return NextResponse.json({ success: true })
    }

    if (type === "input" && input) {
      await handleInput(roomId, playerId, input)
      const state = await getGameState(roomId)
      return NextResponse.json({ success: true, state })
    }

    return NextResponse.json({ error: "Invalid action type" }, { status: 400 })
  } catch (error) {
    console.error("Error processing game request:", error)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
