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
        const volume = Math.min(1.0, 0.5 + power);
        this.playSound(600, 'sine', 0.05, volume, true);
    }

    playBallHit(impactVelocity) {
        if (!this.ctx) return;
        // Map impact velocity to volume (e.g. 0.1 to 5.0)
        let volume = impactVelocity * 0.2;
        volume = Math.max(0.05, Math.min(volume, 1.0));
        
        // High pitch sharp click
        this.playSound(2500, 'triangle', 0.03, volume, false);
        this.playSound(4000, 'sine', 0.02, volume * 0.5, false);
    }

    playCushionHit(impactVelocity) {
        if (!this.ctx) return;
        let volume = impactVelocity * 0.2;
        volume = Math.max(0.05, Math.min(volume, 1.0));
        
        // Lower pitch thud
        this.playSound(300, 'square', 0.1, volume * 0.6, true);
    }

    playSound(freq, type, duration, volume, lowpass) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        // Quick drop off for percussive sound
        osc.frequency.exponentialRampToValueAtTime(freq * 0.1, this.ctx.currentTime + duration);
        
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
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
