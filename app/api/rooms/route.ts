import { NextResponse } from "next/server"
import { getRoomList, createRoom } from "@/lib/game-store"

export async function GET() {
  try {
    const rooms = await getRoomList()
    return NextResponse.json({ rooms })
  } catch (error) {
    console.error("Error getting room list:", error)
    return NextResponse.json({ rooms: [] })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 })
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2)}`
    await createRoom(roomId, name.slice(0, 32))

    return NextResponse.json({ roomId, success: true })
  } catch (error) {
    console.error("Error creating room:", error)
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 })
  }
}
