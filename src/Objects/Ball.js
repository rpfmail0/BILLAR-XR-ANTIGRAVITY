import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Ball {
    constructor(scene, physicsWorld, color, position) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.radius = 0.03075; // 61.5mm diameter
        this.color = color;
        this.startPosition = position;

        this.createVisuals();
        this.createPhysics();
    }

    createVisuals() {
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: this.color,
            roughness: 0.1,
            metalness: 0.1
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }

    createPhysics() {
        const shape = new CANNON.Sphere(this.radius);
        this.body = new CANNON.Body({
            mass: 0.21, // Standard ball weight approx 210g
            material: this.physicsWorld.ballMaterial,
            shape: shape
        });
        this.body.position.copy(this.startPosition);
        this.body.userData = { type: 'ball' };
        // Billiard balls on felt roll for a long time but slow down eventually
        this.body.linearDamping = 0.3; // Slipping / rolling friction
        this.body.angularDamping = 0.4;
        
        // Listen to collision specifically on the body to avoid global missing contact bugs
        this.body.addEventListener('collide', (event) => {
            if (!this.physicsWorld.soundManager) return;
            try {
                const impactVelocity = Math.abs(event.contact.getImpactVelocityAlongNormal());
                if (impactVelocity < 0.1) return;
                
                const other = event.body;
                if (!other || !other.userData) return;
                
                if (other.userData.type === 'ball') {
                    // Prevent double sounds by only letting the lower ID ball play it
                    if (this.body.id < other.id) {
                        this.physicsWorld.soundManager.playBallHit(impactVelocity);
                    }
                } else if (other.userData.type === 'cushion') {
                    this.physicsWorld.soundManager.playCushionHit(impactVelocity);
                }
            } catch (e) {
                console.warn('Audio collision issue:', e);
            }
        });

        this.physicsWorld.world.addBody(this.body);
    }

    update() {
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
    }
}
