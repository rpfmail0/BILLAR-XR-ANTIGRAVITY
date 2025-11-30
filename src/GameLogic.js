import * as CANNON from 'cannon-es';

export class GameLogic {
    constructor(scene, physicsWorld, balls) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.balls = balls; // [White, Yellow, Red]

        this.score = 0;
        this.shotActive = false;
        this.cushionContacts = 0;
        this.ballsHit = new Set();

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
        div.style.fontFamily = 'sans-serif';
        div.innerText = 'Score: 0';
        document.body.appendChild(div);
        this.scoreElement = div;
    }

    updateScore(points) {
        this.score += points;
        this.scoreElement.innerText = `Score: ${this.score}`;
    }

    startShot() {
        if (this.shotActive) return; // Already active
        this.shotActive = true;
        this.cushionContacts = 0;
        this.ballsHit.clear();
        console.log("Shot started");
    }

    initCollisionListeners() {
        const whiteBallBody = this.balls[0].body;

        whiteBallBody.addEventListener('collide', (e) => {
            if (!this.shotActive) return;

            const contactBody = e.body;

            // Check if cushion
            if (contactBody.material && contactBody.material.name === 'cushion') {
                this.cushionContacts++;
                console.log("Cushion hit! Count:", this.cushionContacts);
            }

            // Check if other balls
            // Yellow is index 1, Red is index 2
            if (contactBody === this.balls[1].body) {
                if (!this.ballsHit.has(1)) {
                    this.ballsHit.add(1);
                    console.log("Hit Yellow Ball");
                    this.checkScore();
                }
            } else if (contactBody === this.balls[2].body) {
                if (!this.ballsHit.has(2)) {
                    this.ballsHit.add(2);
                    console.log("Hit Red Ball");
                    this.checkScore();
                }
            }
        });
    }

    checkScore() {
        if (this.ballsHit.size === 2) {
            if (this.cushionContacts >= 3) {
                console.log("POINT SCORED!");
                this.updateScore(1);
                // Reset for next shot logic handled by stopShot or timeout?
                // Usually we wait for balls to stop.
            } else {
                console.log("No point. Not enough cushions.");
            }
            // End shot logic effectively
        }
    }

    update() {
        // Check if balls stopped to reset shotActive?
        // For now, we can just leave it active until next shot?
        // But we need to know when to allow shooting again or reset state.

        // Simple check: if total velocity is low
        let totalSpeed = 0;
        this.balls.forEach(ball => {
            totalSpeed += ball.body.velocity.length();
        });

        if (this.shotActive && totalSpeed < 0.05) {
            // Balls stopped
            // this.shotActive = false; 
            // We don't auto-reset shotActive false immediately because we might want to wait.
            // But for this logic, we can say shot is done.
        }

        // If speed is high, ensure shotActive is true? 
        // No, startShot is called by XRHandler.

        if (totalSpeed < 0.01 && this.shotActive) {
            this.shotActive = false;
            console.log("Balls stopped. Shot ended.");
        }
    }
}
