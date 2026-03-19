import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor(soundManager) {
        this.soundManager = soundManager;
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0); // Earth gravity
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 20; // Increased for high-precision collisions

        // Materials
        this.defaultMaterial = new CANNON.Material('default');
        this.ballMaterial = new CANNON.Material('ball');
        this.cushionMaterial = new CANNON.Material('cushion');

        const ballTableContactMaterial = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.defaultMaterial,
            {
                friction: 0.225, // Reduced from 0.45 by half
                restitution: 0.7 // Bounciness
            }
        );
        this.world.addContactMaterial(ballTableContactMaterial);

        const ballCushionContactMaterial = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.cushionMaterial,
            {
                friction: 0.01,
                restitution: 0.8 // Lowered to prevent energy gain artifacts
            }
        );
        this.world.addContactMaterial(ballCushionContactMaterial);

        const ballBallContactMaterial = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.ballMaterial,
            {
                friction: 0.1,
                restitution: 0.95 // High-elasticity but within stable limits
            }
        );
        this.world.addContactMaterial(ballBallContactMaterial);

    }

    step(dt) {
        this.world.step(1 / 60, dt, 3);
    }
}
