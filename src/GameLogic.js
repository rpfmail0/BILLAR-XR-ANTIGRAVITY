import * as CANNON from 'cannon-es';

export class GameLogic {
    constructor(scene, physicsWorld, balls) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.balls = balls; // [White, Yellow, Red]

        this.score = 0;
        this.streak = 0;
        this.shotActive = false;
        this.cushionContacts = 0;
        this.ballsHit = new Set();
        this.pointScoredThisShot = false;
        this.shotStartTime = 0;
        this.quietFrames = 0;

        this.initCollisionListeners();
        this.createScoreDisplay();
    }

    createScoreDisplay() {
        const div = document.createElement('div');
        div.id = 'score-board';
        div.style.position = 'absolute';
        div.style.top = '20px';
        div.style.left = '20px';
        div.style.color = 'white';
        div.style.fontSize = '24px';
        div.style.fontFamily = 'monospace';
        div.style.padding = '10px';
        div.style.background = 'rgba(0,0,0,0.5)';
        div.style.display = 'none'; // Hide by default in favor of VR HUD
        div.innerText = 'Score: 0 | Streak: 0';
        document.body.appendChild(div);
        this.scoreElement = div;
    }

    updateScore(points) {
        this.score += points;
        if (points > 0) {
            this.streak += points;
            this.pointScoredThisShot = true;
        }
        this.scoreElement.innerText = `Score: ${this.score} | Streak: ${this.streak}`;
    }

    startShot() {
        if (this.shotActive) return; 
        this.shotActive = true;
        this.cushionContacts = 0;
        this.ballsHit.clear();
        this.pointScoredThisShot = false;
        this.shotStartTime = performance.now();
        this.quietFrames = 0;
        console.log("3-BANDAS: Tiro iniciado.");
    }

    cancelShot() {
        this.shotActive = false;
        this.pointScoredThisShot = true; // Evitar reseteo de streak
        console.log("3-BANDAS: Tiro cancelado (Undo). Streak preservado.");
    }

    initCollisionListeners() {
        const whiteBallBody = this.balls[0].body;

        whiteBallBody.addEventListener('collide', (e) => {
            if (!this.shotActive) return;

            const contactBody = e.body;

            // Detección de Banda
            if (contactBody.material && contactBody.material.name === 'cushion') {
                this.cushionContacts++;
                console.log("BANDA!", this.cushionContacts);
            }

            // Detección de Bolas (Amarilla = 1, Roja = 2)
            if (contactBody === this.balls[1].body) {
                this.onBallHit(1);
            } else if (contactBody === this.balls[2].body) {
                this.onBallHit(2);
            }
        });
    }

    onBallHit(ballId) {
        if (!this.ballsHit.has(ballId)) {
            this.ballsHit.add(ballId);
            const ballName = ballId === 1 ? "AMARILLA" : "ROJA";
            console.log(`BOLA ${ballName} tocada. Bandas acumuladas: ${this.cushionContacts}`);
            
            // VALIDACIÓN REGLAMENTARIA: 
            // 3 bandas ANTES de completar el contacto con la segunda bola.
            if (this.ballsHit.size === 2) {
                if (this.cushionContacts >= 3) {
                    console.log("¡CARAMBOLA VÁLIDA! (3+ bandas)");
                    this.updateScore(1);
                } else {
                    console.log("¡CARAMBOLA INVÁLIDA! (Pocas bandas:", this.cushionContacts, ")");
                }
            }
        }
    }

    update() {
        if (!this.shotActive) return;

        // Medir velocidad total del sistema
        let totalSpeed = 0;
        this.balls.forEach(ball => {
            totalSpeed += ball.body.velocity.length();
        });

        const now = performance.now();
        const duration = (now - this.shotStartTime) / 1000;

        // Umbral de calma: 20 frames seguidos de quietud absoluta
        if (totalSpeed < 0.008) {
            this.quietFrames++;
        } else {
            this.quietFrames = 0;
        }

        // Finalizar tiro si las bolas se detienen
        if (this.quietFrames > 20) {
            // Protección contra "roces accidentales" o fallos instantáneos (menos de 1 segundo de movimiento)
            const isAccidental = duration < 1.0 && totalSpeed < 0.005;
            
            if (!this.pointScoredThisShot && !isAccidental) {
                this.streak = 0;
                this.updateScore(0);
                console.log("3-BANDAS: Fallo. Streak reseteado.");
            } else if (isAccidental) {
                console.log("3-BANDAS: Movimiento mínimo ignorado (Protección contra fallos accidentales).");
            }
            
            this.shotActive = false;
            this.quietFrames = 0;
            console.log("3-BANDAS: Bolas detenidas. Fin del turno.");
        }
    }
}
