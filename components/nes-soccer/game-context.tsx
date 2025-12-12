"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

interface Player {
  id: string
  x: number
  y: number
  team: "home" | "away"
  isGoalkeeper: boolean
  hasBall: boolean
  isSliding: boolean
  slideDirection: { x: number; y: number }
  velocityX: number
  velocityY: number
}

interface Ball {
  x: number
  y: number
  velocityX: number
  velocityY: number
  ownerId: string | null
}

interface GameState {
  players: Player[]
  ball: Ball
  score: { home: number; away: number }
  gameTime: number
  isPlaying: boolean
  isPaused: boolean
}

interface GameContextType {
  gameState: GameState
  updateGameState: (state: Partial<GameState>) => void
  resetGame: () => void
}

const initialGameState: GameState = {
  players: [],
  ball: { x: 400, y: 250, velocityX: 0, velocityY: 0, ownerId: null },
  score: { home: 0, away: 0 },
  gameTime: 180,
  isPlaying: false,
  isPaused: false,
}

const GameContext = createContext<GameContextType | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(initialGameState)

  const updateGameState = useCallback((state: Partial<GameState>) => {
    setGameState((prev) => ({ ...prev, ...state }))
  }, [])

  const resetGame = useCallback(() => {
    setGameState(initialGameState)
  }, [])

  return <GameContext.Provider value={{ gameState, updateGameState, resetGame }}>{children}</GameContext.Provider>
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error("useGame must be used within a GameProvider")
  }
  return context
}
