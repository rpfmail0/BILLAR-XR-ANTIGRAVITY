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

        // Event listeners
        this.controller1.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller1.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.controller2.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller2.addEventListener('selectend', this.onSelectEnd.bind(this));
        
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

        // Aim Helper: Trajectory Line
        const lineMat = new THREE.LineBasicMaterial({ color: 0x800080, depthTest: false, linewidth: 2 });
        const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        this.trajectoryLine = new THREE.Line(lineGeo, lineMat);
        this.trajectoryLine.renderOrder = 999;
        this.scene.add(this.trajectoryLine);
        this.trajectoryLine.visible = false;
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
        if (this.trajectoryLine) this.trajectoryLine.visible = false;

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

                // Update trajectory line ONLY if charging
                if (this.isCharging && initialTargetBall) {
                    this.trajectoryLine.visible = true;
                    
                    const points = [];
                    let currentOrigin = initialTargetBall.mesh.position.clone();
                    let currentDirection = cueForward.clone();
                    let remainingLength = Math.max(0.1, this.chargePower * 3.0);
                    const maxBounces = 3;
                    let currentTargetBall = initialTargetBall;
                    
                    points.push(currentOrigin.clone());
                    
                    for (let i = 0; i < maxBounces; i++) {
                        if (remainingLength <= 0) break;
                        
                        const bounceRaycaster = new THREE.Raycaster(currentOrigin, currentDirection);
                        const collidables = this.balls.map(b => b.mesh).filter(m => m !== currentTargetBall.mesh);
                        if (this.table && this.table.cushionMeshes) {
                            collidables.push(...this.table.cushionMeshes);
                        }
                        
                        const hits = bounceRaycaster.intersectObjects(collidables);
                        const validHits = hits.filter(h => h.distance > 0.01);
                        
                        if (validHits.length > 0) {
                            const hit = validHits[0];
                            const radiusOffset = 0.03075; // Ball radius roughly
                            
                            // Adjust distance to stop the center point At the surface of the hit bounding box
                            let distanceToHitCenter = Math.max(0, hit.distance - radiusOffset);
                            
                            if (distanceToHitCenter < remainingLength) {
                                // It bounces within remaining length
                                const hitPointCenter = currentOrigin.clone().add(currentDirection.clone().multiplyScalar(distanceToHitCenter));
                                points.push(hitPointCenter.clone());
                                
                                // Calculate reflection normal
                                const normal = hit.face.normal ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : new THREE.Vector3(0,1,0);
                                
                                if (hit.object.geometry.type === 'SphereGeometry') {
                                    normal.copy(hitPointCenter).sub(hit.object.position).normalize();
                                } else {
                                    normal.y = 0;
                                    normal.normalize();
                                }
                                
                                currentDirection.reflect(normal).normalize();
                                currentDirection.y = 0; // Keep flat on table
                                
                                currentOrigin = hitPointCenter;
                                remainingLength -= distanceToHitCenter;
                                
                                const nextHitBallInfo = this.balls.find(b => b.mesh === hit.object);
                                if (nextHitBallInfo) {
                                    currentTargetBall = nextHitBallInfo;
                                } else {
                                    currentTargetBall = { mesh: null }; // Hit a cushion
                                }
                                
                                continue;
                            }
                        }
                        
                        // No valid bounce within remaining length
                        points.push(currentOrigin.clone().add(currentDirection.clone().multiplyScalar(remainingLength)));
                        break;
                    }
                    
                    this.trajectoryLine.geometry.setFromPoints(points);
                }
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
    }

    shootBall(power) {
        if (!this.cue.tip) return;
        
        // Find direction the cue is pointing
        const cueForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cue.mesh.quaternion).normalize();
        this.cue.tip.getWorldPosition(this.currentTipPosition);
        
        let targetBall = null;
        let minDistance = Infinity;
        
        // 1. Check if the cue tip is physically close to any ball
        for (const ball of this.balls) {
            const dist = this.currentTipPosition.distanceTo(ball.mesh.position);
            if (dist < 0.2) { // within 20cm
                targetBall = ball;
                minDistance = dist;
                break;
            }
        }
        
        // 2. If not close, raycast to find the ball we are pointing at
        if (!targetBall) {
            const raycaster = new THREE.Raycaster(this.currentTipPosition, cueForward);
            const ballMeshes = this.balls.map(b => b.mesh);
            const intersects = raycaster.intersectObjects(ballMeshes);
            
            if (intersects.length > 0) {
                const hitMesh = intersects[0].object;
                targetBall = this.balls.find(b => b.mesh === hitMesh);
                minDistance = intersects[0].distance;
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
            
            const hitPointOffset = new CANNON.Vec3(0, -0.01, 0); 
            const worldPoint = new CANNON.Vec3(targetBall.body.position.x, targetBall.body.position.y, targetBall.body.position.z).vadd(hitPointOffset);

            targetBall.body.wakeUp();
            targetBall.body.applyImpulse(impulse, worldPoint);

            if (this.gameLogic) {
                this.gameLogic.startShot();
            }
        }
    }
}
