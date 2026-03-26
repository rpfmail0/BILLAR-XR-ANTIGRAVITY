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
        const material = new THREE.MeshPhysicalMaterial({
            color: this.color,
            roughness: 0.05,
            metalness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            reflectivity: 0.5
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Add rotation marker (especially for white ball to see spin)
        if (this.color === 0xffffff || this.color === 'white') {
            const markerGeo = new THREE.SphereGeometry(0.004, 16, 16);
            const markerMat = new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.2, metalness: 0.1 });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            
            // Aplanar drásticamente la esfera para que sea casi bidimensional (como una pegatina/calcomanía)
            marker.scale.set(1, 0.05, 1); 
            
            // Colocar justo en la superficie. Al estar tan aplanada apenas sobresaldrá
            marker.position.set(0, this.radius, 0); 
            this.mesh.add(marker);

            // Añadir el segundo marcador en el polo opuesto
            const marker2 = marker.clone();
            marker2.position.set(0, -this.radius, 0);
            this.mesh.add(marker2);
        }
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
        this.body.linearDamping = 0.15; // Professional tournament cloth speed
        this.body.angularDamping = 0.2;
        
        
        // Listen to collision specifically on the body to avoid global missing contact bugs
        this.body.addEventListener('collide', (event) => {
            if (!this.physicsWorld.soundManager) return;
            try {
                const impactVelocity = Math.abs(event.contact.getImpactVelocityAlongNormal());
                if (!Number.isFinite(impactVelocity) || impactVelocity < 0.1) return;
                
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
