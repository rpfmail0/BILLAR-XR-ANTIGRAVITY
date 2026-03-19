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
                    power: 0.9, // Potente para 3 bandas
                    direction: new THREE.Vector3(-0.6, 0, -1).normalize(), 
                    hitOffset: new THREE.Vector3(0, 0, 0)
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
                    power: 0.6, // Reducido
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
        
        // Búsqueda profunda en un rango de +/- 30 grados
        const range = 1.05; // aprox 60 deg total (+/- 30)
        const steps = 120; // Resolución fina
        
        let found = false;
        for (let i = 0; i < steps; i++) {
            const offset = (i / steps - 0.5) * range;
            const angle = baseAngle + offset;
            
            if (this.testShot(play, angle)) {
                bestAngle = angle;
                found = true;
                const offsetDeg = (offset * 180 / Math.PI).toFixed(1);
                console.log(`MAESTRO: ¡Trayectoria encontrada! Corrección: ${offsetDeg}º`);
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
        world.solver.iterations = 20; // Match PhysicsWorld.js exactly

        const ballMat = new CANNON.Material();
        const cushionMat = new CANNON.Material();
        const tableMat = new CANNON.Material();

        world.addContactMaterial(new CANNON.ContactMaterial(ballMat, cushionMat, { friction: 0.01, restitution: 0.72 }));
        world.addContactMaterial(new CANNON.ContactMaterial(ballMat, tableMat, { friction: 0.225, restitution: 0.7 }));
        world.addContactMaterial(new CANNON.ContactMaterial(ballMat, ballMat, { friction: 0.1, restitution: 0.9 }));

        // Add balls with correct mass and DAMPING (MATCH Ball.js)
        const balls = play.positions.map((pos, i) => {
            const b = new CANNON.Body({ 
                mass: 0.21, 
                shape: new CANNON.Sphere(0.03075),
                material: ballMat,
                linearDamping: 0.15, // Match new tournament damping
                angularDamping: 0.2
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
        const impulseMag = Math.pow(play.shot.power, 2) * 0.10; // Reducido a 0.10
        const impulse = new CANNON.Vec3(Math.sin(angle) * impulseMag, 0, Math.cos(angle) * impulseMag);
        
        // Apply impulse at world center (no spin for stability in test)
        balls[0].applyImpulse(impulse, balls[0].position);

        let hitFirst = false;
        let hitSecond = false;
        let cushionCount = 0;

        balls[0].addEventListener('collide', (e) => {
            const other = e.body;
            // Identificar si es banda
            if (other.material === cushionMat) {
                cushionCount++;
            }
            // Identificar bolas
            if (other === balls[1]) {
                hitFirst = true;
            }
            if (other === balls[2]) {
                // ÉXITO: Si ya hemos dado a la primera y llevamos 3 bandas
                // O si llevamos 3 bandas ANTES de dar a la segunda (independientemente de la primera)
                if (hitFirst && cushionCount >= 3) hitSecond = true;
                // Nota: En billar 3 bandas, si das a 3 bandas ANTES de la primera bola también vale (Bricole)
                if (!hitFirst && cushionCount >= 3) hitRed = true; // En este caso invertimos
            }
        });

        // Simulación extendida (10 segundos para trayectorias largas)
        for (let i = 0; i < 600; i++) {
            world.step(1/60);
            
            // Condición de victoria real de 3 bandas:
            // Caso A: Blanca -> Roja -> 3 Bandas -> Amarilla
            // Caso B: Blanca -> 3 Bandas -> Roja -> Amarilla
            // Simplificado: Haber tocado 3 bandas y AMBAS bolas, siendo la SEGUNDA bola tocada DESPUÉS de las 3 bandas.
            
            // Usamos flags internos del loop de colisión
            if (hitFirst && hitSecond && cushionCount >= 3) return true;
        }

        return false;
    }

    executeShot(shot) {
        const whiteBall = this.balls[0];
        const { power, direction, hitOffset } = shot;
        
        const maxForce = 0.10; // Reducido
        const forceMagnitude = Math.pow(power, 2) * maxForce;
        
        // Ensure strictly horizontal direction
        const dir = direction.clone();
        dir.y = 0;
        dir.normalize();

        const force = dir.multiplyScalar(forceMagnitude);
        const impulse = new CANNON.Vec3(force.x, 0, force.z); // Force Y to 0
        
        // Use current body position for hit point to avoid vertical offsets
        const worldPos = whiteBall.body.position;
        const worldPoint = new CANNON.Vec3(
            worldPos.x + hitOffset.x, 
            worldPos.y, // Strictly at center height
            worldPos.z + hitOffset.z
        );

        if (this.gameLogic) this.gameLogic.startShot();
        
        whiteBall.body.wakeUp();
        whiteBall.body.applyImpulse(impulse, worldPoint);
    }
}
