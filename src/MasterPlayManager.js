import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class MasterPlayManager {
    constructor(scene, balls, gameLogic, xrHandler) {
        this.scene = scene;
        this.balls = balls;
        this.gameLogic = gameLogic;
        this.xrHandler = xrHandler;
        
        this.plays = [
            {
                name: "Natural a 3 Bandas (Largo-Corto-Largo)",
                positions: [
                    { x: 0.4, y: 0.83075, z: 1.0 },   // White
                    { x: 0.5, y: 0.83075, z: -0.5 },  // Red (Target 1)
                    { x: -0.4, y: 0.83075, z: 0.5 }   // Yellow (Target 2)
                ],
                shot: {
                    power: 0.85,
                    direction: new THREE.Vector3(-0.1, 0, -1).normalize(),
                    hitOffset: new THREE.Vector3(0.015, 0, 0) // Slight side spin
                }
            },
            {
                name: "Bricole (Cojín Primero)",
                positions: [
                    { x: -0.3, y: 0.83075, z: 0.8 },
                    { x: 0.3, y: 0.83075, z: -0.8 },
                    { x: 0.0, y: 0.83075, z: -1.2 }
                ],
                shot: {
                    power: 0.75,
                    direction: new THREE.Vector3(-0.9, 0, -0.4).normalize(),
                    hitOffset: new THREE.Vector3(-0.01, 0.01, 0)
                }
            }
        ];
        
        this.currentPlayIndex = 0;
        this.isSimulating = false;
        
        this.createTrajectoryLine();
    }

    createTrajectoryLine() {
        const material = new THREE.LineDashedMaterial({
            color: 0x00ffff,
            dashSize: 0.05,
            gapSize: 0.03,
            transparent: true,
            opacity: 0.6
        });
        const geometry = new THREE.BufferGeometry();
        this.trajectoryLine = new THREE.Line(geometry, material);
        this.trajectoryLine.visible = false;
        this.scene.add(this.trajectoryLine);
    }

    showNextPlay() {
        const play = this.plays[this.currentPlayIndex];
        this.currentPlayIndex = (this.currentPlayIndex + 1) % this.plays.length;
        
        // Save state for undo before moving balls
        this.xrHandler.savePreShotState();
        
        // Reposition balls
        this.balls.forEach((ball, i) => {
            const pos = play.positions[i];
            ball.body.position.set(pos.x, pos.y, pos.z);
            ball.body.velocity.set(0, 0, 0);
            ball.body.angularVelocity.set(0, 0, 0);
            ball.body.quaternion.set(0, 0, 0, 1);
            ball.body.wakeUp();
            
            ball.mesh.position.set(pos.x, pos.y, pos.z);
        });
        
        console.log(`Proponiendo jugada: ${play.name}`);
        
        // Brief haptic feedback or visual cue could go here
        return play.name;
    }
}
