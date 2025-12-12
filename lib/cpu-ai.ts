// Hierarchical State Machine AI for CPU players
// Fair AI - no unfair advantages like perfect accuracy or speed boosts

export type Difficulty = "easy" | "medium" | "hard"

// HSM States for AI decision making
type AIState =
  | "idle"
  | "chase_ball"
  | "defend_goal"
  | "attack"
  | "support_attack"
  | "mark_player"
  | "intercept"
  | "shoot"
  | "pass"
  | "dribble"

interface AIContext {
  player: {
    x: number
    y: number
    team: "home" | "away"
    isGoalkeeper: boolean
    hasBall: boolean
  }
  ball: { x: number; y: number; velocityX: number; velocityY: number; ownerId: string | null }
  teammates: Array<{ id: string; x: number; y: number; hasBall: boolean }>
  opponents: Array<{ id: string; x: number; y: number; hasBall: boolean }>
  fieldWidth: number
  fieldHeight: number
  ownGoalX: number
  opponentGoalX: number
}

interface AIAction {
  moveX: number
  moveY: number
  shoot: boolean
  pass: boolean
  slide: boolean
}

// Difficulty parameters - affects decision quality, NOT unfair advantages
const DIFFICULTY_PARAMS = {
  easy: {
    reactionDelay: 15, // Frames before reacting
    positioningError: 50, // Random offset in positioning
    decisionRandomness: 0.4, // Chance to make suboptimal decision
    passAccuracy: 0.6, // How often they pick best pass target
    shootThreshold: 150, // Distance to goal before considering shot
    pressureDistance: 80, // How close before they feel pressure
    supportSpread: 120, // How spread out support players are
  },
  medium: {
    reactionDelay: 8,
    positioningError: 25,
    decisionRandomness: 0.2,
    passAccuracy: 0.8,
    shootThreshold: 200,
    pressureDistance: 100,
    supportSpread: 100,
  },
  hard: {
    reactionDelay: 3,
    positioningError: 10,
    decisionRandomness: 0.08,
    passAccuracy: 0.95,
    shootThreshold: 250,
    pressureDistance: 120,
    supportSpread: 80,
  },
}

export class CPUAI {
  private state: AIState = "idle"
  private stateTimer = 0
  private reactionTimer = 0
  private lastDecision: AIAction = { moveX: 0, moveY: 0, shoot: false, pass: false, slide: false }
  private difficulty: Difficulty
  private params: typeof DIFFICULTY_PARAMS.easy
  private targetX = 0
  private targetY = 0

  constructor(difficulty: Difficulty = "medium") {
    this.difficulty = difficulty
    this.params = DIFFICULTY_PARAMS[difficulty]
  }

  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty
    this.params = DIFFICULTY_PARAMS[difficulty]
  }

  // Main HSM update - determines state transitions and actions
  update(ctx: AIContext): AIAction {
    // Reaction delay - don't instantly react
    if (this.reactionTimer > 0) {
      this.reactionTimer--
      return this.lastDecision
    }

    // State transitions
    this.updateState(ctx)

    // Execute current state behavior
    const action = this.executeState(ctx)

    // Add positioning error based on difficulty
    if (Math.random() < this.params.decisionRandomness) {
      action.moveX += (Math.random() - 0.5) * 0.5
      action.moveY += (Math.random() - 0.5) * 0.5
    }

    this.lastDecision = action
    this.stateTimer++

    return action
  }

  private updateState(ctx: AIContext) {
    const { player, ball, opponents, ownGoalX, opponentGoalX, fieldWidth } = ctx
    const distToBall = this.distance(player.x, player.y, ball.x, ball.y)
    const ballOwner = ball.ownerId
    const teamHasBall = ctx.teammates.some((t) => t.hasBall) || player.hasBall
    const opponentHasBall = opponents.some((o) => o.hasBall)

    // Goalkeeper special behavior
    if (player.isGoalkeeper) {
      if (player.hasBall) {
        this.transitionTo("pass")
      } else {
        this.transitionTo("defend_goal")
      }
      return
    }

    // HSM State transitions
    if (player.hasBall) {
      // Has ball - decide between shoot, pass, dribble
      const distToGoal = Math.abs(player.x - opponentGoalX)
      const underPressure = opponents.some(
        (o) => this.distance(player.x, player.y, o.x, o.y) < this.params.pressureDistance,
      )

      if (distToGoal < this.params.shootThreshold) {
        this.transitionTo("shoot")
      } else if (underPressure && Math.random() > this.params.decisionRandomness) {
        this.transitionTo("pass")
      } else {
        this.transitionTo("dribble")
      }
    } else if (teamHasBall) {
      // Teammate has ball - support attack
      this.transitionTo("support_attack")
    } else if (opponentHasBall) {
      // Opponent has ball - defend
      const shouldChase = distToBall < 150 || Math.random() > 0.7
      if (shouldChase) {
        this.transitionTo("chase_ball")
      } else {
        this.transitionTo("mark_player")
      }
    } else {
      // Ball is loose - chase it
      if (distToBall < 200) {
        this.transitionTo("chase_ball")
      } else {
        this.transitionTo("intercept")
      }
    }
  }

  private transitionTo(newState: AIState) {
    if (this.state !== newState) {
      this.state = newState
      this.stateTimer = 0
      this.reactionTimer = Math.floor(this.params.reactionDelay * (0.5 + Math.random() * 0.5))
    }
  }

  private executeState(ctx: AIContext): AIAction {
    const action: AIAction = { moveX: 0, moveY: 0, shoot: false, pass: false, slide: false }
    const { player, ball, teammates, opponents, ownGoalX, opponentGoalX, fieldWidth, fieldHeight } = ctx

    switch (this.state) {
      case "defend_goal": {
        // Goalkeeper: track ball Y position, stay near goal
        const goalY = fieldHeight / 2
        this.targetX = ownGoalX + (player.team === "home" ? 30 : -30)
        this.targetY = Math.max(goalY - 60, Math.min(goalY + 60, ball.y))

        // Add prediction based on ball velocity
        if (Math.abs(ball.velocityX) > 1) {
          const timeToGoal = Math.abs(ownGoalX - ball.x) / Math.abs(ball.velocityX)
          this.targetY = ball.y + ball.velocityY * timeToGoal * 0.5
        }

        this.targetY = Math.max(goalY - 70, Math.min(goalY + 70, this.targetY))
        break
      }

      case "chase_ball": {
        // Move toward the ball with some prediction
        this.targetX = ball.x + ball.velocityX * 5
        this.targetY = ball.y + ball.velocityY * 5

        // Attempt slide tackle if close and opponent has ball
        const distToBall = this.distance(player.x, player.y, ball.x, ball.y)
        if (distToBall < 40 && ball.ownerId && opponents.some((o) => o.id === ball.ownerId)) {
          if (Math.random() > 0.7) {
            // Don't spam slide
            action.slide = true
          }
        }
        break
      }

      case "support_attack": {
        // Find good supporting position
        const ballCarrier = teammates.find((t) => t.hasBall)
        if (ballCarrier) {
          // Position ahead and to the side of ball carrier
          const ahead = player.team === "home" ? 1 : -1
          this.targetX = ballCarrier.x + ahead * this.params.supportSpread

          // Spread vertically from other teammates
          const myIndex = teammates.findIndex((t) => this.distance(t.x, t.y, player.x, player.y) < 5)
          const vertOffset = ((myIndex % 3) - 1) * 80
          this.targetY = ballCarrier.y + vertOffset

          // Stay in bounds and not too close to goal
          this.targetX = Math.max(100, Math.min(fieldWidth - 100, this.targetX))
          this.targetY = Math.max(60, Math.min(fieldHeight - 60, this.targetY))
        }
        break
      }

      case "mark_player": {
        // Find nearest opponent to mark
        let nearestOpp = opponents[0]
        let minDist = Number.POSITIVE_INFINITY
        opponents.forEach((o) => {
          const dist = this.distance(player.x, player.y, o.x, o.y)
          if (dist < minDist && !o.hasBall) {
            minDist = dist
            nearestOpp = o
          }
        })

        // Position between opponent and own goal
        if (nearestOpp) {
          this.targetX = nearestOpp.x + (ownGoalX - nearestOpp.x) * 0.3
          this.targetY = nearestOpp.y
        }
        break
      }

      case "intercept": {
        // Predict where ball will be and intercept
        const predictTime = 20
        this.targetX = ball.x + ball.velocityX * predictTime
        this.targetY = ball.y + ball.velocityY * predictTime

        // Clamp to field
        this.targetX = Math.max(30, Math.min(fieldWidth - 30, this.targetX))
        this.targetY = Math.max(30, Math.min(fieldHeight - 30, this.targetY))
        break
      }

      case "shoot": {
        // Move toward goal and shoot
        const goalY = fieldHeight / 2 + (Math.random() - 0.5) * 100
        this.targetX = opponentGoalX
        this.targetY = goalY

        // Shoot when facing goal
        const facingGoal = player.team === "home" ? player.x < opponentGoalX : player.x > opponentGoalX

        if (facingGoal && this.stateTimer > 10) {
          action.shoot = true
        }
        break
      }

      case "pass": {
        // Find best pass target
        let bestTarget = teammates[0]
        let bestScore = Number.NEGATIVE_INFINITY

        teammates.forEach((tm) => {
          if (this.distance(tm.x, tm.y, player.x, player.y) < 30) return // Too close

          let score = 0
          // Prefer teammates further up field
          const upField = player.team === "home" ? tm.x - player.x : player.x - tm.x
          score += upField * 0.5

          // Prefer unmarked teammates
          const nearestOpp = this.findNearest(tm.x, tm.y, opponents)
          if (nearestOpp) {
            score += nearestOpp.dist * 0.3
          }

          // Add randomness based on difficulty
          score += (Math.random() - 0.5) * (1 - this.params.passAccuracy) * 200

          if (score > bestScore) {
            bestScore = score
            bestTarget = tm
          }
        })

        if (bestTarget && this.stateTimer > 5) {
          // Face the target then pass
          this.targetX = bestTarget.x
          this.targetY = bestTarget.y
          action.pass = true
        }
        break
      }

      case "dribble": {
        // Move toward opponent goal while avoiding defenders
        this.targetX = opponentGoalX
        this.targetY = player.y

        // Avoid nearby opponents
        opponents.forEach((o) => {
          const dist = this.distance(player.x, player.y, o.x, o.y)
          if (dist < 60) {
            // Move perpendicular to opponent
            const dy = player.y - o.y
            this.targetY += dy > 0 ? 30 : -30
          }
        })

        this.targetY = Math.max(80, Math.min(fieldHeight - 80, this.targetY))
        break
      }

      default:
        // Idle - return to default position
        const defaultX = player.team === "home" ? fieldWidth * 0.35 : fieldWidth * 0.65
        this.targetX = defaultX
        this.targetY = fieldHeight / 2
    }

    // Add positioning error
    this.targetX += (Math.random() - 0.5) * this.params.positioningError
    this.targetY += (Math.random() - 0.5) * this.params.positioningError

    // Calculate movement toward target
    const dx = this.targetX - player.x
    const dy = this.targetY - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 5) {
      action.moveX = dx / dist
      action.moveY = dy / dist
    }

    return action
  }

  private distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  }

  private findNearest(
    x: number,
    y: number,
    entities: Array<{ x: number; y: number }>,
  ): { entity: (typeof entities)[0]; dist: number } | null {
    if (entities.length === 0) return null
    let nearest = entities[0]
    let minDist = this.distance(x, y, nearest.x, nearest.y)

    entities.forEach((e) => {
      const dist = this.distance(x, y, e.x, e.y)
      if (dist < minDist) {
        minDist = dist
        nearest = e
      }
    })

    return { entity: nearest, dist: minDist }
  }
}
