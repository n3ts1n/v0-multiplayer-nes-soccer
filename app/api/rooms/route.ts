import { NextResponse } from "next/server"
import { getRoomList, createRoom } from "@/lib/game-store"

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

export async function GET() {
  try {
    const rooms = await getRoomList()

    if (!Array.isArray(rooms)) {
      console.warn("getRoomList did not return an array")
      return NextResponse.json({ rooms: [] })
    }

    return NextResponse.json({ rooms })
  } catch (error) {
    console.error("Error getting room list:", getErrorMessage(error))
    return NextResponse.json({ rooms: [] })
  }
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const name = body.name

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Room name required" }, { status: 400 })
    }

    const sanitizedName = name.trim().slice(0, 32)
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

    try {
      await createRoom(roomId, sanitizedName)
    } catch (createError) {
      console.error("Error in createRoom:", getErrorMessage(createError))
      return NextResponse.json({ error: "Failed to create room" }, { status: 500 })
    }

    return NextResponse.json({
      roomId,
      name: sanitizedName,
      success: true,
    })
  } catch (error) {
    console.error("Error creating room:", getErrorMessage(error))
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 })
  }
}
