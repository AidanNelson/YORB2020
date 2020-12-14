import * as THREE from 'three'
import { makeVideoTextureAndMaterial, redrawVideoCanvas } from './utils'
import { mySocketID, shareScreen } from './index'

export class ProjectionScreens {
    constructor(scene, camera, mouse) {
        this.scene = scene
        this.camera = camera
        this.mouse = mouse

        // audio variables:
        this.volume = 0; // for lerping audioEl clicks
        this.distanceThresholdSquared = 500
        this.rolloffNumerator = 7

        this.screenIdIndex = 0

        this.projectionScreens = {} // object to store projection screens
        this.shift_down = false
        this.createBlankScreenVideo()
        // this.createProjectionScreens()

        this.raycaster = new THREE.Raycaster()

        // so that we can 'listen' for a shift-down
        let domElement = document.getElementById('scene-container')
        domElement.addEventListener('click', (e) => this.onMouseClick(e), false)
        window.addEventListener('keydown', (e) => this.onKeyDown(e), false)
        window.addEventListener('keyup', (e) => this.onKeyUp(e), false)
    }

    createBlankScreenVideo() {
        let blankScreenVideo = document.createElement('video')
        blankScreenVideo.setAttribute('id', 'default_screenshare')
        document.body.appendChild(blankScreenVideo)
        blankScreenVideo.src = require('../assets/images/old-television.mp4')
        blankScreenVideo.loop = true
        blankScreenVideo.muted = true // this is necessary so it is able to auto play
        blankScreenVideo.play()
    }

    createProjectionScreens() {
        let locations = {
            data: [
                {
                    room: 'classRoom1-left',
                    x: 2.8,
                    y: 1.9,
                    z: 27.309458609,
                    rot: Math.PI / 2,
                },
                {
                    room: 'classRoom1-right',
                    x: 2.8,
                    y: 1.9,
                    z: 22.123456,
                    rot: Math.PI / 2,
                },
                {
                    room: 'classRoom2-left',
                    x: 10.4,
                    y: 1.9,
                    z: 27.309458609,
                    rot: Math.PI / 2,
                },
                {
                    room: 'classRoom2-right',
                    x: 10.4,
                    y: 1.9,
                    z: 22.123456,
                    rot: Math.PI / 2,
                },
                {
                    room: 'classRoom3-left',
                    x: 18.0,
                    y: 1.9,
                    z: 27.309458609,
                    rot: Math.PI / 2,
                },
                {
                    room: 'classRoom3-right',
                    x: 18.0,
                    y: 1.9,
                    z: 22.123456,
                    rot: Math.PI / 2,
                },
                {
                    room: 'classRoom4-left',
                    x: 25.7,
                    y: 1.9,
                    z: 27.309458609,
                    rot: Math.PI / 2,
                },
                {
                    room: 'classRoom4-right',
                    x: 25.7,
                    y: 1.9,
                    z: 22.123456,
                    rot: Math.PI / 2,
                },
                { room: 'redSquare', x: -23.5, y: 1.9, z: -14.675, rot: Math.PI / 2 },
            ],
        }

        let num = locations.data.length

        for (let i = 0; i < num; i++) {
            let _id = 'screenshare' + this.screenIdIndex.toString()
            let dims = { width: 1920, height: 1080 }
            let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial(_id, dims)

            let screen = new THREE.Mesh(new THREE.BoxGeometry(5, (5 * 9) / 16, 0.01), videoMaterial)

            screen.position.set(locations.data[i].x, locations.data[i].y, locations.data[i].z)
            screen.rotateY(locations.data[i].rot)
            this.scene.add(screen)

            screen.userData = {
                videoTexture: videoTexture,
                activeUserId: 'default',
                screenId: _id,
                audioEl: false,
            }

            this.projectionScreens[_id] = screen
            this.screenIdIndex++
        }
    }

    addScreen(centerX, centerY, centerZ, lookAtX, lookAtY, lookAtZ, scaleFactor) {
        let _id = 'screenshare' + this.screenIdIndex.toString()

        let dims = { width: 1920, height: 1080 }
        let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial(_id, dims)
        console.log(scaleFactor)
        let screen = new THREE.Mesh(new THREE.BoxGeometry(5 * scaleFactor, (5 * scaleFactor * 9) / 16, 0.01), videoMaterial)

        screen.position.set(centerX, centerY, centerZ)
        screen.lookAt(lookAtX, lookAtY, lookAtZ)
        this.scene.add(screen)

        screen.userData = {
            videoTexture: videoTexture,
            activeUserId: 'default',
            screenId: _id,
        }

        this.projectionScreens[_id] = screen
        this.screenIdIndex++
    }

    projectToScreen(screenId) {
        console.log("I'm going to project to screen " + screenId)
        shareScreen(screenId)
        // this.projectionScreens[screenId].userData.activeUserId = mySocketID
    }

    assignProjectionScreen(screenId, clientId) {
        console.log('Assigning projection screen: ' + screenId + ' with to user ' + clientId)
        this.projectionScreens[screenId].userData.activeUserId = clientId
    }

    releaseProjectionScreen(screenId) {
        console.log('Releasing projection screen: ', screenId)
        this.projectionScreens[screenId].userData.activeUserId = 'default'
    }

    updatePositionalAudio() {
        for (let screenId in this.projectionScreens) {
            let screen = this.projectionScreens[screenId]
            let clientId = screen.userData.activeUserId;
            if (clientId === "default") continue;
            let audioEl = document.getElementById(`${clientId}_screenshareAudio`)
            if (audioEl) {
                let distSquared = this.camera.position.distanceToSquared(screen.position)
                if (distSquared > this.distanceThresholdSquared) {
                    // TODO pause consumer here, rather than setting volume to zero
                    audioEl.volume = 0
                } else {
                    // from lucasio here: https://discourse.threejs.org/t/positionalaudio-setmediastreamsource-with-webrtc-question-not-hearing-any-sound/14301/29
                    let volume = Math.min(1, this.rolloffNumerator / distSquared)
                    audioEl.volume = THREE.Math.lerp(this.volume, volume, 0.5)
                    this.volume = audioEl.volume
                }
            }
        }
    }


    update() {
        this.updateProjectionScreens()
    }

    /*
     * updateProjectionScreens()
     * This function will loop through all of the projection screens,
     * and update them if there is an active user and that user
     * is screensharing currently
     *
     */
    updateProjectionScreens() {
        for (let screenId in this.projectionScreens) {
            let screen = this.projectionScreens[screenId]
            let activeUserId = screen.userData.activeUserId
            let videoTexture = screen.userData.videoTexture

            let canvasEl = document.getElementById(`${screenId}_canvas`)
            let videoEl = document.getElementById(`${activeUserId}_screenshare`)

            if (videoEl != null && canvasEl != null) {
                redrawVideoCanvas(videoEl, canvasEl, videoTexture)
            }
        }
    }

    checkProjectionScreenCollisions() {
        this.raycaster.setFromCamera(this.mouse, this.camera)

        var intersects = this.raycaster.intersectObjects(Object.values(this.projectionScreens))

        // if we have intersections, highlight them
        let thresholdDist = 7
        if (intersects.length > 0) {
            if (intersects[0].distance < thresholdDist) {
                // this.screenHoverImage.style = "visiblity: visible;"
                let screen = intersects[0].object
                this.hightlightedScreen = screen
            } else {
                this.hightlightedScreen = null
            }
        } else {
            this.hightlightedScreen = null
        }
    }

    onMouseClick(e) {
        if (this.hightlightedScreen && this.shift_down) {
            this.projectToScreen(this.hightlightedScreen.userData.screenId)
            this.shift_down = false // reset this because the displayMedia dialog means we lose the onKeyUp event
        }
    }

    onKeyDown(e) {
        if (e.keyCode == 16) {
            this.shift_down = true
        }
    }

    onKeyUp(e) {
        if (e.keyCode == 16) {
            this.shift_down = false
        }
    }
}
