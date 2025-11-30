import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor() {
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
                restitution: 0.9 // Very bouncy collisions between balls
            }
        );
        this.world.addContactMaterial(ballBallContactMaterial);
    }

    step(dt) {
        this.world.step(1 / 60, dt, 3);
    }
}
