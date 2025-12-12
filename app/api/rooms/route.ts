import { NextResponse } from "next/server"
import { getRoomList, createRoom } from "@/lib/game-store"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const rooms = await getRoomList()
    
    // Ensure we always return a valid array
    if (!Array.isArray(rooms)) {
      console.warn("getRoomList did not return an array:", typeof rooms)
      return NextResponse.json({ rooms: [] })
    }
    
    return NextResponse.json({ rooms })
  } catch (error) {
    // Properly extract error message
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Error getting room list:", errorMessage)
    
    // Return empty array instead of error to prevent UI breaking
    return NextResponse.json({ rooms: [] })
  }
}

export async function POST(request: Request) {
  try {
    // Validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      )
    }

    // Type check the body
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400 }
      )
    }

    const { name } = body as { name?: unknown }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Room name is required and must be a non-empty string" },
        { status: 400 }
      )
    }

    // Sanitize and validate room name
    const sanitizedName = name.trim().slice(0, 32)
    
    // Generate unique room ID
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    
    try {
      await createRoom(roomId, sanitizedName)
    } catch (createError) {
      const errorMessage = createError instanceof Error ? createError.message : String(createError)
      console.error("Error in createRoom:", errorMessage)
      return NextResponse.json(
        { error: "Failed to create room in database" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      roomId,
      name: sanitizedName,
      success: true,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Error creating room:", errorMessage)
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    )
  }
}
