// NES-style sound effects using Web Audio API
class SoundSystem {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private initialized = false

  init() {
    if (this.initialized) return
    try {
      this.audioContext = new AudioContext()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = 0.3
      this.masterGain.connect(this.audioContext.destination)
      this.initialized = true
    } catch (e) {
      console.warn("Audio not supported")
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = "square", decay = true) {
    if (!this.audioContext || !this.masterGain) return

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
    if (decay) {
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)
    }

    oscillator.connect(gainNode)
    gainNode.connect(this.masterGain)

    oscillator.start()
    oscillator.stop(this.audioContext.currentTime + duration)
  }

  private playNoise(duration: number, volume = 0.2) {
    if (!this.audioContext || !this.masterGain) return

    const bufferSize = this.audioContext.sampleRate * duration
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer

    const gainNode = this.audioContext.createGain()
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

    const filter = this.audioContext.createBiquadFilter()
    filter.type = "highpass"
    filter.frequency.value = 1000

    source.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(this.masterGain)

    source.start()
  }

  kick() {
    this.init()
    this.playTone(180, 0.08, "square")
    this.playTone(90, 0.12, "triangle")
    setTimeout(() => this.playTone(500, 0.04, "square"), 5)
    setTimeout(() => this.playNoise(0.03, 0.1), 0)
  }

  pass() {
    this.init()
    this.playTone(280, 0.06, "triangle")
    this.playTone(140, 0.08, "sine")
  }

  goal() {
    this.init()
    const notes = [523, 659, 784, 1047, 1319] // C, E, G, C, E
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.25, "square"), i * 80)
      setTimeout(() => this.playTone(freq / 2, 0.3, "triangle"), i * 80 + 20)
    })
    setTimeout(() => this.playTone(1047, 0.6, "triangle", false), 450)
    setTimeout(() => this.playTone(1319, 0.4, "square"), 500)
  }

  slide() {
    this.init()
    this.playNoise(0.25, 0.12)
    this.playTone(80, 0.15, "sawtooth")
    this.playTone(60, 0.2, "triangle")
  }

  tackle() {
    this.init()
    this.playNoise(0.12, 0.3)
    this.playTone(100, 0.1, "square")
    setTimeout(() => this.playTone(60, 0.08, "triangle"), 30)
  }

  grab() {
    this.init()
    this.playTone(500, 0.04, "square")
    this.playTone(700, 0.04, "square")
    setTimeout(() => this.playTone(900, 0.06, "triangle"), 30)
  }

  bounce() {
    this.init()
    this.playTone(350, 0.04, "square")
    this.playTone(200, 0.06, "triangle")
  }

  whistle() {
    this.init()
    this.playTone(1100, 0.12, "sine")
    setTimeout(() => this.playTone(1300, 0.08, "sine"), 120)
    setTimeout(() => this.playTone(1100, 0.25, "sine"), 200)
    setTimeout(() => this.playTone(1200, 0.15, "sine"), 350)
  }

  select() {
    this.init()
    this.playTone(440, 0.06, "square")
    setTimeout(() => this.playTone(880, 0.08, "square"), 40)
  }

  back() {
    this.init()
    this.playTone(440, 0.06, "square")
    setTimeout(() => this.playTone(220, 0.08, "square"), 40)
  }

  hover() {
    this.init()
    this.playTone(600, 0.03, "square")
  }

  countdown() {
    this.init()
    this.playTone(800, 0.1, "square")
  }

  gameStart() {
    this.init()
    this.playTone(523, 0.1, "square")
    setTimeout(() => this.playTone(659, 0.1, "square"), 100)
    setTimeout(() => this.playTone(784, 0.15, "square"), 200)
    setTimeout(() => this.playTone(1047, 0.3, "triangle"), 300)
  }
}

export const sounds = new SoundSystem()
