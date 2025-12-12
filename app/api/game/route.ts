import { type NextRequest, NextResponse } from "next/server"
import { getGameState, handleInput, joinRoom, leaveRoom } from "@/lib/game-store"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown error"
  }
}

export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get("roomId")

    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    const state = await getGameState(roomId)

    if (!state) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    return NextResponse.json({ state })
  } catch (error) {
    console.error("Error getting game state:", getErrorMessage(error))
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body safely
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Validate body
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const type = body.type as string | undefined
    const roomId = body.roomId as string | undefined
    const playerId = body.playerId as string | undefined
    const playerName = body.playerName as string | undefined
    const team = body.team as "home" | "away" | undefined
    const input = body.input as {
      dx: number
      dy: number
      shoot: boolean
      slide: boolean
      grab: boolean
      pass?: boolean
    } | undefined

    // Validate required fields
    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    if (!playerId || typeof playerId !== "string") {
      return NextResponse.json({ error: "Player ID required" }, { status: 400 })
    }

    if (!type || typeof type !== "string") {
      return NextResponse.json({ error: "Action type required" }, { status: 400 })
    }

    // Handle different action types
    switch (type) {
      case "join": {
        const validTeam = team === "away" ? "away" : "home"
        const validName = typeof playerName === "string" ? playerName.slice(0, 16) : "Player"
        
        const player = await joinRoom(roomId, playerId, validName, validTeam)
        
        if (!player) {
          return NextResponse.json(
            { error: "Failed to join room - team may be full" },
            { status: 400 }
          )
        }
        
        return NextResponse.json({ success: true, player })
      }

      case "leave": {
        await leaveRoom(roomId, playerId)
        return NextResponse.json({ success: true })
      }

      case "input": {
        if (!input || typeof input !== "object") {
          return NextResponse.json({ error: "Input data required" }, { status: 400 })
        }

        // Sanitize input
        const sanitizedInput = {
          dx: Math.max(-1, Math.min(1, Number(input.dx) || 0)),
          dy: Math.max(-1, Math.min(1, Number(input.dy) || 0)),
          shoot: Boolean(input.shoot),
          slide: Boolean(input.slide),
          grab: Boolean(input.grab),
          pass: Boolean(input.pass),
        }

        await handleInput(roomId, playerId, sanitizedInput)
        const state = await getGameState(roomId)
        
        if (!state) {
          return NextResponse.json({ error: "Room not found" }, { status: 404 })
        }
        
        return NextResponse.json({ success: true, state })
      }

      default: {
        return NextResponse.json({ error: "Invalid action type" }, { status: 400 })
      }
    }
  } catch (error) {
    console.error("Error processing game request:", getErrorMessage(error))
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
