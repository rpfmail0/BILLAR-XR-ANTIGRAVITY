export class SoundManager {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playCueHit(power) {
        if (!this.ctx) return;
        const volume = Math.min(1.0, 0.8 + power * 0.5);
        this.playSound(400, 'sine', 0.1, volume, true);
    }

    playBallHit(impactVelocity) {
        if (!this.ctx) return;
        let volume = impactVelocity * 0.8; // Doubled from 0.4
        volume = Math.max(0.1, Math.min(volume, 1.0)); // Adjusted floor limit
        
        // Softer, more natural billiard clack (less strident)
        // A single short high-pitch sine wave drop gives a "pop/click" without stridency
        this.playSound(2500, 'sine', 0.03, volume, true);
        this.playSound(1800, 'sine', 0.02, volume * 0.6, false);
    }

    playCushionHit(impactVelocity) {
        if (!this.ctx) return;
        let volume = impactVelocity * 0.6; // Doubled from 0.3
        volume = Math.max(0.1, Math.min(volume, 1.0)); // Adjusted floor limit
        
        // Very soft, muffled thud for the cushion
        this.playSound(100, 'sine', 0.12, volume, true);
        this.playSound(60, 'sine', 0.15, volume * 0.8, true);
    }

    playSound(freq, type, duration, volume, lowpass) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq * 0.1), this.ctx.currentTime + duration);
        
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        // Exponential decay for much sharper percussive click
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        let targetNode = gain;
        
        if (lowpass) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            // Lower target frequency for a more muffled, natural tone
            filter.frequency.value = freq;
            gain.connect(filter);
            targetNode = filter;
        }
        
        targetNode.connect(this.ctx.destination);
        osc.connect(gain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}
