/*
 * YORB 2020
 *
 * Aidan Nelson, April 2020
 *
 */

import { pauseAllConsumersForPeer, resumeAllConsumersForPeer, hackToRemovePlayerTemporarily } from './index.js'
import { create3DText, createSimpleText, makeVideoTextureAndMaterial, redrawVideoCanvas, randomRange } from './utils'
import { SpringShow } from './SpringShow'

const THREE = require('./libs/three.min.js')
const Stats = require('./libs/stats.min.js')

// slightly awkward syntax, but these statements add these functions to THREE
require('./libs/GLTFLoader.js')(THREE)
require('./libs/pointerLockControls.js')(THREE)

class Scene {
    constructor(_movementCallback, _clients, mySocketID) {
        // add this to window to allow javascript console debugging
        window.scene = this

        // this pauses or restarts rendering and updating
        this.paused = true
        let domElement = document.getElementById('scene-container')
        this.frameCount = 0
        this.clients = _clients
        this.mySocketID = mySocketID
        this.DEBUG_MODE = false
        this.movementCallback = _movementCallback
        this.width = window.innerWidth * 0.9
        this.height = window.innerHeight * 0.7
        this.scene = new THREE.Scene()
        this.raycaster = new THREE.Raycaster()
        this.textParser = new DOMParser()
        this.mouse = {
            x: 0,
            y: 0,
        }
        this.hightlightedProjectId = -1 // to start
        this.textureLoader = new THREE.TextureLoader()

        // audio variables:
        this.distanceThresholdSquared = 500
        this.rolloffNumerator = 5

        // STATS for debugging:
        this.stats = new Stats()
        document.body.appendChild(this.stats.dom)
        this.stats.dom.style = 'visibility: hidden;'

        //THREE Camera
        this.cameraHeight = 1.75
        this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 5000)

        // starting position
        // elevator bank range: x: 3 to 28, z: -2.5 to 1.5
        let randX = randomRange(3, 28)
        let randZ = randomRange(-2.5, 1.5)
        this.camera.position.set(randX, this.cameraHeight, randZ)
        // create an AudioListener and add it to the camera
        this.listener = new THREE.AudioListener()
        this.camera.add(this.listener)
        this.scene.add(this.camera)
        this.camera.lookAt(new THREE.Vector3(0, this.cameraHeight, 0))
        window.camera = this.camera

        //THREE WebGL renderer
        this.renderer = new THREE.WebGLRenderer({
            antialiasing: true,
        })
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        this.renderer.setClearColor(new THREE.Color('lightblue'))
        this.renderer.setSize(this.width, this.height)

        this.setupControls()
        this.addLights()
        this.setupCollisionDetection()
        this.createMaterials()
        this.loadBackground()
        this.loadFloorModel()
        this.springShow = new SpringShow(this.scene, this.camera, this.controls)
        this.springShow.setupSpringShow()

        //Push the canvas to the DOM
        domElement.append(this.renderer.domElement)

        //Setup event listeners for events and handle the states
        window.addEventListener('resize', (e) => this.onWindowResize(e), false)
        domElement.addEventListener('click', (e) => this.onMouseClick(e), false)

        // Helpers
        this.helperGrid = new THREE.GridHelper(500, 500)
        this.helperGrid.position.y = -0.1 // offset the grid down to avoid z fighting with floor
        this.scene.add(this.helperGrid)

        this.update()
        this.render()
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Lighting 💡

    addLights() {
        // add some lights
        this.scene.add(new THREE.AmbientLight(0xffffe6, 0.7))

        //https://github.com/mrdoob/three.js/blob/master/examples/webgl_lights_hemisphere.html
        // main sunlight with shadows
        let dirLight = new THREE.DirectionalLight(0xffffe6, 0.7)
        dirLight.color.setHSL(0.1, 1, 0.95)
        dirLight.position.set(-1, 0.5, -1)
        dirLight.position.multiplyScalar(200)
        this.scene.add(dirLight)

        dirLight.castShadow = true
        dirLight.shadow.mapSize.width = 1024
        dirLight.shadow.mapSize.height = 1024

        var d = 150
        dirLight.shadow.camera.left = -d
        dirLight.shadow.camera.right = d
        dirLight.shadow.camera.top = d
        dirLight.shadow.camera.bottom = -d

        dirLight.shadow.camera.far = 3500
        dirLight.shadow.bias = -0.0001

        // secondary directional light without shadows:
        let dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5)
        dirLight2.color.setHSL(0.1, 1, 0.95)
        dirLight2.position.set(1, 0.5, -1)
        dirLight2.position.multiplyScalar(200)
        this.scene.add(dirLight2)
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Model 🏗

    loadBackground() {
        var path = 'models/Park2/'
        var format = '.jpg'
        this.envMap = new THREE.CubeTextureLoader().load([
            path + 'posx' + format,
            path + 'negx' + format,
            path + 'posy' + format,
            path + 'negy' + format,
            path + 'posz' + format,
            path + 'negz' + format,
        ])
        this.scene.background = this.envMap
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Clients 👫

    addSelf() {
        let _body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial())

        let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial('local')

        let _head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), videoMaterial)

        _head.visible = false // for first person

        // set position of head before adding to parent object
        _body.position.set(0, 0, 0)
        _head.position.set(0, 1, 0)

        // https://threejs.org/docs/index.html#api/en/objects/Group
        this.playerGroup = new THREE.Group()
        this.playerGroup.position.set(0, 0.5, 0)
        this.playerGroup.add(_body)
        this.playerGroup.add(_head)
        this.playerVideoTexture = videoTexture

        // add group to scene
        this.scene.add(this.playerGroup)
    }

    // add a client meshes, a video element and  canvas for three.js video texture
    addClient(_id) {
        let _body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), new THREE.MeshNormalMaterial())

        let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial(_id)

        let _head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), videoMaterial)

        // set position of head before adding to parent object
        _body.position.set(0, 0, 0)
        _head.position.set(0, 1, 0)

        // https://threejs.org/docs/index.html#api/en/objects/Group
        var group = new THREE.Group()
        group.add(_body)
        group.add(_head)

        // add group to scene
        this.scene.add(group)

        console.log('Adding client to scene: ' + _id)

        this.clients[_id].group = group
        this.clients[_id].texture = videoTexture
        this.clients[_id].desiredPosition = new THREE.Vector3()
        // this.clients[_id].desiredRotation = new THREE.Quaternion();
    }

    removeClient(_id) {
        this.scene.remove(this.clients[_id].group)
    }

    // overloaded function can deal with new info or not
    updateClientPositions(_clientProps) {
        let halfClientHeight = 1

        for (let _id in _clientProps) {
            // we'll update ourselves separately to avoid lag...
            if (_id in this.clients) {
                if (_id != this.mySocketID) {
                    this.clients[_id].desiredPosition = new THREE.Vector3(_clientProps[_id].position[0], _clientProps[_id].position[1], _clientProps[_id].position[2])
                    // this.clients[_id].desiredRotation = new THREE.Quaternion().fromArray(_clientProps[_id].rotation)
                    let euler = new THREE.Euler(0, _clientProps[_id].rotation[1], 0, 'XYZ')
                    this.clients[_id].group.setRotationFromEuler(euler)
                }
            }
        }
    }

    // TODO make this simpler...? more performant?
    updatePositions() {
        let snapDistance = 0.5
        // let snapAngle = 0.2; // radians
        for (let _id in this.clients) {
            if (this.clients[_id].group) {
                this.clients[_id].group.position.lerp(this.clients[_id].desiredPosition, 0.2)
                if (this.clients[_id].group.position.distanceTo(this.clients[_id].desiredPosition) < snapDistance) {
                    this.clients[_id].group.position.set(this.clients[_id].desiredPosition.x, this.clients[_id].desiredPosition.y, this.clients[_id].desiredPosition.z)
                }
            }
        }
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Collision Detection 🤾‍♀️

    /*
     * setupCollisionDetection()
     *
     * Description:
     * This function sets up collision detection:
     * 	- creates this.collidableMeshList which will be populated by this.loadFloorModel function
     * 	- creates this.obstacles object which will be queried by player controls before performing movement
     * 	- generates arrays of collision detection points, from which we will perform raycasts in this.detectCollisions()
     *
     */
    setupCollisionDetection() {
        this.collidableMeshList = []

        this.obstacles = {
            forward: false,
            backward: false,
            right: false,
            left: false,
        }

        // for use debugging collision detection
        if (this.DEBUG_MODE) {
            this.collisionDetectionDebugArrows = []
            for (let i = 0; i < numTotalCollisionDetectionPoints; i++) {
                var arrow = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0x000000)
                this.collisionDetectionDebugArrows.push(arrow)
                this.scene.add(arrow)
            }
        }
    }

    /*
     * getPointsBetweenPoints()
     *
     * Description:
     * Returns an array of numPoints THREE.Vector3 objects evenly spaced between vecA and vecB, including vecA and vecB
     *
     * based on:
     * https://stackoverflow.com/questions/21249739/how-to-calculate-the-points-between-two-given-points-and-given-distance
     *
     */
    getPointsBetweenPoints(vecA, vecB, numPoints) {
        var points = []
        var dirVec = vecB.clone().sub(vecA)
        for (let i = 0; i < numPoints; i++) {
            var pt = vecA.clone().add(dirVec.clone().multiplyScalar(i / (numPoints - 1)))
            points.push(pt)
        }
        return points
    }

    /*
     * detectCollisions()
     *
     * based on method shown here:
     * https://github.com/stemkoski/stemkoski.github.com/blob/master/Three.js/Collision-Detection.html
     *
     * Description:
     * 1. Creates THREE.Vector3 objects representing the current forward, left, right, backward direction of the character.
     * 2. For each side of the cube,
     * 		- uses the collision detection points created in this.setupCollisionDetection()
     *		- sends a ray out from each point in the direction set up above
     * 		- if any one of the rays hits an object, set this.obstacles.SIDE (i.e. right or left) to true
     * 3. Give this.obstacles object to this.controls
     *
     * To Do: setup helper function to avoid repetitive code
     */
    detectCollisions() {
        // reset obstacles:
        this.obstacles = {
            forward: false,
            backward: false,
            right: false,
            left: false,
        }

        // TODO only use XZ components of forward DIR in case we are looking up or down while travelling forward
        // NOTE: THREE.PlayerControls seems to be backwards (i.e. the 'forward' controls go backwards)...
        // Weird, but this function respects those directions for the sake of not having to make conversions
        // https://github.com/mrdoob/three.js/issues/1606
        var matrix = new THREE.Matrix4()
        matrix.extractRotation(this.camera.matrix)
        var backwardDir = new THREE.Vector3(0, 0, 1).applyMatrix4(matrix)
        var forwardDir = backwardDir.clone().negate()
        var rightDir = forwardDir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
        var leftDir = rightDir.clone().negate()

        // TODO more points around avatar so we can't be inside of walls
        let pt = this.controls.getObject().position.clone()

        this.forwardCollisionDetectionPoints = [pt]
        this.backwardCollisionDetectionPoints = [pt]
        this.rightCollisionDetectionPoints = [pt]
        this.leftCollisionDetectionPoints = [pt]

        // check forward
        this.obstacles.forward = this.checkCollisions(this.forwardCollisionDetectionPoints, forwardDir, 0)
        this.obstacles.backward = this.checkCollisions(this.backwardCollisionDetectionPoints, backwardDir, 4)
        this.obstacles.left = this.checkCollisions(this.leftCollisionDetectionPoints, leftDir, 8)
        this.obstacles.right = this.checkCollisions(this.rightCollisionDetectionPoints, rightDir, 12)

        // this.controls.obstacles = this.obstacles;
    }

    checkCollisions(pts, dir, arrowHelperOffset) {
        // distance at which a collision will be detected and movement stopped (this should be greater than the movement speed per frame...)
        var detectCollisionDistance = 1

        for (var i = 0; i < pts.length; i++) {
            var pt = pts[i].clone()
            // pt.applyMatrix4(this.playerGroup.matrix);
            // pt.y += 1.0; // bias upward to head area of player

            this.raycaster.set(pt, dir)
            var collisions = this.raycaster.intersectObjects(this.collidableMeshList)

            // arrow helpers for debugging
            if (this.DEBUG_MODE) {
                var a = this.collisionDetectionDebugArrows[i + arrowHelperOffset]
                a.setLength(detectCollisionDistance)
                a.setColor(new THREE.Color('rgb(0, 0, 255)'))
                a.position.x = pt.x
                a.position.y = pt.y
                a.position.z = pt.z
                a.setDirection(dir)
            }

            if (collisions.length > 0 && collisions[0].distance < detectCollisionDistance) {
                return true
            }
        }
        return false
    }
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Player Controls:

    // Set up pointer lock controls and corresponding event listeners
    setupControls() {
        let jumpSpeed = 12
        this.controls = new THREE.PointerLockControls(this.camera, this.renderer.domElement)

        this.moveForward = false
        this.moveBackward = false
        this.moveLeft = false
        this.moveRight = false
        this.canJump = false

        this.prevTime = performance.now()
        this.velocity = new THREE.Vector3()
        this.direction = new THREE.Vector3()
        this.vertex = new THREE.Vector3()
        this.color = new THREE.Color()

        var overlay = document.getElementById('overlay')

        this.controls.addEventListener('lock', () => {
            this.clearControls()
            this.paused = false
            overlay.style.visibility = 'hidden'
            document.getElementById('instructions-overlay').style.visibility = 'visible'
        })

        this.controls.addEventListener('unlock', () => {
            overlay.style.visibility = 'visible'
            this.clearControls()
            this.paused = true
            document.getElementById('instructions-overlay').style.visibility = 'hidden'
        })

        document.addEventListener(
            'keydown',
            (event) => {
                switch (event.keyCode) {
                    case 38: // up
                    case 87: // w
                        this.moveForward = true
                        break

                    case 37: // left
                    case 65: // a
                        this.moveLeft = true
                        break

                    case 40: // down
                    case 83: // s
                        this.moveBackward = true
                        break

                    case 39: // right
                    case 68: // d
                        this.moveRight = true
                        break

                    case 32: // space
                        if (this.canJump === true) this.velocity.y = jumpSpeed
                        this.canJump = false
                        break
                }
            },
            false
        )

        document.addEventListener(
            'keyup',
            (event) => {
                switch (event.keyCode) {
                    case 38: // up
                    case 87: // w
                        this.moveForward = false
                        break

                    case 37: // left
                    case 65: // a
                        this.moveLeft = false
                        break

                    case 40: // down
                    case 83: // s
                        this.moveBackward = false
                        break

                    case 39: // right
                    case 68: // d
                        this.moveRight = false
                        break
                }
            },
            false
        )

        this.velocity.y = 0
    }

    // clear control state every time we reenter the game
    clearControls() {
        this.moveForward = false
        this.moveBackward = false
        this.moveLeft = false
        this.moveRight = false
        this.canJump = false
        this.velocity.x = 0
        this.velocity.z = 0
        this.velocity.y = 0
    }

    // update for these controls, which are unfortunately not included in the controls directly...
    // see: https://github.com/mrdoob/three.js/issues/5566
    updateControls() {
        let speed = 50
        if (this.controls.isLocked === true) {
            var origin = this.controls.getObject().position.clone()
            origin.y -= this.cameraHeight // origin is at floor level

            this.raycaster.set(origin, new THREE.Vector3(0, -this.cameraHeight, 0))

            var intersectionsDown = this.raycaster.intersectObjects(this.collidableMeshList)
            var onObject = intersectionsDown.length > 0 && intersectionsDown[0].distance < 0.1

            var time = performance.now()
            var rawDelta = (time - this.prevTime) / 1000
            // clamp delta so lower frame rate clients don't end up way far away
            let delta = Math.min(rawDelta, 0.1)

            this.velocity.x -= this.velocity.x * 10.0 * delta
            this.velocity.z -= this.velocity.z * 10.0 * delta

            this.velocity.y -= 9.8 * 8.0 * delta // 100.0 = mass

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward)
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft)
            this.direction.normalize() // this ensures consistent this.movements in all this.directions

            if (this.moveForward || this.moveBackward) {
                this.velocity.z -= this.direction.z * speed * delta
            }

            if (this.moveLeft || this.moveRight) {
                this.velocity.x -= this.direction.x * speed * delta
            }

            if (onObject === true) {
                this.velocity.y = Math.max(0, this.velocity.y)
                this.canJump = true
            }

            if ((this.velocity.x > 0 && !this.obstacles.left) || (this.velocity.x < 0 && !this.obstacles.right)) {
                this.controls.moveRight(-this.velocity.x * delta)
            }
            if ((this.velocity.z > 0 && !this.obstacles.backward) || (this.velocity.z < 0 && !this.obstacles.forward)) {
                this.controls.moveForward(-this.velocity.z * delta)
            }

            this.controls.getObject().position.y += this.velocity.y * delta // new behavior

            if (this.controls.getObject().position.y < this.cameraHeight) {
                this.velocity.y = 0
                this.controls.getObject().position.y = this.cameraHeight
                this.canJump = true
            }

            this.prevTime = time
        }
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Position Update for Socket

    getPlayerPosition() {
        // TODO: use quaternion or are euler angles fine here?
        return [
            [this.camera.position.x, this.camera.position.y - (this.cameraHeight - 0.5), this.camera.position.z],
            [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
        ]
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Loop ⭕️

    update() {
        requestAnimationFrame(() => this.update())

        if (!this.paused) {
            this.updateControls()

            // update volumes every X frames
            this.frameCount++
            if (this.frameCount % 20 == 0) {
                this.updateClientVolumes()
                this.movementCallback()
                this.springShow.highlightHyperlinks()
            }
            if (this.frameCount % 50 == 0) {
                this.selectivelyPauseAndResumeConsumers()
            }
            this.detectCollisions()
        }

        this.stats.update()
        this.updatePositions() // other users
        this.render()
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Rendering 🎥

    render() {
        // Update video canvases for each client
        this.updateVideoTextures()
        this.renderer.render(this.scene, this.camera)
    }

    updateVideoTextures() {
        for (let _id in this.clients) {
            let remoteVideo = document.getElementById(_id + '_video')
            let remoteVideoCanvas = document.getElementById(_id + '_canvas')
            if (remoteVideo != null && remoteVideoCanvas != null) {
                redrawVideoCanvas(remoteVideo, remoteVideoCanvas, this.clients[_id].texture)
            }
        }
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Audio 📣

    updateClientVolumes() {
        for (let _id in this.clients) {
            if (this.clients[_id].audioElement) {
                let distSquared = this.camera.position.distanceToSquared(this.clients[_id].group.position)
                if (distSquared > this.distanceThresholdSquared) {
                    // TODO pause consumer here, rather than setting volume to zero
                    this.clients[_id].audioElement.volume = 0
                } else {
                    // from lucasio here: https://discourse.threejs.org/t/positionalaudio-setmediastreamsource-with-webrtc-question-not-hearing-any-sound/14301/29
                    let volume = Math.min(1, this.rolloffNumerator / distSquared)
                    this.clients[_id].audioElement.volume = volume
                }
            }
        }
    }

    getClosestPeers() {
        let peerIDs = []
        for (let _id in this.clients) {
            let distSquared = this.camera.position.distanceToSquared(this.clients[_id].group.position)
            if (distSquared <= this.distanceThresholdSquared) {
                peerIDs.push(_id)
            }
        }
        return peerIDs
    }

    selectivelyPauseAndResumeConsumers() {
        for (let _id in this.clients) {
            let distSquared = this.camera.position.distanceToSquared(this.clients[_id].group.position)
            if (distSquared > this.distanceThresholdSquared) {
                pauseAllConsumersForPeer(_id)
            } else {
                resumeAllConsumersForPeer(_id)
            }
        }
    }

    // At the moment, this just adds a .audioElement parameter to a client stored under _id
    // which will be updated above
    createOrUpdatePositionalAudio(_id) {
        let audioElement = document.getElementById(_id + '_audio')
        if (audioElement == null) {
            console.log('No audio element found for user with ID: ' + _id)
            return
        }
        this.clients[_id].audioElement = audioElement
        console.log('The following audio element attached to client with ID ' + _id + ':')
        console.log(this.clients[_id].audioElement)
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Event Handlers 🍽

    onWindowResize(e) {
        this.width = window.innerWidth * 0.9
        this.height = window.innerHeight * 0.7
        this.camera.aspect = this.width / this.height
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(this.width, this.height)
    }

    onMouseClick(e) {
        this.springShow.activateHighlightedProject()
    }
}

export default Scene
