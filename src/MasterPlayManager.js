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
                aim: "Apuntar a la banda IZQUIERDA, 1.3m desde el fondo.",
                effect: "Efecto DERECHA (12mm)",
                power: "92%",
                positions: [
                    { x: 0.0, y: 0.83075, z: 1.3 }, { x: 0.5, y: 0.83075, z: -0.2 }, { x: 0.4, y: 0.83075, z: -0.4 }
                ],
                shot: { power: 0.92, direction: new THREE.Vector3(-0.55, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.012, 0, 0) }
            },
            {
                name: "2. Alrededor de la Mesa",
                strategy: "Recorrido Natural LKL empezando por roja.",
                aim: "Apuntar a la bola ROJA finamente por la derecha.",
                effect: "Efecto DERECHA ligero (5mm)",
                power: "82%",
                positions: [
                    { x: 0.355, y: 0.83075, z: 1.0 }, { x: 0.55, y: 0.83075, z: -0.2 }, { x: -0.5, y: 0.83075, z: 0.8 }
                ],
                shot: { power: 0.82, direction: new THREE.Vector3(0.25, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.005, 0, 0) }
            },
            {
                name: "3. Renverse Zig-Zag",
                strategy: "Zig-Zag Corta-Larga-Corta en forma de 'N'.",
                aim: "Apuntar a la banda inferior a 0.4m del rincón.",
                effect: "Efecto IZQUIERDA fuerte (15mm)",
                power: "88%",
                positions: [
                    { x: -0.4, y: 0.83075, z: 1.2 }, { x: 0.3, y: 0.83075, z: 1.0 }, { x: 0.5, y: 0.83075, z: -1.0 }
                ],
                shot: { power: 0.88, direction: new THREE.Vector3(0.75, 0, -1).normalize(), hitOffset: new THREE.Vector3(-0.015, 0, 0) }
            },
            {
                name: "4. Tick-Tack Doble Corta",
                strategy: "Doble banda corta seguida en el cabezal.",
                aim: "Apuntar a la banda superior a la izquierda.",
                effect: "Efecto DERECHA (10mm)",
                power: "72%",
                positions: [
                    { x: 0.0, y: 0.83075, z: -1.0 }, { x: -0.3, y: 0.83075, z: -1.3 }, { x: 0.3, y: 0.83075, z: -1.3 }
                ],
                shot: { power: 0.72, direction: new THREE.Vector3(-0.45, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.01, 0, 0) }
            },
            {
                name: "5. Cajón de 3 Bandas",
                strategy: "Cajón LKL cerrado técnica de rincón.",
                aim: "Apuntar bola ROJA directamente a la banda larga.",
                effect: "Efecto DERECHA (8mm)",
                power: "78%",
                positions: [
                    { x: -0.5, y: 0.83075, z: 1.1 }, { x: -0.6, y: 0.83075, z: 0.2 }, { x: -0.4, y: 0.83075, z: 0.0 }
                ],
                shot: { power: 0.78, direction: new THREE.Vector3(0.12, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.008, 0, 0) }
            },
            {
                name: "6. Pase de Banda Reverso",
                strategy: "Inversión de trayectoria tras banda larga.",
                aim: "Apuntar banda derecha con efecto contrario.",
                effect: "Efecto IZQUIERDA fuerte (12mm)",
                power: "85%",
                positions: [
                    { x: 0.5, y: 0.83075, z: 0.5 }, { x: 0.55, y: 0.83075, z: -0.8 }, { x: -0.2, y: 0.83075, z: -0.5 }
                ],
                shot: { power: 0.85, direction: new THREE.Vector3(0.08, 0, -1).normalize(), hitOffset: new THREE.Vector3(-0.012, 0, 0) }
            },
            {
                name: "7. Cruce Diagonal",
                strategy: "Tres diagonales consecutivas entre bandas largas.",
                aim: "Apuntar bola ROJA al centro de la mesa.",
                effect: "Efecto DERECHA suave (5mm)",
                power: "95%",
                positions: [
                    { x: -0.6, y: 0.83075, z: 1.3 }, { x: -0.4, y: 0.83075, z: 0.8 }, { x: 0.6, y: 0.83075, z: -1.2 }
                ],
                shot: { power: 0.95, direction: new THREE.Vector3(0.45, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.005, 0, 0) }
            },
            {
                name: "8. Retro-Banda Corta",
                strategy: "Uso de retroceso (Draw) hacia banda corta.",
                aim: "Apuntar centro de bola ROJA abajo (Retro).",
                effect: "Retroceso fuerte abajo (15mm)",
                power: "90%",
                positions: [
                    { x: 0.0, y: 0.83075, z: 0.0 }, { x: 0.0, y: 0.83075, z: -0.8 }, { x: -0.5, y: 0.83075, z: 0.5 }
                ],
                shot: { power: 0.9, direction: new THREE.Vector3(0.02, 0, -1).normalize(), hitOffset: new THREE.Vector3(0, -0.015, 0) }
            },
            {
                name: "9. Doble el Raíl",
                strategy: "Rebote en la misma banda larga dos veces.",
                aim: "Apuntar paralelo a la banda larga derecha.",
                effect: "Efecto DERECHA (12mm)",
                power: "75%",
                positions: [
                    { x: 0.6, y: 0.83075, z: 1.0 }, { x: 0.55, y: 0.83075, z: 0.5 }, { x: 0.6, y: 0.83075, z: -1.0 }
                ],
                shot: { power: 0.75, direction: new THREE.Vector3(0.1, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.012, 0, 0) }
            },
            {
                name: "10. La Omega 5 Bandas",
                strategy: "Recorrido completo por todo el perímetro.",
                aim: "Apuntar bola ROJA muy finamente al rincón.",
                effect: "Efecto DERECHA máximo (15mm)",
                power: "98%",
                positions: [
                    { x: 0.0, y: 0.83075, z: 1.3 }, { x: 0.6, y: 0.83075, z: 0.8 }, { x: -0.3, y: 0.83075, z: 1.2 }
                ],
                shot: { power: 0.98, direction: new THREE.Vector3(0.75, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.015, 0, 0) }
            },
            {
                name: "11. Bricole Corta Inicial",
                strategy: "Banda corta antes de las largas para ganar ángulo.",
                aim: "Apuntar banda inferior (abajo a la dcha).",
                effect: "Efecto IZQUIERDA fuerte (10mm)",
                power: "88%",
                positions: [
                    { x: 0.2, y: 0.83075, z: 1.3 }, { x: -0.5, y: 0.83075, z: -0.5 }, { x: 0.0, y: 0.83075, z: -1.0 }
                ],
                shot: { power: 0.88, direction: new THREE.Vector3(-0.35, 0, 1).normalize(), hitOffset: new THREE.Vector3(-0.01, 0, 0) }
            },
            {
                name: "12. Ángulo Fino Diamante",
                strategy: "Tiro técnico de precisión en el sistema Diamond.",
                aim: "Apuntar al borde exterior de la bola ROJA.",
                effect: "Efecto DERECHA suave (5mm)",
                power: "85%",
                positions: [
                    { x: -0.2, y: 0.83075, z: 1.2 }, { x: -0.6, y: 0.83075, z: 1.25 }, { x: 0.5, y: 0.83075, z: -0.8 }
                ],
                shot: { power: 0.85, direction: new THREE.Vector3(-1, 0, 0.05).normalize(), hitOffset: new THREE.Vector3(0.005, 0, 0) }
            },
            {
                name: "13. El Siete (Zig Zag)",
                strategy: "Recorrido en forma de 7 para bolas separadas.",
                aim: "Apuntar banda izquierda superior.",
                effect: "Efecto IZQUIERDA máximo (15mm)",
                power: "88%",
                positions: [
                    { x: 0.5, y: 0.83075, z: 1.3 }, { x: 0.4, y: 0.83075, z: 0.8 }, { x: 0.6, y: 0.83075, z: -0.5 }
                ],
                shot: { power: 0.88, direction: new THREE.Vector3(-0.15, 0, -1).normalize(), hitOffset: new THREE.Vector3(-0.015, 0, 0) }
            },
            {
                name: "14. Doble Inversión",
                strategy: "Giro invertido tras choque inicial para cerrar ángulo.",
                aim: "Apuntar banda inferior izquierda.",
                effect: "Efecto DERECHA fuerte (12mm)",
                power: "85%",
                positions: [
                    { x: -0.5, y: 0.83075, z: 0.0 }, { x: -0.55, y: 0.83075, z: 0.8 }, { x: 0.3, y: 0.83075, z: 0.0 }
                ],
                shot: { power: 0.85, direction: new THREE.Vector3(0.04, 0, 1).normalize(), hitOffset: new THREE.Vector3(0.012, 0, 0) }
            },
            {
                name: "15. La Serpiente (5 Bandas)",
                strategy: "Culebrilla por las bandas largas.",
                aim: "Apuntar a la bola ROJA medio-llena.",
                effect: "Efecto DERECHA máximo (15mm)",
                power: "100%",
                positions: [
                    { x: 0.6, y: 0.83075, z: 1.4 }, { x: 0.55, y: 0.83075, z: 0.7 }, { x: -0.1, y: 0.83075, z: 1.3 }
                ],
                shot: { power: 1.0, direction: new THREE.Vector3(-0.05, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.015, 0, 0) }
            },
            {
                name: "16. Cajón Reverso Cerrado",
                strategy: "Cajón corto desde el fondo de la mesa.",
                aim: "Apuntar banda superior derecha.",
                effect: "Efecto IZQUIERDA fuerte (10mm)",
                power: "88%",
                positions: [
                    { x: 0.0, y: 0.83075, z: -1.0 }, { x: 0.5, y: 0.83075, z: -1.2 }, { x: -0.4, y: 0.83075, z: -0.5 }
                ],
                shot: { power: 0.88, direction: new THREE.Vector3(1, 0, -0.25).normalize(), hitOffset: new THREE.Vector3(-0.01, 0, 0) }
            },
            {
                name: "17. Cruce Largo LKL",
                strategy: "Cruce central de banda larga a banda larga.",
                aim: "Apuntar bola ROJA suavemente al lateral.",
                effect: "Efecto DERECHA suave (5mm)",
                power: "88%",
                positions: [
                    { x: -0.6, y: 0.83075, z: 0.0 }, { x: -0.55, y: 0.83075, z: -0.8 }, { x: 0.4, y: 0.83075, z: 1.2 }
                ],
                shot: { power: 0.88, direction: new THREE.Vector3(0.08, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.005, 0, 0) }
            },
            {
                name: "18. Diamante 50 (Sistema)",
                strategy: "Tiro clásico por diamantes para ganar el rincón.",
                aim: "Apuntar al diamante 5 (banda larga derecha).",
                effect: "Efecto DERECHA fuerte (12mm)",
                power: "95%",
                positions: [
                    { x: 0.0, y: 0.83075, z: 1.42 }, { x: 0.5, y: 0.83075, z: 0.0 }, { x: -0.6, y: 0.83075, z: 0.1 }
                ],
                shot: { power: 0.95, direction: new THREE.Vector3(0.65, 0, -1).normalize(), hitOffset: new THREE.Vector3(0.012, 0, 0) }
            },
            {
                name: "19. El Avión (Vuelo Largo)",
                strategy: "Triple diagonal cruzada entre bandas extremas.",
                aim: "Apuntar bola ROJA finamente arriba.",
                effect: "Efecto DERECHA máximo (15mm)",
                power: "95%",
                positions: [
                    { x: -0.4, y: 0.83075, z: 1.2 }, { x: 0.4, y: 0.83075, z: 1.3 }, { x: -0.2, y: 0.83075, z: -1.3 }
                ],
                shot: { power: 0.95, direction: new THREE.Vector3(1, 0, 0.05).normalize(), hitOffset: new THREE.Vector3(0.015, 0, 0) }
            },
            {
                name: "20. Gran Maestro Pincelada",
                strategy: "Toque ultra-fino para recorrer toda la mesa suavemente.",
                aim: "Apuntar al borde de la bola AMARILLA.",
                effect: "Efecto IZQUIERDA máximo (18mm)",
                power: "95%",
                positions: [
                    { x: 0.6, y: 0.83075, z: -1.2 }, { x: 0.65, y: 0.83075, z: 1.2 }, { x: -0.5, y: 0.83075, z: -1.0 }
                ],
                shot: { power: 0.95, direction: new THREE.Vector3(-0.02, 0, 1).normalize(), hitOffset: new THREE.Vector3(-0.018, 0, 0) }
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
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            linewidth: 3 // Note: linewidth 1 on most browsers for LineBasicMaterial
        });
        const geometry = new THREE.BufferGeometry();
        this.trajectoryLine = new THREE.Line(geometry, material);
        this.trajectoryLine.visible = false;
        this.trajectoryLine.renderOrder = 2000; // Above table
        this.scene.add(this.trajectoryLine);
    }

    updateTrajectoryLine(direction) {
        const whiteBall = this.balls[0];
        if (!whiteBall) return;
        
        const start = whiteBall.mesh.position.clone();
        // Place slightly above table for visibility
        start.y = 0.835; 
        
        const end = start.clone().add(direction.clone().multiplyScalar(1.2)); // 1.2m line
        
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        this.trajectoryLine.geometry.dispose();
        this.trajectoryLine.geometry = geometry;
        this.trajectoryLine.visible = true;
    }

    showNextPlay() {
        // CANCEL any pending or ongoing simulation
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        if (this.shotTimeout) clearTimeout(this.shotTimeout);
        if (this.safetyTimeout) clearTimeout(this.safetyTimeout);
        
        this.isSimulating = false;
        
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

        // MOSTRAR ESTRATEGIA DETALLADA
        if (this.xrHandler) {
            const strategyInfo = `${play.name}\nESTRATEGIA: ${play.strategy}\nAPUNTAR: ${play.aim}\nEFECTO: ${play.effect}\nFUERZA: ${play.power}`.trim();
            this.xrHandler.showHUDMessage(strategyInfo, 5000);
            
            // BUSCAR ÁNGULO INMEDIATAMENTE PARA MOSTRAR LÍNEA
            const optimizedShot = this.findOptimizedShot(play);
            this.lastOptimizedShot = optimizedShot;
            
            // VISTA DESDE ARRIBA
            this.xrHandler.switchToTopDownView();
            this.updateTrajectoryLine(optimizedShot.direction);
        }

        // ESPERAR A QUE EL USUARIO LEA Y LUEGO CALCULAR/EJECUTAR
        this.shotTimeout = setTimeout(() => {
            // RESTAURAR VISTA Y OCULTAR LÍNEA
            if (this.xrHandler) {
                this.xrHandler.restoreView();
            }
            this.trajectoryLine.visible = false;
            
            this.isSimulating = true;
            this.executeShot(this.lastOptimizedShot);
            this.startLogging();
            this.monitorShotAndReleaseLock();
        }, 5000); 

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

            // If balls are essentially still for a few checks
            if (totalVelocity < 0.01) {
                quietFrames++;
            } else {
                quietFrames = 0;
            }

            if (quietFrames > 3) { // 0.6 seconds of stillness
                clearInterval(this.monitorInterval);
                this.isSimulating = false;
                this.stopLogging();
                console.log("MAESTRO: Movimiento cesado. Listo para nueva jugada.");
            }
        }, 200);

        // Safety timeout (10 seconds)
        this.safetyTimeout = setTimeout(() => {
            if (this.isSimulating) {
                clearInterval(this.monitorInterval);
                this.isSimulating = false;
                this.stopLogging();
                console.log("MAESTRO: Seguridad activada. Bloqueo liberado por tiempo.");
            }
        }, 10000);
    }

    findOptimizedShot(play) {
        let bestAngle = 0;
        const baseDir = play.shot.direction;
        const baseAngle = Math.atan2(baseDir.x, baseDir.z);
        
        const totalRange = 1.05; // 60 deg total
        
        // Búsqueda exhaustiva (120 pasos) para máxima precisión
        // Ahora que el sistema es interrumpible, no importa si tarda 1-2 segundos.
        const steps = 120;
        let found = false;

        if (this.xrHandler) this.xrHandler.showHUDMessage("Maestro calculando trayectoria perfecta...", 1000);

        for (let i = 0; i < steps; i++) {
            const offset = (i / steps - 0.5) * totalRange;
            const angle = baseAngle + offset;
            if (this.testShot(play, angle)) {
                bestAngle = angle;
                found = true;
                const offsetDeg = (offset * 180 / Math.PI).toFixed(1);
                console.log(`MAESTRO: ¡Trayectoria encontrada! Corrección: ${offsetDeg}º`);
                break; // Usamos el primero que funcione para velocidad
            }
        }

        if (found) {
            return {
                ...play.shot,
                direction: new THREE.Vector3(Math.sin(bestAngle), 0, Math.cos(bestAngle))
            };
        }
        
        console.warn("MAESTRO: No se encontró trayectoria perfecta, usando base.");
        return { ...play.shot, direction: baseDir.clone() };
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
        
        // AGREGAR SUELO (IMPORTANTE: Faltaba en el test anterior)
        const bedShape = new CANNON.Box(new CANNON.Vec3(tw / 2, 0.025, tl / 2));
        const bedBody = new CANNON.Body({ mass: 0, material: tableMat });
        bedBody.addShape(bedShape);
        bedBody.position.set(0, 0.8, 0);
        world.addBody(bedBody);

        addCushion(cushionThickness, tl, -tw / 2 - cushionThickness / 2, 0); // L
        addCushion(cushionThickness, tl, tw / 2 + cushionThickness / 2, 0);  // R
        addCushion(tw, cushionThickness, 0, -tl / 2 - cushionThickness / 2); // T
        addCushion(tw, cushionThickness, 0, tl / 2 + cushionThickness / 2);  // B

        // Execute shot
        const impulseMag = Math.pow(play.shot.power, 2) * 0.10; 
        const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).normalize();
        const impulse = new CANNON.Vec3(dir.x * impulseMag, 0, dir.z * impulseMag);
        
        // APLICAR SPIN EN TEST
        const worldPos = balls[0].position;
        const hitOffset = play.shot.hitOffset;
        
        // Vector lateral (right) y vertical (up) relativo a la dirección del tiro
        const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        
        const offsetWorld = right.clone().multiplyScalar(hitOffset.x)
                             .add(up.clone().multiplyScalar(hitOffset.y));

        const worldPoint = new CANNON.Vec3(
            worldPos.x + offsetWorld.x, 
            worldPos.y + offsetWorld.y,
            worldPos.z + offsetWorld.z
        );

        balls[0].applyImpulse(impulse, worldPoint);

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
                if (!hitFirst && cushionCount >= 3) hitFirst = true; // Fix typo: hitRed -> hitFirst
            }
        });

        // Simulación completa (10 segundos)
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

        const force = dir.clone().multiplyScalar(forceMagnitude);
        const impulse = new CANNON.Vec3(force.x, 0, force.z); 
        
        // APLICAR SPIN: El punto de impacto NO es el centro si hitOffset != 0
        const worldPos = whiteBall.body.position;
        // hitOffset.x = lado, hitOffset.y = altura (retro/corrida)
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
