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
        
        // Internal physics world for pre-simulation
        this.tempWorld = new CANNON.World();
        this.tempWorld.gravity.set(0, -9.82, 0);
        this.tempWorld.solver.iterations = 10;
        
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
        
        // Save state for undo
        this.xrHandler.savePreShotState();
        
        // Reposition balls in main world
        this.balls.forEach((ball, i) => {
            const pos = play.positions[i];
            ball.body.position.set(pos.x, pos.y, pos.z);
            ball.body.velocity.set(0, 0, 0);
            ball.body.angularVelocity.set(0, 0, 0);
            ball.body.wakeUp();
            ball.mesh.position.set(pos.x, pos.y, pos.z);
        });

        this.isSimulating = true;
        
        // 1. Optimize the shot in internal simulation
        console.log(`MAESTRO: Buscando ángulo perfecto para "${play.name}"...`);
        const optimizedShot = this.findOptimizedShot(play);
        
        // 2. Announce play
        if (this.xrHandler) {
            this.xrHandler.showHUDMessage(play.name + ": " + play.description, 4000);
        }

        // 3. Execute
        setTimeout(() => {
            this.executeShot(optimizedShot);
            this.startLogging();
            
            setTimeout(() => {
                this.isSimulating = false;
                this.stopLogging();
            }, 6000);
        }, 3000); 

        return play.name;
    }

    findOptimizedShot(play) {
        let bestAngle = 0;
        const baseDir = play.shot.direction;
        const baseAngle = Math.atan2(baseDir.x, baseDir.z);
        
        // Search in a range of +/- 10 degrees
        const range = 0.18; // approx 10 deg
        const steps = 40;
        
        let found = false;
        for (let i = 0; i < steps; i++) {
            const offset = (i / steps - 0.5) * range;
            const angle = baseAngle + offset;
            
            if (this.testShot(play, angle)) {
                bestAngle = angle;
                found = true;
                console.log(`MAESTRO: ¡Ángulo rectificado! Offset: ${(offset * 180 / Math.PI).toFixed(2)}º`);
                break;
            }
        }
        
        if (!found) {
            console.warn("MAESTRO: No se encontró trayectoria perfecta, usando base.");
            bestAngle = baseAngle;
        }

        return {
            ...play.shot,
            direction: new THREE.Vector3(Math.sin(bestAngle), 0, Math.cos(bestAngle))
        };
    }

    testShot(play, angle) {
        // Setup mini-world with EXACT parameters from PhysicsWorld.js, Table.js and Ball.js
        const world = new CANNON.World();
        world.gravity.set(0, -9.82, 0);
        world.solver.iterations = 10;

        const ballMat = new CANNON.Material();
        const cushionMat = new CANNON.Material();
        const tableMat = new CANNON.Material();

        world.addContactMaterial(new CANNON.ContactMaterial(ballMat, cushionMat, { friction: 0.01, restitution: 0.8 }));
        world.addContactMaterial(new CANNON.ContactMaterial(ballMat, tableMat, { friction: 0.225, restitution: 0.7 }));
        world.addContactMaterial(new CANNON.ContactMaterial(ballMat, ballMat, { friction: 0.1, restitution: 0.98 }));

        // Add balls with correct mass and DAMPING
        const balls = play.positions.map((pos, i) => {
            const b = new CANNON.Body({ 
                mass: 0.21, // Match Ball.js
                shape: new CANNON.Sphere(0.03075),
                material: ballMat,
                linearDamping: 0.3, // CRITICAL: match Ball.js
                angularDamping: 0.4
            });
            b.position.set(pos.x, pos.y, pos.z);
            world.addBody(b);
            return b;
        });

        // Add cushions as BOXES (Match Table.js exactly)
        const cushionThickness = 0.1;
        const cushionHeight = 0.08;
        const addCushion = (w, l, x, z) => {
            const b = new CANNON.Body({ mass: 0, material: cushionMat });
            b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, cushionHeight / 2, l / 2)));
            b.position.set(x, 0.8 + cushionHeight / 2, z);
            world.addBody(b);
        };
        
        const tw = 1.42; // Table width
        const tl = 2.84; // Table length
        addCushion(cushionThickness, tl, -tw / 2 - cushionThickness / 2, 0); // L
        addCushion(cushionThickness, tl, tw / 2 + cushionThickness / 2, 0);  // R
        addCushion(tw, cushionThickness, 0, -tl / 2 - cushionThickness / 2); // T
        addCushion(tw, cushionThickness, 0, tl / 2 + cushionThickness / 2);  // B

        // Execute shot
        const impulseMag = Math.pow(play.shot.power, 2) * 0.15;
        const impulse = new CANNON.Vec3(Math.sin(angle) * impulseMag, 0, Math.cos(angle) * impulseMag);
        
        // Apply impulse at world center (no spin for stability in test)
        balls[0].applyImpulse(impulse, balls[0].position);

        let hitRed = false;
        let hitYellow = false;
        let cushionHits = 0;

        balls[0].addEventListener('collide', (e) => {
            const other = e.body;
            if (other === balls[1]) hitRed = true;
            if (other === balls[2]) hitYellow = true;
            if (other.material === cushionMat) cushionHits++;
        });

        // Sim 5 seconds (300 steps)
        for (let i = 0; i < 300; i++) {
            world.step(1/60);
            if (hitRed && hitYellow && cushionHits >= 3) return true;
        }

        return false;
    }

    executeShot(shot) {
        const whiteBall = this.balls[0];
        const { power, direction, hitOffset } = shot;
        
        const maxForce = 0.15;
        const forceMagnitude = Math.pow(power, 2) * maxForce;
        const force = direction.clone().multiplyScalar(forceMagnitude);
        const impulse = new CANNON.Vec3(force.x, force.y, force.z);
        
        const hitPoint = whiteBall.mesh.position.clone().add(hitOffset);
        const worldPoint = new CANNON.Vec3(hitPoint.x, hitPoint.y, hitPoint.z);

        if (this.gameLogic) this.gameLogic.startShot();
        
        whiteBall.body.wakeUp();
        whiteBall.body.applyImpulse(impulse, worldPoint);
    }
}
