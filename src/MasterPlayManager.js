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
                name: "1. Bricole LKL",
                strategy: "Tres Bandas Larga-Corta-Larga (Bricole)",
                aim: "Banda izquierda a 1.3m.",
                effect: "Efecto DERECHA",
                power: "92%",
                positions: [{ x: 0.0, y: 0.83075, z: 1.3 }, { x: 0.5, y: 0.83075, z: -0.2 }, { x: 0.4, y: 0.83075, z: -0.4 }],
                shot: { power: 0.92, direction: new THREE.Vector3(-0.55, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.012, 0, 0) },
                path: [{x:0,z:1.3}, {x:-0.71,z:-0.2}, {x:0,z:-1.42}, {x:0.71,z:0}, {x:0.5,z:-0.2}, {x:0.4,z:-0.4}]
            },
            {
                name: "2. Alrededor de la Mesa",
                strategy: "Recorrido Natural LKL empezando por roja.",
                aim: "Bola roja fina por la derecha.",
                effect: "Efecto DERECHA ligero",
                power: "82%",
                positions: [{ x: 0.355, y: 0.83075, z: 1.0 }, { x: 0.55, y: 0.83075, z: -0.2 }, { x: -0.5, y: 0.83075, z: 0.8 }],
                shot: { power: 0.82, direction: new THREE.Vector3(0.25, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.005, 0, 0) },
                path: [{x:0.355,z:1.0}, {x:0.55,z:-0.2}, {x:0.71,z:-1.0}, {x:0,z:-1.42}, {x:-0.71,z:0}, {x:-0.5,z:0.8}]
            },
            {
                name: "3. Renverse Zig-Zag",
                strategy: "Zig-Zag Corta-Larga-Corta en 'N'.",
                aim: "Banda inferior a 0.4m del rincón.",
                effect: "Efecto IZQUIERDA fuerte",
                power: "88%",
                positions: [{ x: -0.4, y: 0.83075, z: 1.2 }, { x: 0.3, y: 0.83075, z: 1.0 }, { x: 0.5, y: 0.83075, z: -1.0 }],
                shot: { power: 0.88, direction: new THREE.Vector3(0.75, 0, -1).normalize(), hitOffset: new THREE.Vector3(-0.015, 0, 0) },
                path: [{x:-0.4,z:1.2}, {x:0.71,z:0.5}, {x:-0.71,z:-0.5}, {x:0.3,z:1.0}, {x:0.5,z:-1.0}]
            },
            {
                name: "4. Tick-Tack Doble Corta",
                strategy: "Doble banda corta en el cabezal.",
                aim: "Banda superior izquierda.",
                effect: "Efecto DERECHA",
                power: "72%",
                positions: [{ x: 0.0, y: 0.83075, z: -1.0 }, { x: -0.3, y: 0.83075, z: -1.3 }, { x: 0.3, y: 0.83075, z: -1.3 }],
                shot: { power: 0.72, direction: new THREE.Vector3(-0.45, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.01, 0, 0) },
                path: [{x:0,z:-1.0}, {x:-0.5,z:-1.42}, {x:0.5,z:-1.42}, {x:-0.3,z:-1.3}, {x:0.3,z:-1.3}]
            },
            {
                name: "5. Cajón de 3 Bandas",
                strategy: "Cajón LKL cerrado técnica de rincón.",
                aim: "Bola roja directamente a banda larga.",
                effect: "Efecto DERECHA",
                power: "78%",
                positions: [{ x: -0.5, y: 0.83075, z: 1.1 }, { x: -0.6, y: 0.83075, z: 0.2 }, { x: -0.4, y: 0.83075, z: 0.0 }],
                shot: { power: 0.78, direction: new THREE.Vector3(0.12, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.008, 0, 0) },
                path: [{x:-0.5,z:1.1}, {x:-0.6,z:0.2}, {x:-0.71,z:-0.5}, {x:0,z:-1.42}, {x:-0.4,z:0}]
            },
            {
                name: "6. Pase de Banda Reverso",
                strategy: "Inversión de trayectoria tras banda larga.",
                aim: "Banda derecha con efecto contrario.",
                effect: "Efecto IZQUIERDA",
                power: "85%",
                positions: [{ x: 0.5, y: 0.83075, z: 0.5 }, { x: 0.55, y: 0.83075, z: -0.8 }, { x: -0.2, y: 0.83075, z: -0.5 }],
                shot: { power: 0.85, direction: new THREE.Vector3(0.08, 0, -1).normalize(), hitOffset: new THREE.Vector3(-0.012, 0, 0) },
                path: [{x:0.5,z:0.5}, {x:0.71,z:-1.0}, {x:0,z:-1.42}, {x:-0.71,z:-1.0}, {x:-0.2,z:-0.5}]
            },
            {
                name: "7. Cruce Diagonal",
                strategy: "Tres diagonales entre bandas largas.",
                aim: "Bola roja al centro de la mesa.",
                effect: "Efecto DERECHA suave",
                power: "95%",
                positions: [{ x: -0.6, y: 0.83075, z: 1.3 }, { x: -0.4, y: 0.83075, z: 0.8 }, { x: 0.6, y: 0.83075, z: -1.2 }],
                shot: { power: 0.95, direction: new THREE.Vector3(0.45, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.005, 0, 0) },
                path: [{x:-0.6,z:1.3}, {x:-0.4,z:0.8}, {x:0.71,z:0}, {x:-0.71,z:-1.0}, {x:0.6,z:-1.2}]
            },
            {
                name: "8. Retro-Banda Corta",
                strategy: "Uso de retroceso (Draw) hacia banda corta.",
                aim: "Centro bola roja abajo.",
                effect: "Retroceso fuerte",
                power: "90%",
                positions: [{ x: 0.0, y: 0.83075, z: 0.0 }, { x: 0.0, y: 0.83075, z: -0.8 }, { x: -0.5, y: 0.83075, z: 0.5 }],
                shot: { power: 0.9, direction: new THREE.Vector3(0.02, 0, -1).normalize(), hitOffset: new THREE.Vector3(0, -0.015, 0) },
                path: [{x:0,z:0}, {x:0,z:-0.8}, {x:0,z:-1.42}, {x:-0.5,z:0.5}]
            },
            {
                name: "9. Doble el Raíl",
                strategy: "Rebote en la misma banda larga dos veces.",
                aim: "Paralelo a banda larga derecha.",
                effect: "Efecto DERECHA",
                power: "75%",
                positions: [{ x: 0.6, y: 0.83075, z: 1.0 }, { x: 0.55, y: 0.83075, z: 0.5 }, { x: 0.6, y: 0.83075, z: -1.0 }],
                shot: { power: 0.75, direction: new THREE.Vector3(0.1, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.012, 0, 0) },
                path: [{x:0.6,z:1.0}, {x:0.71,z:0.5}, {x:0.71,z:-0.5}, {x:0.6,z:-1.0}]
            },
            {
                name: "10. La Omega 5 Bandas",
                strategy: "Recorrido completo por todo el perímetro.",
                aim: "Bola roja muy fina al rincón.",
                effect: "Efecto DERECHA máximo",
                power: "98%",
                positions: [{ x: 0.0, y: 0.83075, z: 1.3 }, { x: 0.6, y: 0.83075, z: 0.8 }, { x: -0.3, y: 0.83075, z: 1.2 }],
                shot: { power: 0.98, direction: new THREE.Vector3(0.75, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.015, 0, 0) },
                path: [{x:0,z:1.3}, {x:0.71,z:1.0}, {x:0.71,z:-1.0}, {x:-0.71,z:-1.0}, {x:-0.71,z:1.0}, {x:-0.3,z:1.2}]
            },
            {
                name: "11. Bricole Corta Inicial",
                strategy: "Banda corta antes de las largas.",
                aim: "Banda inferior abajo a la dcha.",
                effect: "Efecto IZQUIERDA",
                power: "88%",
                positions: [{ x: 0.2, y: 0.83075, z: 1.3 }, { x: -0.5, y: 0.83075, z: -0.5 }, { x: 0.0, y: 0.83075, z: -1.0 }],
                shot: { power: 0.88, direction: new THREE.Vector3(-0.35, 0, 1).normalize(), hitOffset: new THREE.Vector3(-0.01, 0, 0) },
                path: [{x:0.2,z:1.3}, {x:0,z:1.42}, {x:-0.71,z:0}, {x:-0.5,z:-0.5}, {x:0,z:-1.0}]
            },
            {
                name: "12. Ángulo Fino Diamante",
                strategy: "Tiro técnico en sistema Diamond.",
                aim: "Borde exterior de bola roja.",
                effect: "Efecto DERECHA suave",
                power: "85%",
                positions: [{ x: -0.2, y: 0.83075, z: 1.2 }, { x: -0.6, y: 0.83075, z: 1.25 }, { x: 0.5, y: 0.83075, z: -0.8 }],
                shot: { power: 0.85, direction: new THREE.Vector3(-1, 0, 0.05).normalize(), hitOffset: new THREE.Vector3(0.005, 0, 0) },
                path: [{x:-0.2,z:1.2}, {x:-0.6,z:1.25}, {x:-0.71,z:1.3}, {x:0.71,z:0}, {x:0.5,z:-0.8}]
            },
            {
                name: "13. El Siete (Zig Zag)",
                strategy: "Recorrido en forma de 7 para bolas separadas.",
                aim: "Banda izquierda superior.",
                effect: "Efecto IZQUIERDA máximo",
                power: "88%",
                positions: [{ x: 0.5, y: 0.83075, z: 1.3 }, { x: 0.4, y: 0.83075, z: 0.8 }, { x: 0.6, y: 0.83075, z: -0.5 }],
                shot: { power: 0.88, direction: new THREE.Vector3(-0.15, 0, -1).normalize(), hitOffset: new THREE.Vector3(-0.015, 0, 0) },
                path: [{x:0.5,z:1.3}, {x:0,z:1.42}, {x:-0.71,z:1.0}, {x:0.4,z:0.8}, {x:0.6,z:-0.5}]
            },
            {
                name: "14. Doble Inversión",
                strategy: "Giro invertido tras choque inicial.",
                aim: "Banda inferior izquierda.",
                effect: "Efecto DERECHA fuerte",
                power: "85%",
                positions: [{ x: -0.5, y: 0.83075, z: 0.0 }, { x: -0.55, y: 0.83075, z: 0.8 }, { x: 0.3, y: 0.83075, z: 0.0 }],
                shot: { power: 0.85, direction: new THREE.Vector3(0.04, 0, 1).normalize(), hitOffset: new THREE.Vector3(0.012, 0, 0) },
                path: [{x:-0.5,z:0}, {x:-0.55,z:0.8}, {x:-0.5,z:1.42}, {x:0.3,z:0}]
            },
            {
                name: "15. La Serpiente (5 Bandas)",
                strategy: "Culebrilla por las bandas largas.",
                aim: "Bola roja medio-llena.",
                effect: "Efecto DERECHA máximo",
                power: "100%",
                positions: [{ x: 0.6, y: 0.83075, z: 1.4 }, { x: 0.55, y: 0.83075, z: 0.7 }, { x: -0.1, y: 0.83075, z: 1.3 }],
                shot: { power: 1.0, direction: new THREE.Vector3(-0.05, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.015, 0, 0) },
                path: [{x:0.6,z:1.4}, {x:-0.71,z:0.5}, {x:0.71,z:-0.5}, {x:-0.1,z:1.3}]
            },
            {
                name: "16. Cajón Reverso Cerrado",
                strategy: "Cajón corto desde el fondo de mesa.",
                aim: "Banda superior derecha.",
                effect: "Efecto IZQUIERDA fuerte",
                power: "88%",
                positions: [{ x: 0.0, y: 0.83075, z: -1.0 }, { x: 0.5, y: 0.83075, z: -1.2 }, { x: -0.4, y: 0.83075, z: -0.5 }],
                shot: { power: 0.88, direction: new THREE.Vector3(1, 0, -0.25).normalize(), hitOffset: new THREE.Vector3(-0.01, 0, 0) },
                path: [{x:0,z:-1.0}, {x:0.71,z:-1.2}, {x:0.5,z:-1.42}, {x:-0.4,z:-0.5}]
            },
            {
                name: "17. Cruce Largo LKL",
                strategy: "Cruce central entre bandas largas.",
                aim: "Bola roja suave al lateral.",
                effect: "Efecto DERECHA suave",
                power: "88%",
                positions: [{ x: -0.6, y: 0.83075, z: 0.0 }, { x: -0.55, y: 0.83075, z: -0.8 }, { x: 0.4, y: 0.83075, z: 1.2 }],
                shot: { power: 0.88, direction: new THREE.Vector3(0.08, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.005, 0, 0) },
                path: [{x:-0.6,z:0}, {x:-0.71,z:-0.8}, {x:0.4,z:1.2}]
            },
            {
                name: "18. Diamante 50 (Sistema)",
                strategy: "Tiro clásico técnica de rincón.",
                aim: "Diamante 5 (banda larga dcha).",
                effect: "Efecto DERECHA fuerte",
                power: "95%",
                positions: [{ x: 0.0, y: 0.83075, z: 1.42 }, { x: 0.5, y: 0.83075, z: 0.0 }, { x: -0.6, y: 0.83075, z: 0.1 }],
                shot: { power: 0.95, direction: new THREE.Vector3(0.65, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.012, 0, 0) },
                path: [{x:0,z:1.42}, {x:0.71,z:0}, {x:-0.71,z:-1.0}, {x:-0.6,z:0.1}]
            },
            {
                name: "19. El Avión (Vuelo Largo)",
                strategy: "Triple diagonal cruzada extrema.",
                aim: "Bola roja fina arriba.",
                effect: "Efecto DERECHA máximo",
                power: "95%",
                positions: [{ x: -0.4, y: 0.83075, z: 1.2 }, { x: 0.4, y: 0.83075, z: 1.3 }, { x: -0.2, y: 0.83075, z: -1.3 }],
                shot: { power: 0.95, direction: new THREE.Vector3(1, 0, 0.05).normalize(), hitOffset: new THREE.Vector3(0.015, 0, 0) },
                path: [{x:-0.4,z:1.2}, {x:0.71,z:1.3}, {x:-0.71,z:-1.3}, {x:-0.2,z:-1.3}]
            },
            {
                name: "20. Gran Maestro Pincelada",
                strategy: "Toque ultra-fino suave.",
                aim: "Borde de bola amarilla.",
                effect: "Efecto IZQUIERDA máximo",
                power: "95%",
                positions: [{ x: 0.6, y: 0.83075, z: -1.2 }, { x: 0.65, y: 0.83075, z: 1.2 }, { x: -0.5, y: 0.83075, z: -1.0 }],
                shot: { power: 0.95, direction: new THREE.Vector3(-0.02, 0, 1).normalize(), hitOffset: new THREE.Vector3(-0.018, 0, 0) },
                path: [{x:0.6,z:-1.2}, {x:0.71,z:1.2}, {x:0.65,z:1.2}, {x:-0.5,z:-1.0}]
            }
        ];
        
        this.currentPlayIndex = 0;
        this.isSimulating = false;
        this.createTrajectoryLine();
    }

    createTrajectoryLine() {
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            linewidth: 3
        });
        const geometry = new THREE.BufferGeometry();
        this.trajectoryLine = new THREE.Line(geometry, material);
        this.trajectoryLine.visible = false;
        this.trajectoryLine.renderOrder = 2000;
        this.scene.add(this.trajectoryLine);
    }

    updateTrajectoryLine(direction) {
        const whiteBall = this.balls[0];
        if (!whiteBall) return;
        
        const start = whiteBall.mesh.position.clone();
        start.y = 0.835; 
        
        const end = start.clone().add(direction.clone().multiplyScalar(1.2));
        
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        this.trajectoryLine.geometry.dispose();
        this.trajectoryLine.geometry = geometry;
        this.trajectoryLine.visible = true;
    }

    showNextPlay() {
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        if (this.shotTimeout) clearTimeout(this.shotTimeout);
        if (this.safetyTimeout) clearTimeout(this.safetyTimeout);
        
        this.isSimulating = false;
        
        const play = this.plays[this.currentPlayIndex];
        this.currentPlayIndex = (this.currentPlayIndex + 1) % this.plays.length;
        
        this.xrHandler.savePreShotState();
        
        this.balls.forEach((ball, i) => {
            const pos = play.positions[i];
            ball.body.position.set(pos.x, pos.y, pos.z);
            ball.body.velocity.set(0, 0, 0);
            ball.body.angularVelocity.set(0, 0, 0);
            ball.body.wakeUp();
            ball.mesh.position.set(pos.x, pos.y, pos.z);
        });

        if (this.xrHandler) {
            const strategyInfo = `${play.name}\nESTRATEGIA: ${play.strategy}\nAPUNTAR: ${play.aim}\nEFECTO: ${play.effect}\nFUERZA: ${play.power}`.trim();
            this.xrHandler.showHUDMessage(strategyInfo, 8000);
            
            this.xrHandler.currentMasterPath = play.path;
            this.xrHandler.currentMasterBalls = play.positions;
            this.xrHandler.updateHUDContent();
            
            const whitePos = play.positions[0];
            this.xrHandler.alignWithShot(whitePos, play.shot.direction);
            
            this.updateTrajectoryLine(play.shot.direction);
        }

        this.shotTimeout = setTimeout(() => {
            this.trajectoryLine.visible = false;
            this.isSimulating = true;
            this.executeShot(play.shot);
            this.monitorShotAndReleaseLock();
        }, 8000); 

        return play.name;
    }

    monitorShotAndReleaseLock() {
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        
        let quietFrames = 0;
        this.monitorInterval = setInterval(() => {
            let totalVelocity = 0;
            this.balls.forEach(b => {
                totalVelocity += b.body.velocity.length();
            });

            if (totalVelocity < 0.01) {
                quietFrames++;
            } else {
                quietFrames = 0;
            }

            if (quietFrames > 3) {
                clearInterval(this.monitorInterval);
                this.isSimulating = false;
                
                if (this.xrHandler) {
                    this.xrHandler.currentMasterPath = null;
                    this.xrHandler.currentMasterBalls = null;
                    this.xrHandler.updateHUDContent();
                    this.xrHandler.restoreView();
                }
            }
        }, 200);

        this.safetyTimeout = setTimeout(() => {
            if (this.isSimulating) {
                clearInterval(this.monitorInterval);
                this.isSimulating = false;
                
                if (this.xrHandler) {
                    this.xrHandler.currentMasterPath = null;
                    this.xrHandler.currentMasterBalls = null;
                    this.xrHandler.updateHUDContent();
                    this.xrHandler.restoreView();
                }
            }
        }, 10000);
    }

    executeShot(shot) {
        const whiteBall = this.balls[0];
        const { power, direction, hitOffset } = shot;
        const forceMagnitude = Math.pow(power, 2) * 0.10;
        
        const dir = direction.clone();
        dir.y = 0;
        dir.normalize();

        const force = dir.clone().multiplyScalar(forceMagnitude);
        const impulse = new CANNON.Vec3(force.x, 0, force.z); 
        
        const worldPos = whiteBall.body.position;
        const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        
        const offsetWorld = right.clone().multiplyScalar(hitOffset.x)
                             .add(up.clone().multiplyScalar(hitOffset.y));

        const worldPoint = new CANNON.Vec3(
            worldPos.x + offsetWorld.x, 
            worldPos.y + offsetWorld.y,
            worldPos.z + offsetWorld.z
        );

        if (this.gameLogic) this.gameLogic.startShot();
        whiteBall.body.wakeUp();
        whiteBall.body.applyImpulse(impulse, worldPoint);
    }
}
