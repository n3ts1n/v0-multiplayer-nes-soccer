// Gamepad support for NES Soccer
export interface GamepadState {
  connected: boolean
  moveX: number
  moveY: number
  shoot: boolean
  pass: boolean
  slide: boolean
  grab: boolean
  start: boolean
  select: boolean
}

const DEADZONE = 0.15

export function getGamepadState(index: number): GamepadState {
  const state: GamepadState = {
    connected: false,
    moveX: 0,
    moveY: 0,
    shoot: false,
    pass: false,
    slide: false,
    grab: false,
    start: false,
    select: false,
  }

  const gamepads = navigator.getGamepads()
  const gamepad = gamepads[index]

  if (!gamepad) return state

  state.connected = true

  // Left stick / D-pad for movement
  const axisX = gamepad.axes[0] || 0
  const axisY = gamepad.axes[1] || 0

  // Apply deadzone
  state.moveX = Math.abs(axisX) > DEADZONE ? axisX : 0
  state.moveY = Math.abs(axisY) > DEADZONE ? axisY : 0

  // D-pad support (buttons 12-15 on standard gamepad)
  if (gamepad.buttons[12]?.pressed) state.moveY = -1 // Up
  if (gamepad.buttons[13]?.pressed) state.moveY = 1 // Down
  if (gamepad.buttons[14]?.pressed) state.moveX = -1 // Left
  if (gamepad.buttons[15]?.pressed) state.moveX = 1 // Right

  // Buttons (standard mapping)
  // A/Cross = Shoot
  state.shoot = gamepad.buttons[0]?.pressed || false
  // B/Circle = Slide
  state.slide = gamepad.buttons[1]?.pressed || false
  // X/Square = Pass
  state.pass = gamepad.buttons[2]?.pressed || false
  // Y/Triangle = Grab (GK)
  state.grab = gamepad.buttons[3]?.pressed || false
  // Start
  state.start = gamepad.buttons[9]?.pressed || false
  // Select/Back
  state.select = gamepad.buttons[8]?.pressed || false

  // Shoulder buttons as alternatives
  // LB/L1 = Pass
  if (gamepad.buttons[4]?.pressed) state.pass = true
  // RB/R1 = Shoot
  if (gamepad.buttons[5]?.pressed) state.shoot = true
  // LT/L2 = Slide (analog trigger)
  if ((gamepad.buttons[6]?.value || 0) > 0.5) state.slide = true
  // RT/R2 = Grab
  if ((gamepad.buttons[7]?.value || 0) > 0.5) state.grab = true

  return state
}

export function pollGamepads(): Map<number, GamepadState> {
  const states = new Map<number, GamepadState>()
  const gamepads = navigator.getGamepads()

  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i]) {
      states.set(i, getGamepadState(i))
    }
  }

  return states
}

export function getGamepadInput(index: number) {
  const state = getGamepadState(index)
  return {
    up: state.moveY < -0.5,
    down: state.moveY > 0.5,
    left: state.moveX < -0.5,
    right: state.moveX > 0.5,
    leftStickX: state.moveX,
    leftStickY: state.moveY,
    shoot: state.shoot,
    pass: state.pass,
    slide: state.slide,
    grab: state.grab,
  }
}
