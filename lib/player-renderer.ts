export interface PlayerRenderState {
  x: number
  y: number
  team: "home" | "away"
  isGoalkeeper: boolean
  isSliding: boolean
  hasBall: boolean
  facingX: number
  facingY: number
  isHuman: boolean
  name: string
  animFrame: number
  velocityX?: number
  velocityY?: number
}

export function drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerRenderState, showIndicator = true) {
  const { x, y, team, isGoalkeeper, isSliding, isHuman, hasBall, facingX, animFrame } = player

  // Determine if moving based on velocity or animation frame
  const vx = player.velocityX ?? 0
  const vy = player.velocityY ?? 0
  const isMoving = Math.abs(vx) > 0.3 || Math.abs(vy) > 0.3

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
  ctx.beginPath()
  ctx.ellipse(x, y + 14, 10, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Slide effect with dust particles
  if (isSliding) {
    ctx.fillStyle = "rgba(200, 180, 140, 0.6)"
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(
        x - facingX * (10 + i * 6) + (Math.random() - 0.5) * 10,
        y + 10 + (Math.random() - 0.5) * 6,
        2 + Math.random() * 3,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  // Color palette
  const skinColor = "#f5d0a9"
  const skinDark = "#d4a574"
  const hairColor = team === "home" ? "#4a3728" : "#1a1a2e"

  let shirtMain = team === "home" ? "#e63946" : "#457b9d"
  let shirtDark = team === "home" ? "#c1121f" : "#1d3557"
  let shirtLight = team === "home" ? "#ff6b6b" : "#a8dadc"
  let shortsColor = team === "home" ? "#1d3557" : "#1d3557"

  if (isGoalkeeper) {
    shirtMain = team === "home" ? "#f4a261" : "#2ec4b6"
    shirtDark = team === "home" ? "#e76f51" : "#1a9f8f"
    shirtLight = team === "home" ? "#ffd093" : "#5de3d6"
    shortsColor = "#1a1a2e"
  }

  // Animation calculations
  const runCycle = isMoving ? Math.sin(animFrame * 0.4) : 0
  const legSpread = runCycle * 5
  const armSwing = runCycle * 4
  const bodyBob = Math.abs(runCycle) * 1.5

  if (isSliding) {
    // ===== SLIDING POSE =====
    // Body horizontal
    ctx.save()
    ctx.translate(x, y)

    // Stretched legs
    ctx.fillStyle = shortsColor
    ctx.fillRect(-12, 0, 24, 6)

    // Shoes
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(-14, 1, 5, 4)
    ctx.fillRect(9, 1, 5, 4)

    // Torso
    ctx.fillStyle = shirtMain
    ctx.fillRect(-8, -6, 16, 8)
    ctx.fillStyle = shirtDark
    ctx.fillRect(-8, -6, 4, 8)
    ctx.fillStyle = shirtLight
    ctx.fillRect(2, -6, 3, 6)

    // Arms outstretched
    ctx.fillStyle = skinColor
    ctx.fillRect(-14, -5, 6, 4)
    ctx.fillRect(8, -5, 6, 4)

    // Head turned sideways
    ctx.fillStyle = skinColor
    ctx.beginPath()
    ctx.arc(facingX * 14, -4, 5, 0, Math.PI * 2)
    ctx.fill()

    // Hair
    ctx.fillStyle = hairColor
    ctx.beginPath()
    ctx.arc(facingX * 14, -6, 4, Math.PI, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  } else {
    // ===== STANDING/RUNNING POSE =====
    ctx.save()
    ctx.translate(x, y - bodyBob)

    // === LEGS with running animation ===
    const leftLegX = -4 - legSpread
    const rightLegX = 2 + legSpread
    const leftLegBend = runCycle > 0 ? runCycle * 3 : 0
    const rightLegBend = runCycle < 0 ? -runCycle * 3 : 0

    // Left thigh
    ctx.fillStyle = shortsColor
    ctx.save()
    ctx.translate(leftLegX + 2, 4)
    ctx.rotate(runCycle * 0.3)
    ctx.fillRect(-2, 0, 5, 6)

    // Left shin
    ctx.fillStyle = skinColor
    ctx.translate(0, 6)
    ctx.rotate(-leftLegBend * 0.1)
    ctx.fillRect(-2, 0, 4, 5)

    // Left foot
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(-2 + (facingX > 0 ? -1 : 0), 4, 5, 3)
    ctx.restore()

    // Right thigh
    ctx.fillStyle = shortsColor
    ctx.save()
    ctx.translate(rightLegX + 2, 4)
    ctx.rotate(-runCycle * 0.3)
    ctx.fillRect(-2, 0, 5, 6)

    // Right shin
    ctx.fillStyle = skinColor
    ctx.translate(0, 6)
    ctx.rotate(-rightLegBend * 0.1)
    ctx.fillRect(-2, 0, 4, 5)

    // Right foot
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(-2 + (facingX > 0 ? -1 : 0), 4, 5, 3)
    ctx.restore()

    // === SHORTS connecting ===
    ctx.fillStyle = shortsColor
    ctx.fillRect(-6, 2, 12, 5)

    // === TORSO/SHIRT ===
    ctx.fillStyle = shirtMain
    ctx.fillRect(-7, -9, 14, 13)

    // Shirt shading
    ctx.fillStyle = shirtDark
    ctx.fillRect(-7, -9, 3, 13)
    ctx.fillStyle = shirtLight
    ctx.fillRect(2, -9, 2, 11)

    // Collar
    ctx.fillStyle = shirtLight
    ctx.fillRect(-3, -10, 6, 2)

    // Shirt number on back/front
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 7px monospace"
    ctx.textAlign = "center"
    const playerNum = player.name.match(/\d+/)?.[0] || "1"
    ctx.fillText(playerNum, 0, -1)

    // === ARMS with swing animation ===
    ctx.fillStyle = skinColor
    // Left arm
    ctx.save()
    ctx.translate(-8, -6)
    ctx.rotate(armSwing * 0.15)
    ctx.fillRect(-2, 0, 4, 8)
    // Hand
    ctx.fillStyle = skinDark
    ctx.fillRect(-1, 7, 3, 3)
    ctx.restore()

    // Right arm
    ctx.save()
    ctx.translate(8, -6)
    ctx.rotate(-armSwing * 0.15)
    ctx.fillRect(-2, 0, 4, 8)
    // Hand
    ctx.fillStyle = skinDark
    ctx.fillRect(-1, 7, 3, 3)
    ctx.restore()

    // === HEAD ===
    ctx.fillStyle = skinColor
    ctx.beginPath()
    ctx.arc(0, -14, 7, 0, Math.PI * 2)
    ctx.fill()

    // Ears
    ctx.fillStyle = skinDark
    ctx.beginPath()
    ctx.arc(-7, -14, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(7, -14, 2, 0, Math.PI * 2)
    ctx.fill()

    // Hair
    ctx.fillStyle = hairColor
    ctx.beginPath()
    ctx.ellipse(0, -18, 6, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(-6, -18, 12, 3)

    // Face details
    const eyeOffsetX = facingX * 2
    // Eyes
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(-3 + eyeOffsetX, -15, 3, 3)
    ctx.fillRect(1 + eyeOffsetX, -15, 3, 3)
    // Pupils
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(-2 + eyeOffsetX + facingX, -14, 2, 2)
    ctx.fillRect(2 + eyeOffsetX + facingX, -14, 2, 2)

    // Mouth (small line when moving, neutral otherwise)
    ctx.fillStyle = "#c1786a"
    if (isMoving) {
      ctx.fillRect(-1 + eyeOffsetX, -10, 3, 1)
    } else {
      ctx.fillRect(-1 + eyeOffsetX, -10, 2, 1)
    }

    ctx.restore()
  }

  // Human-controlled indicator (triangle above head)
  if (isHuman && showIndicator) {
    ctx.fillStyle = "#00ff88"
    ctx.beginPath()
    ctx.moveTo(x, y - 28)
    ctx.lineTo(x - 6, y - 36)
    ctx.lineTo(x + 6, y - 36)
    ctx.closePath()
    ctx.fill()

    // Pulsing glow
    const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7
    ctx.fillStyle = `rgba(0, 255, 136, ${pulse * 0.3})`
    ctx.beginPath()
    ctx.arc(x, y - 32, 8, 0, Math.PI * 2)
    ctx.fill()
  }

  // Ball possession indicator (glowing dot above head)
  if (hasBall) {
    ctx.fillStyle = "#ffff00"
    ctx.shadowColor = "#ffff00"
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(x, y - 40, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // Player name
  ctx.fillStyle = "#fff"
  ctx.strokeStyle = "#000"
  ctx.lineWidth = 2
  ctx.font = "bold 9px monospace"
  ctx.textAlign = "center"
  ctx.strokeText(player.name.slice(0, 8), x, y + 28)
  ctx.fillText(player.name.slice(0, 8), x, y + 28)
}

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, size = 12) {
  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
  ctx.beginPath()
  ctx.ellipse(x, y + size / 2 + 3, size / 2, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // Ball base (white)
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.fill()

  // Pentagon pattern (classic soccer ball look)
  ctx.fillStyle = "#222"
  // Center pentagon
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const px = x + Math.cos(angle) * (size / 5)
    const py = y + Math.sin(angle) * (size / 5)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()

  // Outer hexagon pattern hints
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const px = x + Math.cos(angle) * (size / 2.5)
    const py = y + Math.sin(angle) * (size / 2.5)
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3)
  }

  // Outline
  ctx.strokeStyle = "#333"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.stroke()
}

export function drawField(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Grass base
  ctx.fillStyle = "#1a5f2a"
  ctx.fillRect(0, 0, width, height)

  // Grass stripes
  ctx.fillStyle = "#1e6b30"
  for (let i = 0; i < width; i += 40) {
    ctx.fillRect(i, 0, 20, height)
  }

  // Field outline
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
  ctx.lineWidth = 3
  ctx.strokeRect(25, 25, width - 50, height - 50)

  // Center line
  ctx.beginPath()
  ctx.moveTo(width / 2, 25)
  ctx.lineTo(width / 2, height - 25)
  ctx.stroke()

  // Center circle
  ctx.beginPath()
  ctx.arc(width / 2, height / 2, 60, 0, Math.PI * 2)
  ctx.stroke()

  // Center spot
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2)
  ctx.fill()

  // Penalty areas
  ctx.strokeRect(25, height / 2 - 90, 80, 180)
  ctx.strokeRect(width - 105, height / 2 - 90, 80, 180)

  // Goal areas (6-yard box)
  ctx.strokeRect(25, height / 2 - 50, 35, 100)
  ctx.strokeRect(width - 60, height / 2 - 50, 35, 100)

  // Penalty spots
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(80, height / 2, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(width - 80, height / 2, 3, 0, Math.PI * 2)
  ctx.fill()

  const goalHeight = 150
  const goalTop = height / 2 - goalHeight / 2

  // Goal posts and nets
  // Left goal
  ctx.fillStyle = "#333"
  ctx.fillRect(0, goalTop, 25, goalHeight)
  // Net pattern
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
  ctx.lineWidth = 1
  for (let i = 0; i < goalHeight; i += 10) {
    ctx.beginPath()
    ctx.moveTo(0, goalTop + i)
    ctx.lineTo(25, goalTop + i)
    ctx.stroke()
  }
  for (let i = 0; i < 25; i += 10) {
    ctx.beginPath()
    ctx.moveTo(i, goalTop)
    ctx.lineTo(i, goalTop + goalHeight)
    ctx.stroke()
  }
  // Goal frame
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = 4
  ctx.strokeRect(0, goalTop, 25, goalHeight)

  // Right goal
  ctx.fillStyle = "#333"
  ctx.fillRect(width - 25, goalTop, 25, goalHeight)
  // Net pattern
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
  ctx.lineWidth = 1
  for (let i = 0; i < goalHeight; i += 10) {
    ctx.beginPath()
    ctx.moveTo(width - 25, goalTop + i)
    ctx.lineTo(width, goalTop + i)
    ctx.stroke()
  }
  for (let i = 0; i < 25; i += 10) {
    ctx.beginPath()
    ctx.moveTo(width - 25 + i, goalTop)
    ctx.lineTo(width - 25 + i, goalTop + goalHeight)
    ctx.stroke()
  }
  // Goal frame
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = 4
  ctx.strokeRect(width - 25, goalTop, 25, goalHeight)
}
