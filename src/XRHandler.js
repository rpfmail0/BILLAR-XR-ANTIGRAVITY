import * as THREE from 'three';
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import * as CANNON from 'cannon-es';

export class XRHandler {
    constructor(renderer, scene, xrRig, camera, cue, balls, gameLogic, soundManager, table) {
        this.renderer = renderer;
        this.scene = scene;
        this.xrRig = xrRig;
        this.camera = camera;
        this.cue = cue;
        this.balls = balls;
        this.gameLogic = gameLogic;
        this.soundManager = soundManager;
        this.table = table;
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
        this.chargeSpeed = 1.0; // 1 second to reach full power

        // Locomotion state
        this.snapTurnReady = true;

        // VR Grabbing Context
        this.grabbedBalls = new Map(); // maps controller to ball

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
    }

    onSelectStart(event) {
        const session = this.renderer.xr.getSession();
        if (session) {
            for (let i = 0; i < session.inputSources.length; i++) {
                if (this.renderer.xr.getController(i) === event.target) {
                    if (session.inputSources[i].handedness !== 'right') return;
                    break;
                }
            }
        }

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
        
        this.shootBall(this.chargePower);
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
        // Find left and right controllers
        const session = this.renderer.xr.getSession();
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
                // Standard VR gamepads axes: [0, 1] touchpad/thumbstick 1, [2, 3] touchpad/thumbstick 2.
                if (axes.length >= 4) {
                    const deadzone = 0.1;
                    const moveX = Math.abs(axes[2]) > deadzone ? axes[2] : 0;
                    const moveY = Math.abs(axes[3]) > deadzone ? axes[3] : 0;

                    // Left controller: Movement
                    if (source.handedness === 'left') {
                        const speed = 2.0 * dt;
                        
                        // Calculate forward and right relative to camera view on XZ plane
                        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                        forward.y = 0;
                        forward.normalize();
                        
                        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
                        right.y = 0;
                        right.normalize();

                        // Invert thumbstick logic:
                        // Pushing forward (moveY < 0) should move along positive forward vector
                        // Pushing right (moveX > 0) should move along positive right vector
                        this.xrRig.position.add(right.multiplyScalar(-moveX * speed));
                        this.xrRig.position.add(forward.multiplyScalar(-moveY * speed));

                        // Clamp position to not walk further than 1.5m from the table.
                        // Table dimensions: half-width=0.71, half-length=1.42
                        // Boundaries = dimension + 1.5
                        const maxDistX = 2.21;
                        const maxDistZ = 2.92;
                        this.xrRig.position.x = Math.max(-maxDistX, Math.min(maxDistX, this.xrRig.position.x));
                        this.xrRig.position.z = Math.max(-maxDistZ, Math.min(maxDistZ, this.xrRig.position.z));
                    }

                    // Right controller: Snap turning
                    if (source.handedness === 'right') {
                        if (Math.abs(moveX) < deadzone) {
                            this.snapTurnReady = true;
                        } else if (this.snapTurnReady) {
                            this.xrRig.rotation.y += moveX > 0 ? -Math.PI / 4 : +Math.PI / 4;
                            this.snapTurnReady = false;
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
    }

    shootBall(power) {
        if (!this.cue.tip) return;
        
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
            // Apply impulse
            // Applied force further reduced by factor of 5 based on user request
            const maxForce = 0.04; 
            const forceMagnitude = Math.max(0.005, power * maxForce);
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
}
