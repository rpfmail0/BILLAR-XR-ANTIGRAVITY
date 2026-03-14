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
        let volume = impactVelocity * 0.3;
        volume = Math.max(0.2, Math.min(volume, 1.0));
        
        this.playSound(2000, 'triangle', 0.08, volume, false);
        this.playSound(3500, 'sine', 0.05, volume * 0.5, false);
    }

    playCushionHit(impactVelocity) {
        if (!this.ctx) return;
        let volume = impactVelocity * 0.3;
        volume = Math.max(0.2, Math.min(volume, 1.0));
        
        this.playSound(250, 'square', 0.15, volume * 0.8, true);
    }

    playSound(freq, type, duration, volume, lowpass) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(freq * 0.2, this.ctx.currentTime + duration);
        
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        // Use linearRamp instead of exponential to avoid sudden cutoffs which sometimes click or mute
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
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
