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
        let volume = impactVelocity * 0.4;
        volume = Math.max(0.1, Math.min(volume, 1.0));
        
        // Biliard balls: high pitch, extremely sharp click (like two stones hitting)
        this.playSound(3500, 'square', 0.02, volume, true);
        this.playSound(6000, 'sine', 0.01, volume * 0.8, false);
    }

    playCushionHit(impactVelocity) {
        if (!this.ctx) return;
        let volume = impactVelocity * 0.3;
        volume = Math.max(0.1, Math.min(volume, 1.0));
        
        // Cushion: Dull, heavy thud. Low pitch, slightly longer.
        this.playSound(150, 'sine', 0.1, volume * 0.9, false);
        this.playSound(80, 'triangle', 0.15, volume, true);
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
            filter.frequency.value = freq * 1.5;
            gain.connect(filter);
            targetNode = filter;
        }
        
        targetNode.connect(this.ctx.destination);
        osc.connect(gain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}
