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
    // Low thump + high click
    this.playTone(150, 0.1, "square")
    this.playTone(80, 0.15, "triangle")
    setTimeout(() => this.playTone(400, 0.05, "square"), 10)
  }

  pass() {
    this.init()
    // Softer kick sound
    this.playTone(200, 0.08, "square")
    this.playTone(100, 0.1, "triangle")
  }

  goal() {
    this.init()
    // Victory fanfare
    const notes = [523, 659, 784, 1047] // C, E, G, C (major chord arpeggio)
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, "square"), i * 100)
    })
    // Add a final sustained note
    setTimeout(() => this.playTone(1047, 0.5, "triangle", false), 400)
  }

  slide() {
    this.init()
    // Sliding/swoosh noise
    this.playNoise(0.2, 0.15)
    this.playTone(100, 0.1, "sawtooth")
  }

  tackle() {
    this.init()
    // Impact sound
    this.playNoise(0.1, 0.25)
    this.playTone(80, 0.08, "square")
  }

  grab() {
    this.init()
    // Catch sound
    this.playTone(600, 0.05, "square")
    this.playTone(800, 0.05, "square")
  }

  bounce() {
    this.init()
    // Ball hitting wall
    this.playTone(300, 0.05, "square")
  }

  whistle() {
    this.init()
    // Referee whistle
    this.playTone(1200, 0.15, "sine")
    setTimeout(() => this.playTone(1400, 0.1, "sine"), 150)
    setTimeout(() => this.playTone(1200, 0.3, "sine"), 250)
  }

  select() {
    this.init()
    // Menu select
    this.playTone(440, 0.08, "square")
    setTimeout(() => this.playTone(880, 0.1, "square"), 50)
  }

  back() {
    this.init()
    // Menu back
    this.playTone(440, 0.08, "square")
    setTimeout(() => this.playTone(220, 0.1, "square"), 50)
  }
}

export const sounds = new SoundSystem()
