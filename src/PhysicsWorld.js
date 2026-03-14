import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor(soundManager) {
        this.soundManager = soundManager;
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0); // Earth gravity
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;

        // Materials
        this.defaultMaterial = new CANNON.Material('default');
        this.ballMaterial = new CANNON.Material('ball');
        this.cushionMaterial = new CANNON.Material('cushion');

        const ballTableContactMaterial = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.defaultMaterial,
            {
                friction: 0.1,
                restitution: 0.7 // Bounciness
            }
        );
        this.world.addContactMaterial(ballTableContactMaterial);

        const ballCushionContactMaterial = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.cushionMaterial,
            {
                friction: 0.1,
                restitution: 0.8 // High bounce for cushions
            }
        );
        this.world.addContactMaterial(ballCushionContactMaterial);

        const ballBallContactMaterial = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.ballMaterial,
            {
                friction: 0.1,
                restitution: 0.98 // Very bouncy collisions between billiard balls
            }
        );
        this.world.addContactMaterial(ballBallContactMaterial);

        // Listen for collisions to play sounds
        this.world.addEventListener('beginContact', (event) => {
            if (!this.soundManager) return;
            
            const bodyA = event.bodyA;
            const bodyB = event.bodyB;
            
            // Check if both have userData set
            if (!bodyA.userData || !bodyB.userData) return;
            
            const typeA = bodyA.userData.type;
            const typeB = bodyB.userData.type;
            
            // Get impact speed
            const rawSpeed = event.contact.getImpactVelocityAlongNormal();
            const impactVelocity = Math.abs(rawSpeed);

            // Filter out tiny micro-collisions
            if (impactVelocity < 0.1) return;

            if (typeA === 'ball' && typeB === 'ball') {
                this.soundManager.playBallHit(impactVelocity);
            } else if ((typeA === 'ball' && typeB === 'cushion') || (typeB === 'ball' && typeA === 'cushion')) {
                this.soundManager.playCushionHit(impactVelocity);
            }
        });
    }

    step(dt) {
        this.world.step(1 / 60, dt, 3);
    }
}
