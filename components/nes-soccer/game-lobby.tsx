"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { sounds } from "@/lib/sounds"

interface Room {
  id: string
  name: string
  players: number
  maxPlayers: number
  status: "waiting" | "playing"
}

interface GameLobbyProps {
  onJoinGame: (roomId: string, team: "home" | "away", playerName: string) => void
  onBack: () => void
}

export function GameLobby({ onJoinGame, onBack }: GameLobbyProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [newRoomName, setNewRoomName] = useState("")
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away">("home")
  const [isLoading, setIsLoading] = useState(true)
  const [playerName, setPlayerName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const fetchRooms = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch("/api/rooms")
      if (!res.ok) throw new Error("Failed to fetch rooms")
      const data = await res.json()
      setRooms(data.rooms || [])
    } catch (error) {
      console.error("Failed to fetch rooms:", error)
      setError("Failed to load rooms. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 3000)
    return () => clearInterval(interval)
  }, [fetchRooms])

  const createRoom = async () => {
    if (!newRoomName.trim() || !playerName.trim()) {
      setError("Please enter both your name and room name")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoomName.trim() }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Failed to create room")
      }

      const data = await res.json()
      if (data.roomId) {
        sounds.select()
        onJoinGame(data.roomId, selectedTeam, playerName.trim())
      } else {
        throw new Error("No room ID returned")
      }
    } catch (error) {
      console.error("Failed to create room:", error)
      setError(error instanceof Error ? error.message : "Failed to create room")
    } finally {
      setIsCreating(false)
    }
  }

  const joinRoom = async (roomId: string) => {
    if (!playerName.trim()) {
      setError("Please enter your name first!")
      return
    }
    sounds.select()
    onJoinGame(roomId, selectedTeam, playerName.trim())
  }

  const handleBack = () => {
    sounds.back()
    onBack()
  }

  const handleTeamSelect = (team: "home" | "away") => {
    sounds.select()
    setSelectedTeam(team)
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <button onClick={handleBack} className="text-[#00ff88] font-mono hover:text-[#00cc6a] transition-colors">
          &larr; BACK
        </button>
        <h2 className="text-3xl font-bold text-[#00ff88] font-mono">GAME LOBBY</h2>
        <div className="w-16" />
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-[#ff4444] bg-opacity-20 border-2 border-[#ff4444] text-[#ff6b6b] font-mono text-sm p-3 mb-4 rounded">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-white hover:text-[#ff4444]">
            [DISMISS]
          </button>
        </div>
      )}

      {/* Player Name Input */}
      <div className="bg-[#252542] border-4 border-[#3a3a5c] p-4 mb-4">
        <label className="text-[#888] font-mono text-sm block mb-2">YOUR NAME</label>
        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name..."
          className="bg-[#1a1a2e] border-[#3a3a5c] text-[#00ff88] font-mono"
          maxLength={16}
        />
      </div>

      {/* Team Selection */}
      <div className="bg-[#252542] border-4 border-[#3a3a5c] p-4 mb-4">
        <label className="text-[#888] font-mono text-sm block mb-2">SELECT TEAM</label>
        <div className="flex gap-4">
          <button
            onClick={() => handleTeamSelect("home")}
            className={`flex-1 py-3 font-mono font-bold border-4 transition-all
                       ${
                         selectedTeam === "home"
                           ? "bg-[#ff4444] border-[#cc3333] text-white scale-105"
                           : "bg-[#3a3a5c] border-[#4a4a6c] text-[#888] hover:text-white hover:border-[#ff4444]"
                       }`}
          >
            HOME (RED)
          </button>
          <button
            onClick={() => handleTeamSelect("away")}
            className={`flex-1 py-3 font-mono font-bold border-4 transition-all
                       ${
                         selectedTeam === "away"
                           ? "bg-[#4444ff] border-[#3333cc] text-white scale-105"
                           : "bg-[#3a3a5c] border-[#4a4a6c] text-[#888] hover:text-white hover:border-[#4444ff]"
                       }`}
          >
            AWAY (BLUE)
          </button>
        </div>
      </div>

      {/* Create Room */}
      <div className="bg-[#252542] border-4 border-[#3a3a5c] p-4 mb-4">
        <label className="text-[#888] font-mono text-sm block mb-2">CREATE NEW ROOM</label>
        <div className="flex gap-2">
          <Input
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Room name..."
            className="bg-[#1a1a2e] border-[#3a3a5c] text-[#00ff88] font-mono"
            onKeyDown={(e) => e.key === "Enter" && createRoom()}
          />
          <Button
            onClick={createRoom}
            disabled={!newRoomName.trim() || !playerName.trim() || isCreating}
            className="bg-[#00ff88] text-[#1a1a2e] font-mono font-bold hover:bg-[#00cc6a] 
                       border-4 border-[#00cc6a] disabled:opacity-50 min-w-[100px]"
          >
            {isCreating ? "..." : "CREATE"}
          </Button>
        </div>
      </div>

      {/* Room List */}
      <div className="bg-[#252542] border-4 border-[#3a3a5c] p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[#888] font-mono text-sm">AVAILABLE ROOMS ({rooms.length})</span>
          <button
            onClick={fetchRooms}
            className="text-[#00ff88] font-mono text-sm hover:text-[#00cc6a] transition-colors"
          >
            REFRESH
          </button>
        </div>

        {isLoading ? (
          <div className="text-center text-[#666] font-mono py-8">
            <div className="animate-pulse">LOADING...</div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center text-[#666] font-mono py-8">
            NO ROOMS AVAILABLE
            <br />
            <span className="text-sm">Create one to start playing!</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-3 bg-[#1a1a2e] border-2 border-[#3a3a5c]
                           hover:border-[#00ff88] transition-colors group"
              >
                <div>
                  <div className="text-[#00ff88] font-mono font-bold">{room.name}</div>
                  <div className="text-[#666] font-mono text-xs">
                    {room.players}/{room.maxPlayers} PLAYERS
                    <span className={`ml-2 ${room.status === "playing" ? "text-[#f4a261]" : "text-[#00ff88]"}`}>
                      {room.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => joinRoom(room.id)}
                  disabled={room.players >= room.maxPlayers || !playerName.trim()}
                  className="bg-[#00ff88] text-[#1a1a2e] font-mono font-bold hover:bg-[#00cc6a]
                             disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-105 transition-transform"
                >
                  JOIN
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mt-4 text-[#666] font-mono text-xs text-center">
        TIP: Share the room name with friends so they can join the same game!
      </div>
    </div>
  )
}
