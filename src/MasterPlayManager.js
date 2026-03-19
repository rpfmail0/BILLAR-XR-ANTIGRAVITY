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
                name: "Maestría: Bricole de 3 Bandas",
                description: "Tiro espectacular de banda. La blanca tocará: Banda Izquierda -> Superior -> Derecha antes de hacer la carambola.",
                positions: [
                    { x: 0.0, y: 0.83075, z: 1.3 },     // Blanca
                    { x: 0.5, y: 0.83075, z: -0.2 },    // Roja (Esperando)
                    { x: 0.4, y: 0.83075, z: -0.4 }     // Amarilla (Esperando)
                ],
                shot: {
                    power: 0.85,
                    direction: new THREE.Vector3(-0.71, 0, -1.3).normalize(), 
                    hitOffset: new THREE.Vector3(0, 0, 0) // Sin efecto para máxima estabilidad física
                }
            },
            {
                name: "Natural: Tres Bandas LKL",
                description: "Recorrido clásico Alrededor de la Mesa (Larga-Corta-Larga).",
                positions: [
                    { x: 0.355, y: 0.83075, z: 1.0 },
                    { x: 0.55, y: 0.83075, z: -0.2 },
                    { x: -0.5, y: 0.83075, z: 0.8 }
                ],
                shot: {
                    power: 0.8,
                    direction: new THREE.Vector3(0.2, 0, -1).normalize(),
                    hitOffset: new THREE.Vector3(0.01, 0, 0)
                }
            }
        ];
        
        this.currentPlayIndex = 0;
        this.isSimulating = false;
        this.logInterval = null;
        
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
        if (this.isSimulating) return "Simulación en curso...";
        
        const play = this.plays[this.currentPlayIndex];
        this.currentPlayIndex = (this.currentPlayIndex + 1) % this.plays.length;
        
        // Save state for undo BEFORE moving balls so user can go back to their own game
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
            ball.mesh.quaternion.set(0, 0, 0, 1);
        });
        
        this.isSimulating = true;
        console.log(`PROPO_JUGADA: ${play.name}`);
        
        // Show description on HUD
        if (this.xrHandler) {
            this.xrHandler.showHUDMessage(play.name + ": " + play.description, 4000);
        }

        // Schedule the master shot
        setTimeout(() => {
            this.executeShot(play);
            this.startLogging(); // Empieza a loguear la posición
            
            setTimeout(() => {
                this.isSimulating = false;
                this.stopLogging();
            }, 6000); // 6s de simulación
        }, 3000); 

        return play.name;
    }

    startLogging() {
        if (this.logInterval) clearInterval(this.logInterval);
        const whiteBall = this.balls[0];
        this.logInterval = setInterval(() => {
            console.log(`DEBUG_POS_BLANCA: X:${whiteBall.body.position.x.toFixed(3)}, Z:${whiteBall.body.position.z.toFixed(3)}`);
        }, 200);
    }

    stopLogging() {
        if (this.logInterval) {
            clearInterval(this.logInterval);
            this.logInterval = null;
        }
    }

    executeShot(play) {
        const whiteBall = this.balls[0];
        const { power, direction, hitOffset } = play.shot;
        
        // Match XRHandler's non-linear power curve
        const maxForce = 0.15; // Ligeramente aumentado para asegurar el recorrido
        const forceMagnitude = Math.pow(power, 2) * maxForce;
        const force = direction.clone().multiplyScalar(forceMagnitude);
        const impulse = new CANNON.Vec3(force.x, force.y, force.z);
        
        // Calculate hit point for side spin (English)
        const hitPoint = whiteBall.mesh.position.clone().add(hitOffset);
        const worldPoint = new CANNON.Vec3(hitPoint.x, hitPoint.y, hitPoint.z);

        if (this.gameLogic) {
            this.gameLogic.startShot();
        }
        
        whiteBall.body.wakeUp();
        whiteBall.body.applyImpulse(impulse, worldPoint);
    }
}
