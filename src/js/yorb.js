/*
 * YORB 2020
 *
 * Aidan Nelson, April 2020
 *
 */

import { hackToRemovePlayerTemporarily, pauseAllConsumersForPeer, resumeAllConsumersForPeer } from './index.js'

import { redrawVideoCanvas, makeVideoTextureAndMaterial } from './utils'

import { SpringShow2020 } from './springShow2020'
import { WinterShow2020 } from './winterShow2020'
import { ITPModel } from './itpModel'
import { Sketches } from './p5Sketches'
import { ProjectionScreens } from './projectionScreens'
import { YorbControls2 } from './yorbControls2.js'
import { Yorblet } from './yorblet.js'

import * as THREE from 'three'

const Stats = require('./libs/stats.min.js')

const MODE = "YORBLET";
export const YORBLET_INDEX = 1;

export class Yorb {
    constructor(_movementCallback, _clients, mySocketID) {
        // add this to window to allow javascript console debugging
        window.scene = this

        // this pauses or restarts rendering and updating
        let domElement = document.getElementById('scene-container')
        this.frameCount = 0
        this.clients = _clients
        this.mySocketID = mySocketID
        this.hyperlinkedObjects = [] // array to store interactable hyperlinked meshes
        this.DEBUG_MODE = false
        this.movementCallback = _movementCallback
        this.width = window.innerWidth * 0.9
        this.height = window.innerHeight * 0.7
        this.scene = new THREE.Scene()
        this.gravity = 2.0
        this.raycaster = new THREE.Raycaster()
        this.textParser = new DOMParser()
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

        this.mouse = new THREE.Vector2()

        /*
         *
         * STARTING POSITIONS
         *
         */

        // Elevator bank range: x: 3 to 28, z: -2.5 to 1.5

        // In front of Red Square / ER range: x: -7.4 to - 13.05, z: -16.8 to -8.3
        let randX = this.randomRange(-7,-16)
        let randZ = this.randomRange(-13,-8)
        this.camera.position.set(randX, this.cameraHeight, randZ)

        // PARACHUTE IS BACK...
        // Start us up high on the Y axis and outside the Yorblet
        // this.camera.position.set(-3, 100, 43)

        // create an AudioListener and add it to the camera
        this.listener = new THREE.AudioListener()
        this.camera.add(this.listener)
        this.scene.add(this.camera)

        this.camera.lookAt(new THREE.Vector3(-13.6, this.cameraHeight, -14.5))

        window.camera = this.camera

        //THREE WebGL renderer
        this.renderer = new THREE.WebGLRenderer({
            antialiasing: true,
        })
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        this.renderer.setClearColor(new THREE.Color('lightblue')) // change sky color
        this.renderer.setSize(this.width, this.height)

        this.addLights()
        this.loadBackground()

        this.addYORBParts()

        //Push the canvas to the DOM
        domElement.append(this.renderer.domElement)

        //Setup event listeners for events and handle the states
        window.addEventListener('resize', (e) => this.onWindowResize(e), false)
        window.addEventListener('mousemove', (e) => this.onMouseMove(e), false)

        // Helpers
        this.helperGrid = new THREE.GridHelper(500, 500)
        this.helperGrid.position.y = -0.1 // offset the grid down to avoid z fighting with floor
        this.scene.add(this.helperGrid)

        this.update()
        this.render()
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // add YORB parts
    addYORBParts() {
        this.controls = new YorbControls2(this.scene, this.camera, this.renderer)

        this.projectionScreens = new ProjectionScreens(this.scene, this.camera, this.mouse)

        this.show = false
        this.yorblet = false

        if (MODE === 'YORBLET') {
            this.yorblet = new Yorblet(this.scene, this.projectionScreens, this.mouse, this.camera, this.controls)
        }

        if (MODE === 'YORB') {
            this.show = new WinterShow2020(this.scene, this.camera, this.controls, this.mouse)
            this.show.setup()
            this.itpModel = new ITPModel(this.scene)
        }

        // this.sketches = new Sketches(this.scene)
        // setTimeout(() => {
        //     this.sketches.addSketches()
        // }, 5000) // try to let the sketches finish loading
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

    //
    // update projects:
    updateProjects(projects) {
        if (this.show) {
            console.log('yorb received', projects.length, 'show projects')
            this.show.updateProjects(projects)
        }
        if (this.yorblet) {
            this.yorblet.updateProjects(projects)
        }
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Model 🏗

    loadBackground() {
        this.envMap = new THREE.CubeTextureLoader().load([
            require('../assets/images/Park2/posx.jpg'),
            require('../assets/images/Park2/negx.jpg'),
            require('../assets/images/Park2/posy.jpg'),
            require('../assets/images/Park2/negy.jpg'),
            require('../assets/images/Park2/posz.jpg'),
            require('../assets/images/Park2/negz.jpg'),
        ])
        //this.scene.background = this.envMap
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
        this.clients[_id].projectionScreenId = -1
    }

    removeClient(_id) {
        this.scene.remove(this.clients[_id].group)
    }

    // overloaded function can deal with new info or not
    updateClientPositions(_clientProps) {
        let halfClientHeight = 1

        for (let _id in _clientProps) {
            if (_id in this.clients) {
                if (_id != this.mySocketID) {
                    // we'll update ourselves separately to avoid lag...
                    // update position
                    this.clients[_id].desiredPosition = new THREE.Vector3(_clientProps[_id].position[0], _clientProps[_id].position[1], _clientProps[_id].position[2])
                    // update rotation
                    let euler = new THREE.Euler(0, _clientProps[_id].rotation[1], 0, 'XYZ')
                    this.clients[_id].group.setRotationFromEuler(euler)
                }
            }
        }
    }

    updateProjectionScreenOwnership(_clientProps) {
        for (let _id in _clientProps) {
            // update projection screens
            let projectionScreenId = _clientProps[_id].projectionScreenId
            if (projectionScreenId !== -1 && projectionScreenId !== undefined) {
                this.projectionScreens.assignProjectionScreen(projectionScreenId, _id)
            }
        }
    }

    // TODO make this simpler...? more performant?
    updatePositions() {

      // PARACHUTE IS BACK...
      // While landing, let's look at the middle of the area
      if (this.camera.position.y > 5) {
          let lookMiddle = new THREE.Vector3(0, this.cameraHeight, 0)
          this.camera.lookAt(lookMiddle)
      }

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

        if (!this.controls.paused) {
            this.frameCount++

            // things to update 50 times per seconds:
            this.controls.update()
            this.projectionScreens.update()

            // things to update 5 x per second
            if (this.frameCount % 10 === 0) {
                // this.sketches.update()
            }

            if (this.frameCount % 20 == 0) {
                this.updateClientVolumes()
                this.projectionScreens.updatePositionalAudio()
                this.movementCallback()
                if (this.show) {
                    this.show.update()
                    for(let portal of this.show.portals){ //originally had this in framecount % 50, might want to move there if too slow
                        if(portal.teleportCheck(this.getPlayerPosition()[0])){
                            hackToRemovePlayerTemporarily()
                        }
                    }
                }
                if (this.yorblet) {
                    this.yorblet.update()
                    if(this.yorblet.portal.teleportCheck(this.getPlayerPosition()[0])){ //for portal trigger
                        //if returns true, remove user from this yorblet
                        hackToRemovePlayerTemporarily()
                    }
                }
                this.projectionScreens.checkProjectionScreenCollisions()
            }
            if (this.frameCount % 50 == 0) {
                this.selectivelyPauseAndResumeConsumers()
            }
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
        // update for the clients
        for (let _id in this.clients) {
            let remoteVideo = document.getElementById(_id + '_video')
            let remoteVideoCanvas = document.getElementById(_id + '_canvas')
            if (remoteVideo != null && remoteVideoCanvas != null) {
                redrawVideoCanvas(remoteVideo, remoteVideoCanvas, this.clients[_id].texture)
            }
        }
    }

    releaseProjectionScreen(screenId) {
        this.projectionScreens.releaseProjectionScreen(screenId)
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

    onMouseMove(event) {
        // calculate mouse position in normalized device coordinates
        // (-1 to +1) for both components

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    }
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Utilities:

    /**
     * Returns a random number between min (inclusive) and max (exclusive)
     * https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range#1527820
     */
    randomRange(min, max) {
        return Math.random() * (max - min) + min
    }

    //==//==//==//==//==//==//==//==// fin //==//==//==//==//==//==//==//==//==//
}
