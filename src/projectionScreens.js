const THREE = require('./libs/three.min.js')
import { makeVideoTextureAndMaterial, redrawVideoCanvas } from './utils'
import { shareScreen } from './index'

export class ProjectionScreens {
    constructor(scene, camera) {
        this.scene = scene
        this.camera = camera

        this.projectionScreens = {} // object to store projection screens
        this.shift_down = false
        this.createBlankScreenVideo()
        this.createProjectionScreens()

        // so that we can 'listen' for a shift-down
        // let domElement = document.getElementById('scene-container')
        window.addEventListener('click', (e) => this.onMouseClick(e), false)
        window.addEventListener('keydown', (e) => this.onKeyDown(e), false)
        window.addEventListener('keyup', (e) => this.onKeyUp(e), false)
    }

    createBlankScreenVideo() {
        let blankScreenVideo = document.createElement('video')
        blankScreenVideo.setAttribute('id', 'default_screenshare')
        document.body.appendChild(blankScreenVideo)
        blankScreenVideo.src = '/images/old-television.mp4'
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
            let _id = 'screenshare' + i
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
            }

            this.projectionScreens[_id] = screen
        }
    }

    projectToScreen(screenId) {
        console.log("I'm going to project to screen " + screenId)
        shareScreen(screenId)
        this.projectionScreens[screenId].userData.activeUserId = this.mySocketID
    }

    updateProjectionScreen(config) {
        let screenId = config.screenId
        let activeUserId = config.activeUserId
        this.projectionScreens[screenId].userData.activeUserId = activeUserId
        console.log('Updating Projection Screen: ' + screenId + ' with screenshare from user ' + activeUserId)
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
        var matrix = new THREE.Matrix4()
        matrix.extractRotation(this.camera.matrix)
        var backwardDir = new THREE.Vector3(0, 0, 1).applyMatrix4(matrix)
        var forwardDir = backwardDir.clone().negate()

        // TODO more points around avatar so we can't be inside of walls
        let pt = this.camera.position.clone()

        let raycaster = new THREE.Raycaster()

        raycaster.set(pt, forwardDir)

        var intersects = raycaster.intersectObjects(Object.values(this.projectionScreens))

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
        }
    }

    onMouseClick(e) {
        console.log('click');
        if (this.hightlightedScreen && this.shift_down) {
            console.log('click');
            this.projectToScreen(this.hightlightedScreen.userData.screenId)
        }
    }

    onKeyDown(e) {
        if (e.keyCode == 16) {
            console.log('shiftdown');
            this.shift_down = true
        }
    }

    onKeyUp(e) {
        if (e.keyCode == 16) {
            this.shift_down = false
        }
    }
}
