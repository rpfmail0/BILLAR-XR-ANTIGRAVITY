import * as CANNON from 'cannon-es';

const world = new CANNON.World();
const bodyA = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(1) });
const bodyB = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(1) });

bodyA.position.set(0, 0, 0);
bodyB.position.set(2, 0, 0);
bodyA.velocity.set(10, 0, 0);

world.addBody(bodyA);
world.addBody(bodyB);

bodyA.addEventListener('collide', (event) => {
    console.log('Collision!');
    try {
        const speed = event.contact.getImpactVelocityAlongNormal();
        console.log('Speed:', speed);
    } catch (e) {
        console.error('Error getting speed:', e);
    }
});

world.step(1/60);
world.step(1/60);
world.step(1/60);
world.step(1/60);
world.step(1/60);
world.step(1/60);
world.step(1/60);
