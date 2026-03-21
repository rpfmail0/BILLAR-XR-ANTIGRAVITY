import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import * as CANNON from 'cannon-es';

export class XRHandler {
    constructor(renderer, scene, xrRig, camera, cue, balls, gameLogic, soundManager, table, masterPlayManager) {
        this.renderer = renderer;
        this.scene = scene;
        this.xrRig = xrRig;
        this.camera = camera;
        this.cue = cue;
        this.balls = balls;
        this.gameLogic = gameLogic;
        this.soundManager = soundManager;
        this.table = table;
        this.masterPlayManager = masterPlayManager;
        this.hudMessage = "";
        this.hudMessageTimeout = null;
        this.controller1 = null;
        this.controller2 = null;
        this.controllerGrip1 = null;
        this.controllerGrip2 = null;

        this.previousTipPosition = new THREE.Vector3();
        this.currentTipPosition = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        
        // Charging state for button-based shooting
        this.isCharging = false;
        this.chargePower = 0;
        this.chargeDirection = 1;
        this.chargeSpeed = 0.8; // Reduced from 1.0 to allow more precision in delicate shots

        // Locomotion state
        this.snapTurnReady = true;

        // VR Grabbing Context
        this.grabbedBalls = new Map(); // maps controller to ball
        
        // Teleport cooldown to prevent multiple triggers
        this.lastTeleportTime = 0;
        this.teleportCooldown = 0.5; // 500ms

        // Undo states
        this.preShotState = null;
        this.lastUndoTime = 0;
        this.undoCooldown = 0.5;

        // Passthrough state
        this.passthroughEnabled = false;
        this.lastPassthroughTime = 0;
        this.originalBackground = this.scene.background;
        this.originalEnvironment = this.scene.environment;

        // View states for Maestro Strategy
        this.isTopDown = false;
        this.originalRigPos = new THREE.Vector3();
        this.originalRigQuat = new THREE.Quaternion();

        // AR Height Calibration
        this.heightCalibrated = false;
        this.calibrationStartTime = 0; // Will be set when session starts
        this.calibrationDelay = 2.0;   // Wait 2 seconds for stable tracking

        // HUD State Tracking
        this.lastStreak = -1;
        this.lastCushionContacts = -1;
        this.lastShotActive = false;
        this.currentMasterPath = null;
        this.currentMasterBalls = null; // To draw ball positions on schematic

        this.init();
    }

    init() {
        // Controllers
        this.controller1 = this.renderer.xr.getController(0);
        this.xrRig.add(this.controller1);

        this.controller2 = this.renderer.xr.getController(1);
        this.xrRig.add(this.controller2);

        const controllerModelFactory = new XRControllerModelFactory();

        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        this.controllerGrip1.add(controllerModelFactory.createControllerModel(this.controllerGrip1));
        this.xrRig.add(this.controllerGrip1);

        this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
        this.controllerGrip2.add(controllerModelFactory.createControllerModel(this.controllerGrip2));
        this.xrRig.add(this.controllerGrip2);

        // Event listeners for Trigger (Select)
        this.controller1.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller1.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.controller2.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller2.addEventListener('selectend', this.onSelectEnd.bind(this));

        // Event listeners for Grip (Squeeze)
        this.controller1.addEventListener('squeezestart', this.onSqueezeStart.bind(this));
        this.controller1.addEventListener('squeezeend', this.onSqueezeEnd.bind(this));
        this.controller2.addEventListener('squeezestart', this.onSqueezeStart.bind(this));
        this.controller2.addEventListener('squeezeend', this.onSqueezeEnd.bind(this));
        
        // HUD - Power Bar
        this.powerBarGroup = new THREE.Group();
        this.powerBarGroup.position.set(0, -0.2, -1); // Slightly down, 1m away from camera
        this.camera.add(this.powerBarGroup);

        const bgGeo = new THREE.PlaneGeometry(0.5, 0.02);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x444444, depthTest: false, transparent: true, opacity: 0.5 });
        const bgMesh = new THREE.Mesh(bgGeo, bgMat);
        bgMesh.renderOrder = 999;
        this.powerBarGroup.add(bgMesh);

        const fgGeo = new THREE.PlaneGeometry(0.5, 0.02);
        fgGeo.translate(0.25, 0, 0); // Pivot at left
        const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
        this.powerBarMesh = new THREE.Mesh(fgGeo, fgMat);
        this.powerBarMesh.position.x = -0.25;
        this.powerBarMesh.scale.x = 0.001;
        this.powerBarMesh.renderOrder = 1000;
        this.powerBarGroup.add(this.powerBarMesh);

        this.powerBarGroup.visible = false;

        // Aim Helper: Red Dot
        const dotGeo = new THREE.SphereGeometry(0.003, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false }); // Always visible over ball
        this.aimDot = new THREE.Mesh(dotGeo, dotMat);
        this.aimDot.renderOrder = 999; // Render on top
        this.scene.add(this.aimDot);
        this.aimDot.visible = false;

        // VR HUD
        this.createVRHUD();
    }

    createVRHUD() {
        // 1. Permanent Score/Controls HUD (Top-Left)
        this.hudCanvas = document.createElement('canvas');
        this.hudCanvas.width = 512;
        this.hudCanvas.height = 410; // Increased from 256 to fit all control lines
        this.hudContext = this.hudCanvas.getContext('2d');
        this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
        
        const hudMaterial = new THREE.MeshBasicMaterial({ 
            map: this.hudTexture, transparent: true, opacity: 0.9, depthTest: false 
        });
        // Reduced geometry for a more compact HUD (approx 25% smaller)
        this.hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.2), hudMaterial); 
        // Positioned at the extreme lower right periphery as requested
        this.hudMesh.position.set(0.35, -0.35, -0.6); 
        this.hudMesh.renderOrder = 1001;
        this.camera.add(this.hudMesh);

        // 2. Temporary Announcement HUD (Center) - Larger for schematic
        this.annCanvas = document.createElement('canvas');
        this.annCanvas.width = 512;
        this.annCanvas.height = 768; // Increased height
        this.annContext = this.annCanvas.getContext('2d');
        this.annTexture = new THREE.CanvasTexture(this.annCanvas);
        
        const annMaterial = new THREE.MeshBasicMaterial({ 
            map: this.annTexture, transparent: true, opacity: 1.0, depthTest: false 
        });
        // 0.5m wide x 0.75m high
        this.annMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), annMaterial);
        this.annMesh.position.set(0, -0.05, -0.7); // LOWERED AND SLIGHTLY FURTHER
        this.annMesh.renderOrder = 1002;
        this.annMesh.visible = false; // Hidden by default
        this.camera.add(this.annMesh);

        this.lastHUDStreak = -1;
        this.updateHUDContent();
    }

    drawButtonLegend(ctx, label, color, text, y) {
        ctx.beginPath();
        if (label === 'LT' || label === 'RT' || label === 'GRIP') {
            ctx.roundRect(20, y-25, label === 'GRIP' ? 55 : 45, 25, 5);
        } else {
            ctx.arc(45, y-10, 15, 0, Math.PI*2);
        }
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(label, label === 'GRIP' ? 22 : (label.length > 1 ? 28 : 38), y-10);
        ctx.font = '18px Arial';
        ctx.fillText(` ${text}`, 75, y-5);
    }

    updateHUDContent() {
        if (!this.hudCanvas) return;
        const ctx = this.hudContext;
        const yOffset = 40;
        let y = yOffset;

        // Clear with transparent background for AR
        ctx.clearRect(0, 0, 512, 410);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black for readability in AR
        ctx.roundRect(0, 0, 512, 410, 20);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        
        // Carambola Stats - Smaller font
        const currentStreak = this.gameLogic ? this.gameLogic.streak : 0;
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#00ffff';
        ctx.fillText(`CARAMBOLAS: ${currentStreak}`, 20, y);
        y += 40;

        // Live Cushion Counter during shot
        if (this.gameLogic && this.gameLogic.shotActive) {
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = this.gameLogic.cushionContacts >= 3 ? '#00ff00' : '#ffcc00';
            ctx.fillText(`BANDAS: ${this.gameLogic.cushionContacts}`, 300, y - 40);
        }

        // Title - Smaller font
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('BILLAR AR', 20, y);
        y += 35;

        ctx.font = '18px Arial';
        
        // A Button - Aim Yellow
        this.drawButtonLegend(ctx, 'A', '#F4B400', 'APUNTAR AMARILLA', y);
        y += 40;

        // B Button - Aim Red
        this.drawButtonLegend(ctx, 'B', '#DB4437', 'APUNTAR ROJA', y);
        y += 40;

        // X Button - Master Play
        this.drawButtonLegend(ctx, 'X', '#F4B400', 'JUGADA MAESTRA', y);
        y += 40;

        // Y Button - Calibrate Height
        this.drawButtonLegend(ctx, 'Y', '#0F9D58', 'RE-CALIBRAR ALTURA', y);
        y += 40;

        // Trigger L - Undo
        this.drawButtonLegend(ctx, 'LT', '#CC0000', 'UNDO (Deshacer)', y);
        y += 40;

        // Trigger R - Charge/Shoot
        this.drawButtonLegend(ctx, 'RT', '#009900', 'CARGAR / TIRAR', y);
        y += 40;

        // Grip - Pick balls
        this.drawButtonLegend(ctx, 'GRIP', '#666666', 'COGER BOLAS / TACO', y);

        this.hudTexture.needsUpdate = true;
    }

    drawTableSchematic(ctx, x, y, width, height) {
        // Table Bed
        ctx.strokeStyle = '#004400';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = 'rgba(0, 50, 0, 0.3)';
        ctx.fillRect(x, y, width, height);

        const tw = 1.42;
        const tl = 2.84;
        const scaleX = width / tw;
        const scaleZ = height / tl;
        const offX = x + width / 2;
        const offZ = y + height / 2;

        // Draw Path
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        this.currentMasterPath.forEach((p, i) => {
            const px = offX + p.x * scaleX;
            const pz = offZ + p.z * scaleZ;
            if (i === 0) ctx.moveTo(px, pz);
            else ctx.lineTo(px, pz);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Balls
        if (this.currentMasterBalls) {
            const colors = ['white', '#F4B400', '#DB4437'];
            this.currentMasterBalls.forEach((b, i) => {
                ctx.fillStyle = colors[i];
                ctx.beginPath();
                ctx.arc(offX + b.x * scaleX, offZ + b.z * scaleZ, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        }
    }

    alignWithShot(whitePos, direction) {
        if (!this.xrRig) return;
        
        // Position 1.1 meters behind the white ball in the opposite direction of the shot
        const viewDir = direction.clone().normalize();
        const offset = viewDir.clone().multiplyScalar(-1.1);
        
        // Move RIG to floor level (keeping calibrated height offset)
        // Note: the rig's Y remains where it was (calibrated), we only move X and Z
        this.xrRig.position.x = whitePos.x + offset.x;
        this.xrRig.position.z = whitePos.z + offset.z;
        
        // Rotate RIG to look at white ball + shot direction
        // We look at the white ball as a reference
        const target = new THREE.Vector3(whitePos.x, this.xrRig.position.y, whitePos.z);
        this.xrRig.lookAt(target);
        
        // Since lookAt often puts the BACK of the object facing the target in some setups
        // check and correct if necessary. Standard Three.js lookAt points -Z.
        // If the table appears behind, we might need a 180 flip.
    }

    togglePassthrough() {
        // Manual Recalibration of Height
        this.heightCalibrated = false; 
        this.calibrationStartTime = -1; // Special flag for instant recalibration
        this.updateAnnouncementHUD("RECIBRANDO ALTURA...\nMantén la cabeza estable");
    }

    onSelectStart(event) {
        // Detect hand more reliably
        const controller = event.target;
        const session = this.renderer.xr.getSession();
        let handedness = 'unknown';

        if (session) {
            for (let i = 0; i < session.inputSources.length; i++) {
                if (this.renderer.xr.getController(i) === controller) {
                    handedness = session.inputSources[i].handedness;
                    break;
                }
            }
        }

        if (handedness === 'left') {
            // SWAP: Trigger L now does UNDO
            const now = performance.now() / 1000;
            if (this.preShotState && (now - this.lastUndoTime > this.undoCooldown)) {
                this.restorePreShotState();
                this.lastUndoTime = now;
                if (event.target.gamepad && event.target.gamepad.hapticActuators) {
                    event.target.gamepad.hapticActuators[0].pulse(0.5, 100);
                }
            }
            return;
        }

        // Only proceed to charging if it's the RIGHT hand (or unknown/single hand)
        if (handedness === 'left') return;

        if (this.soundManager) {
            this.soundManager.init();
        }

        this.isCharging = true;
        this.chargePower = 0;
        this.chargeDirection = 1;
        this.powerBarGroup.visible = true;
        
        if (event.target.gamepad && event.target.gamepad.hapticActuators) {
            event.target.gamepad.hapticActuators[0].pulse(0.5, 50);
        }
    }

    onSelectEnd(event) {
        if (!this.isCharging) return;
        
        // Ensure it's the right controller that is ending the selection
        const session = this.renderer.xr.getSession();
        if (session) {
            for (let i = 0; i < session.inputSources.length; i++) {
                if (this.renderer.xr.getController(i) === event.target) {
                    if (session.inputSources[i].handedness !== 'right') return;
                    break;
                }
            }
        }

        this.isCharging = false;
        this.powerBarGroup.visible = false;
        
        // Safety check for shooting power
        const finalPower = Number.isFinite(this.chargePower) ? this.chargePower : 0;
        this.shootBall(finalPower);
        this.chargePower = 0;
        
        if (event.target.gamepad && event.target.gamepad.hapticActuators) {
            event.target.gamepad.hapticActuators[0].pulse(1.0, 100);
        }
    }

    onSqueezeStart(event) {
        const controller = event.target;
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        controller.getWorldPosition(pos);
        controller.getWorldQuaternion(quat);
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
        
        const raycaster = new THREE.Raycaster(pos, forward);
        const ballMeshes = this.balls.map(b => b.mesh);
        // Can grab balls up to 1 meter away with the grip pointer
        const intersects = raycaster.intersectObjects(ballMeshes).filter(h => h.distance < 1.0);
        
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const targetBall = this.balls.find(b => b.mesh === hitMesh);
            
            if (targetBall) {
                // Prevent ball clipping through table by making it kinematic during holding
                targetBall.body.type = CANNON.Body.KINEMATIC;
                targetBall.body.updateMassProperties();
                this.grabbedBalls.set(controller, targetBall);
                
                if (controller.gamepad && controller.gamepad.hapticActuators) {
                    controller.gamepad.hapticActuators[0].pulse(0.6, 50);
                }
            }
        }
    }

    onSqueezeEnd(event) {
        const controller = event.target;
        if (this.grabbedBalls.has(controller)) {
            const ball = this.grabbedBalls.get(controller);
            
            // Release ball back to gravity
            ball.body.type = CANNON.Body.DYNAMIC;
            ball.body.mass = 0.21;
            ball.body.updateMassProperties();
            ball.body.velocity.set(0, 0, 0);
            ball.body.angularVelocity.set(0, 0, 0);
            ball.body.wakeUp();
            
            this.grabbedBalls.delete(controller);
        }
    }

    update(dt) {
        const now = performance.now() / 1000;
        // Find left and right controllers
        const session = this.renderer.xr.getSession();
        
        // Redraw HUD if streak changed
        if (this.gameLogic && this.gameLogic.streak !== this.lastHUDStreak) {
            this.lastHUDStreak = this.gameLogic.streak;
            this.updateHUDContent();
        }

        // Height Calibration for AR (once per session, after delay or on manual trigger)
        if (session) {
            if (this.calibrationStartTime === 0) {
                this.calibrationStartTime = now;
            }
            
            // Trigger if delay passed OR if manual flag -1 is set
            if (!this.heightCalibrated && (this.calibrationStartTime === -1 || (now - this.calibrationStartTime > this.calibrationDelay))) {
                // Remove the restrictive > 0.1 check to support all reference spaces
                // Target: camera.worldY = 1.4m (relative to standard table surface at 0.8m)
                // This gives a 60cm offset as requested.
                const targetRigY = 1.4 - this.camera.position.y;
                this.xrRig.position.y = targetRigY;
                this.heightCalibrated = true;
                
                // Reset start time to standard now so we don't loop
                if (this.calibrationStartTime === -1) this.calibrationStartTime = now;
                
                this.updateAnnouncementHUD("ALTURA CALIBRADA\n60cm bajo tus ojos");
                
                // Clear message after 2 seconds
                if (this.calibrateTimeout) clearTimeout(this.calibrateTimeout);
                this.calibrateTimeout = setTimeout(() => {
                    if (this.annMesh) this.annMesh.visible = false;
                    this.calibrateTimeout = null;
                }, 2000);
                
                console.log("AR Height Calibrated. Camera Local Y:", this.camera.position.y, "Rig Y:", targetRigY);
            }
        }

        // Always force transparency in AR mode
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setClearAlpha(0);
        if (this.scene.background !== null) this.scene.background = null;
        if (this.scene.environment !== null) this.scene.environment = null;

        let rightCtrl = null;
        let leftCtrl = null;

        // Handle VR Locomotion (Thumbsticks) and hand mapping
        if (session && this.xrRig && this.camera) {
            for (let i = 0; i < session.inputSources.length; i++) {
                const source = session.inputSources[i];
                if (source.handedness === 'right') {
                    rightCtrl = this.renderer.xr.getController(i);
                } else if (source.handedness === 'left') {
                    leftCtrl = this.renderer.xr.getController(i);
                }

                if (!source.gamepad) continue;
                
                const axes = source.gamepad.axes;
                const whiteBall = this.balls ? this.balls[0] : null;
                const whiteBallPos = whiteBall ? whiteBall.mesh.position.clone() : new THREE.Vector3(0, 0, 0);
                whiteBallPos.y = 0; // Only use XZ plane

                // Standard VR gamepads axes: [0, 1] touchpad/thumbstick 1, [2, 3] touchpad/thumbstick 2.
                if (axes.length >= 4) {
                    const deadzone = 0.2; // Increased deadzone to prevent drift
                    const moveX = Math.abs(axes[2]) > deadzone ? axes[2] : 0;
                    const moveY = Math.abs(axes[3]) > deadzone ? axes[3] : 0;

                    // Left controller: Movement relative to White Ball
                    if (source.handedness === 'left' && whiteBall) {
                        const speed = 2.0 * dt;
                        
                        // Vector from rig to white ball (XZ only)
                        const rigPos = this.xrRig.position.clone();
                        rigPos.y = 0;
                        
                        const toBall = new THREE.Vector3().subVectors(whiteBallPos, rigPos);
                        const distanceToBall = toBall.length();
                        
                        // Default forward is camera if too close to ball, else use ball direction
                        let forward;
                        if (distanceToBall > 0.1) {
                            forward = toBall.clone().normalize();
                        } else {
                            forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                            forward.y = 0;
                            forward.normalize();
                        }
                        
                        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

                        // Move forward/back (towards/away from ball)
                        // moveY < 0 is stick forward
                        this.xrRig.position.add(forward.multiplyScalar(-moveY * speed));
                        // Move sideways (strafe)
                        this.xrRig.position.add(right.multiplyScalar(moveX * speed));

                        // Master Play Shortcut (Button X = index 4 on Quest left controller)
                        if (this.masterPlayManager && source.gamepad.buttons[4]?.pressed) {
                            // Check if already simulating to prevent double trigger
                            if (!this.masterPlayManager.isSimulating) {
                                this.masterPlayManager.showNextPlay();
                                if (source.gamepad.hapticActuators) {
                                    source.gamepad.hapticActuators[0].pulse(0.5, 100);
                                }
                            }
                        }

                        // Passthrough Toggle (Button Y = index 5 on Quest left controller)
                        if (now - this.lastPassthroughTime > 0.5) {
                            if (source.gamepad.buttons[5]?.pressed) {
                                this.togglePassthrough();
                                this.lastPassthroughTime = now;
                                if (source.gamepad.hapticActuators) {
                                    source.gamepad.hapticActuators[0].pulse(0.3, 50);
                                }
                            }
                        }

                        // Clamp position to not walk further than 1.5m from the table.
                        // Table dimensions: half-width=0.71, half-length=1.42
                        // Boundaries = dimension + 1.5
                        const maxDistX = 2.21;
                        const maxDistZ = 2.92;
                        this.xrRig.position.x = Math.max(-maxDistX, Math.min(maxDistX, this.xrRig.position.x));
                        this.xrRig.position.z = Math.max(-maxDistZ, Math.min(maxDistZ, this.xrRig.position.z));
                    }

                    // Right controller: Orbit Rotation around White Ball
                    if (source.handedness === 'right' && whiteBall) {
                        if (Math.abs(moveX) < deadzone) {
                            this.snapTurnReady = true;
                        } else if (this.snapTurnReady) {
                            const angle = moveX > 0 ? -Math.PI / 4 : +Math.PI / 4;
                            
                            // Orbit: Move rig around the white ball
                            const rigPos = this.xrRig.position.clone();
                            const offset = new THREE.Vector3().subVectors(rigPos, whiteBallPos);
                            
                            // Rotate offset vector
                            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
                            
                            // Set new rig position
                            this.xrRig.position.addVectors(whiteBallPos, offset);
                            
                            // Also rotate the rig itself to keep orientation consistent
                            this.xrRig.rotation.y += angle;
                            
                            this.snapTurnReady = false;
                        }

                        // Strategic Teleport (A button = index 4, B button = index 5)
                        if (now - this.lastTeleportTime > this.teleportCooldown) {
                            const buttonA = source.gamepad.buttons[4]?.pressed;
                            const buttonB = source.gamepad.buttons[5]?.pressed;

                            if (buttonA || buttonB) {
                                // balls[0] = White, balls[1] = Yellow, balls[2] = Red
                                const whiteBall = this.balls[0];
                                const targetBall = buttonA ? this.balls[1] : this.balls[2];

                                if (whiteBall && targetBall) {
                                    const whitePos = whiteBall.mesh.position.clone();
                                    const targetPos = targetBall.mesh.position.clone();
                                    
                                    // Calculate direction from white ball to target ball
                                    const direction = new THREE.Vector3().subVectors(targetPos, whitePos);
                                    direction.y = 0; // Keep teleport on the floor plane
                                    direction.normalize();

                                    // Move rig 1 meter behind white ball along that line
                                    const teleportPos = whitePos.clone().sub(direction.clone().multiplyScalar(1.0));
                                    teleportPos.y = 0; // Fix rig to floor
                                    // Final position: Preserve current calibrated Y height
                                    this.xrRig.position.x = teleportPos.x;
                                    this.xrRig.position.z = teleportPos.z;
                                    // this.xrRig.position.y stays exactly where it was calibrated
                                    
                                    // Point the rig so the camera looks at the white/target line
                                    // Use current rig height for the target to avoid pitch/tilt
                                    this.xrRig.lookAt(targetPos.x, this.xrRig.position.y, targetPos.z);
                                    // The user reported being facing away, so we rotate 180 degrees
                                    this.xrRig.rotation.y += Math.PI;
                                    
                                    this.lastTeleportTime = now;
                                    
                                    if (source.gamepad.hapticActuators) {
                                        source.gamepad.hapticActuators[0].pulse(0.3, 50);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Attach cue
        let cueUpdated = false;

        // Try two-handed aiming first
        if (rightCtrl && leftCtrl) {
            const rightPos = new THREE.Vector3();
            rightCtrl.getWorldPosition(rightPos);
            
            const leftPos = new THREE.Vector3();
            leftCtrl.getWorldPosition(leftPos);

            // Only aim if distance is reasonable to avoid glitchy rotation
            if (rightPos.distanceTo(leftPos) > 0.05) {
                const dummy = new THREE.Object3D();
                dummy.position.copy(rightPos);
                
                // User repeatedly indicated the cue aiming was inverse.
                // We point the dummy opposite to the left hand relative to the right hand.
                // This means the butt (-Z) points AWAY from the left hand.
                const directionAwayFromLeft = new THREE.Vector3().subVectors(rightPos, leftPos).normalize();
                const targetPos = new THREE.Vector3().copy(rightPos).add(directionAwayFromLeft);
                dummy.lookAt(targetPos);
                
                this.cue.update(rightPos, dummy.quaternion);
                cueUpdated = true;
            }
        }

        // Fallback to primary controller if two hands are not available or too close
        if (!cueUpdated && this.controller1) {
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            this.controller1.getWorldPosition(worldPos);
            this.controller1.getWorldQuaternion(worldQuat);
            this.cue.update(worldPos, worldQuat);
            cueUpdated = true;
        }

        // Reset visuals each frame
        if (this.aimDot) this.aimDot.visible = false;

        if (cueUpdated && this.cue.tip) {
            // Calculate tip position in world space
            this.cue.tip.getWorldPosition(this.currentTipPosition);

            // Find direction the cue is pointing
            const cueForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cue.mesh.quaternion).normalize();

            // Raycast from tip to balls to find intersection
            const raycaster = new THREE.Raycaster(this.currentTipPosition, cueForward);
            const ballMeshes = this.balls.map(b => b.mesh);
            const intersects = raycaster.intersectObjects(ballMeshes);

            if (intersects.length > 0) {
                const intersectPoint = intersects[0].point;
                const hitMesh = intersects[0].object;
                const initialTargetBall = this.balls.find(b => b.mesh === hitMesh);

                // Show the red dot where the cue will hit the ball (always when aiming at a ball)
                this.aimDot.position.copy(intersectPoint);
                this.aimDot.visible = true;
            }
        }

        // Update power bar charging
        if (this.isCharging) {
            this.chargePower += this.chargeDirection * this.chargeSpeed * dt;
            if (this.chargePower >= 1.0) {
                this.chargePower = 1.0;
                this.chargeDirection = -1;
            } else if (this.chargePower <= 0.0) {
                this.chargePower = 0.0;
                this.chargeDirection = 1;
            }
            
            this.powerBarMesh.scale.x = Math.max(0.001, this.chargePower);
            // Change color: green to red
            this.powerBarMesh.material.color.setHSL(0.33 * (1 - this.chargePower), 1.0, 0.5);
        }

        // Out of Bounds Ball Reset Logic
        for (const ball of this.balls) {
            if (ball.body.position.y < -0.5) {
                ball.body.type = CANNON.Body.DYNAMIC;
                ball.body.mass = 0.21;
                ball.body.updateMassProperties();
                
                ball.body.velocity.set(0, 0, 0);
                ball.body.angularVelocity.set(0, 0, 0);
                ball.body.position.copy(ball.startPosition);
                ball.body.quaternion.set(0, 0, 0, 1);
                ball.mesh.position.copy(ball.startPosition);
                ball.body.wakeUp();
            }
        }

        // GRAB LOGIC UPDATE
        for (const [controller, ball] of this.grabbedBalls.entries()) {
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            controller.getWorldPosition(pos);
            controller.getWorldQuaternion(quat);
            
            // Hold the ball exactly 15cm down the controller's forward line (-Z)
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
            pos.add(forward.multiplyScalar(0.15));
            
            ball.body.position.copy(pos);
            // KINEMATIC body moves freely ignoring gravity while held, but pushes others.
            ball.body.velocity.set(0, 0, 0);
            ball.body.angularVelocity.set(0, 0, 0);
            ball.mesh.position.copy(pos);
        }

        // Update VR HUD ONLY when relevant state changes to avoid per-frame texture updates
        if (this.gameLogic && this.hudMesh) {
            const currentStreak = this.gameLogic.streak;
            const currentCushion = this.gameLogic.cushionContacts;
            const currentShotActive = this.gameLogic.shotActive;

            if (currentStreak !== this.lastStreak || 
                currentCushion !== this.lastCushionContacts || 
                currentShotActive !== this.lastShotActive) {
                
                this.updateHUDContent();
                
                this.lastStreak = currentStreak;
                this.lastCushionContacts = currentCushion;
                this.lastShotActive = currentShotActive;
            }
        }
    }

    savePreShotState() {
        this.preShotState = this.balls.map(ball => ({
            position: ball.body.position.clone(),
            quaternion: ball.body.quaternion.clone()
        }));
    }

    restorePreShotState() {
        if (!this.preShotState) return;
        
        if (this.gameLogic) {
            this.gameLogic.cancelShot();
        }
        
        this.balls.forEach((ball, index) => {
            const state = this.preShotState[index];
            ball.body.position.copy(state.position);
            ball.body.quaternion.copy(state.quaternion);
            ball.body.velocity.set(0, 0, 0);
            ball.body.angularVelocity.set(0, 0, 0);
            
            // Sync mesh immediately
            ball.mesh.position.copy(state.position);
            ball.mesh.quaternion.copy(state.quaternion);
            
            ball.body.wakeUp();
        });
    }

    shootBall(power) {
        if (!this.cue.tip) return;
        
        // Save state for undo BEFORE applying impulse
        this.savePreShotState();

        if (this.gameLogic) {
            this.gameLogic.startShot();
        }
        
        // Find direction the cue is pointing
        const cueForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cue.mesh.quaternion).normalize();
        this.cue.tip.getWorldPosition(this.currentTipPosition);
        
        let targetBall = null;
        let minDistance = Infinity;
        let exactHitPoint = null;
        
        // Always raycast first to find the exact surface point for off-center spin physics
        const raycaster = new THREE.Raycaster(this.currentTipPosition, cueForward);
        const ballMeshes = this.balls.map(b => b.mesh);
        const intersects = raycaster.intersectObjects(ballMeshes);
        
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            targetBall = this.balls.find(b => b.mesh === hitMesh);
            minDistance = intersects[0].distance;
            exactHitPoint = intersects[0].point;
        } else {
            // Fallback: If raycast completely misses but cue is physically inside the ball
            for (const ball of this.balls) {
                const dist = this.currentTipPosition.distanceTo(ball.mesh.position);
                if (dist < 0.2) { // within 20cm
                    targetBall = ball;
                    minDistance = dist;
                    exactHitPoint = ball.mesh.position.clone();
                    break;
                }
            }
        }
        
        // Only shoot if we found a ball and it's reasonably close
        if (targetBall && minDistance < 2.0) {
            // Save state for undo ONLY when a valid shot is about to happen
            this.savePreShotState();

            // Apply impulse
            // Applied force further increased at the high end but quadratic for delicate low end
            const maxForce = 0.12; // Increased from 0.04 to allow very powerful shots
            // Using a quadratic curve: power^2 * maxForce. 
            // This means at 50% bar, power is only 25% of max (0.03), 
            // allowing for very fine control at the lower end.
            const forceMagnitude = Math.max(0.005, Math.pow(power, 2) * maxForce);
            const force = cueForward.multiplyScalar(forceMagnitude);
            const impulse = new CANNON.Vec3(force.x, force.y, force.z);
            
            // Apply the physics push AT the exact hit point coordinate. 
            // If this is off-center, Cannon.js will automatically convert the offset into angular rotation (Billiard English)
            const worldPoint = new CANNON.Vec3(exactHitPoint.x, exactHitPoint.y, exactHitPoint.z);

            targetBall.body.wakeUp();
            targetBall.body.applyImpulse(impulse, worldPoint);

            if (this.gameLogic) {
                this.gameLogic.startShot();
            }
        }
    }

    showHUDMessage(msg, duration = 3000) {
        this.updateAnnouncementHUD(msg);
        
        if (this.hudMessageTimeout) clearTimeout(this.hudMessageTimeout);
        this.hudMessageTimeout = setTimeout(() => {
            this.annMesh.visible = false;
        }, duration);
    }

    updateAnnouncementHUD(message) {
        const ctx = this.annContext;
        // Total height 768
        ctx.clearRect(0, 0, 512, 768);

        // Background box for message
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Darker for center
        ctx.roundRect(5, 50, 502, 300, 20); // Box for text
        ctx.fill();
        
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 3;
        ctx.strokeRect(5, 50, 502, 300);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white'; // EXPLICIT WHITE TEXT
        
        const fontTitle = 'bold 24px Arial';
        const fontDesc = '18px Arial';
        const x = 256;
        let y = 110; // Lowered from 85 to be better centered in the 50-350 box

        // Split by newlines first to honor manual breaks, then wrap each segment
        const segments = message.split('\n');
        let lines = [];
        segments.forEach(seg => {
            if (seg.trim() === "") {
                lines.push(""); // empty line
            } else {
                lines = lines.concat(this.wrapText(ctx, seg, 460));
            }
        });

        lines.forEach((line, index) => {
            ctx.font = (index === 0 && segments.length > 1) ? fontTitle : fontDesc;
            ctx.fillText(line, x, y);
            y += (index === 0 && segments.length > 1) ? 32 : 24;
        });

        // DRAW SCHEMATIC BELOW TEXT if in Master Play
        if (this.currentMasterPath) {
            // Table is 1.42 x 2.84 (2:1 ratio). Drawing at 200x400 means 1m = 140.8px approx
            // Centered: 512 / 2 = 256. Starting at 256 - 100 = 156.
            this.drawTableSchematic(ctx, 156, 360, 200, 400);
        }

        this.annTexture.needsUpdate = true;
        this.annMesh.visible = true;
    }

    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    switchToTopDownView() {
        if (this.isTopDown) return;
        this.isTopDown = true;
        this.originalRigPos.copy(this.xrRig.position);
        this.originalRigQuat.copy(this.xrRig.quaternion);

        // Position rig above the table looking down (Aerial View)
        this.xrRig.position.set(0, 3.2, 0); // 3.2m above floor
        // Use setRotationFromEuler for clear top-down
        this.xrRig.rotation.set(-Math.PI / 2, 0, 0);
        
        if (this.soundManager) this.soundManager.playSound('click');
    }

    restoreView() {
        if (!this.isTopDown) return;
        this.isTopDown = false;
        this.xrRig.position.copy(this.originalRigPos);
        this.xrRig.quaternion.copy(this.originalRigQuat);
    }
}
