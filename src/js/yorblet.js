import * as THREE from 'three'
import { projects } from '.'
import { create3DText, createSimpleText } from './utils'
import { hackToRemovePlayerTemporarily } from './index'
import { Vector3 } from 'three'
import { Portal } from './portals'

const project_thumbnails = require('../assets/images/project_thumbnails/winterShow2020/*.png')

// set which YORBLET we're in based on hostname
const hostname = window.location.hostname

let YORBLET_INDEX = 1

import debugModule from 'debug'
const log = debugModule('YORB:Yorblet')


if (hostname === 'yorblet1.itp.io') {
    YORBLET_INDEX = 1
} else if (hostname === 'yorblet2.itp.io') {
    YORBLET_INDEX = 2
} else if (hostname === 'yorblet3.itp.io') {
    YORBLET_INDEX = 3
} else if (hostname === 'yorblet4.itp.io') {
    YORBLET_INDEX = 4
} else if (hostname === 'yorblet5.itp.io') {
    YORBLET_INDEX = 5
} else if (hostname === 'yorblet6.itp.io') {
    YORBLET_INDEX = 6
}else if (hostname === 'yorbletsix.itp.io') {
    YORBLET_INDEX = 6
} else if (hostname === 'yorblet7.itp.io') {
    YORBLET_INDEX = 7
} else if (hostname === 'yorblet8.itp.io') {
    YORBLET_INDEX = 8
} else if (hostname === 'yorblet9.itp.io') {
    YORBLET_INDEX = 9
} else if (hostname === 'yorblet10.itp.io') {
    YORBLET_INDEX = 10
} else if (hostname === 'yorblet11.itp.io') {
    YORBLET_INDEX = 11
} else if (hostname === 'yorblet12.itp.io') {
    YORBLET_INDEX = 12
}
log('hostname:', hostname)
log('yorblet index:', YORBLET_INDEX)

// The alphabet (for project labels)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' // now i know by ABCs next time won't you sing with me
// pick colors
const OUTER_FENCE_COLOR = 0x232323 //0x232378
const ENTRANCE_COLOR = 0xf9f910
const STAGE_COLOR = 0x232323
const DOME_COLOR = 0x232323
const PROJECT_NUMBER_COLOR = 0xffffff

//sky colors -- same as fences
const SKY_COLOR_BLUE_ROOM = 0x1250CC;
const SKY_COLOR_PINK_ROOM = 0xe49add;
const SKY_COLOR_YELLOW_ROOM = 0xfd8f20;
const SKY_COLOR_GREEN_ROOM = 0x18DD6C;

//room colors
//all have two colors plus one accent color. all use accen colors that are main colors from other rooms except the greenn room
//blue
const COL_MAIN_BLUE = 0x4b4ff4
const COL_SECOND_BLUE = 0x05c1da
//accent: colmainPink = 0xfc3691
//COL_MAIN_BLUE, COL_SECOND_BLUE, COL_MAIN_PINK

//pink rooms
const COL_MAIN_PINK = 0xfc3691
const COL_SECOND_PINK = 0xfb69b9
const COL_MAIN_GREEN = 0x9be210
//accent: colmainGreen = 0x9be210
// COL_MAIN_PINK, COL_SECOND_PINK, COL_MAIN_GREEN

//yellow rooms
const COL_MAIN_YELLOW = 0xffd810
const COL_SECOND_YELLOW = 0xf4d01d
// accent: const colmainBlue = 0x4b4ff4
//COL_MAIN_YELLOW, COL_SECOND_YELLOW, COL_MAIN_BLUE


//green rooms
const COL_ACCENT_BLUE = 0x67D6B5;
const COL_SECOND_GREEN = 0x77E424;
const COL_ACCENT_YELLOW = 0xF9F912;
//
// COL_ACCENT_BLUE, COL_SECOND_GREEN, COL_ACCENT_YELLOW

// other parameters:
const NUMBER_OF_PROJECTS = 8
const RADIUS = 30
const FENCE_RADIUS = RADIUS + 10
const FENCE_HEIGHT = 12

export class Yorblet {
    constructor(scene, projectionScreenManager, mouse, camera, controls) {
        this.scene = scene
        this.mouse = mouse
        this.camera = camera
        this.projectionScreenManager = projectionScreenManager
        this.controls = controls

        //
        this.numProjects = NUMBER_OF_PROJECTS

        // we need some stuff to operate:
        this.raycaster = new THREE.Raycaster()
        this.textureLoader = new THREE.TextureLoader()
        this.textParser = new DOMParser()
        this.activeProjectId = -1

        // materials for the project podiums
        this.highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffff1a })
        this.linkMaterial = new THREE.MeshBasicMaterial({ color: 0xb3b3ff })
        this.linkVisitedMaterial = new THREE.MeshBasicMaterial({
            color: 0x6699ff,
        })
        this.statusBoxMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })

        //
        this.projects = []
        this.hyperlinkedObjects = []
        this.linkMaterials = {}

        window.addEventListener('click', (e) => this.onMouseClick(e), false)

        // finally, call the setup function:
        this.setup()

        //add portal back to lobby -- change position (2nd param) TODO
        this.portal = new Portal(this.scene, new Vector3(0, 0, 0), 0) //third param is index of lobby
    }

    setup() {
        //
        var loader = new THREE.FontLoader()
        let fontJSON = require('../assets/fonts/helvetiker_bold.json')
        this.font = loader.parse(fontJSON)
        this._updateProjects()

        this.addFloor()
        this.addOuterDecoration()

        // first create the exterior walls of the space
        this.createYorbletExterior()

        // then the stages and styling fo those stages
        this.createYorbletStages()

        // then add the individual project posters
        // this.createProjectPodiums()

        //style yorblet (sky and fence)
        this.styleYorblet()

        //add yorblet label
        this.createYorbletLabel()

        this.parachuteIn()
    }

    parachuteIn() {
        // PARACHUTE IS BACK...
        // Start us up high on the Y axis and outside a circular Yorblet
        var randX = 56 + Math.random() * 4
        var randZ = -2 + Math.random() * 4
        this.camera.position.set(randX, 100, randZ)
        this.camera.lookAt(0, 0, 0)
    }

    createYorbletExterior() {
        let fenceRadius = FENCE_RADIUS
        // add entrance:
        const geometry = new THREE.TorusBufferGeometry(12, 2, 16, 24, Math.PI)
        const material = new THREE.MeshBasicMaterial({ color: ENTRANCE_COLOR })
        const torus = new THREE.Mesh(geometry, material)
        this.scene.add(torus)
        torus.position.set(fenceRadius, 0, 0)
        torus.lookAt(0, 0, 0)

        //backside fence
        let fenceGeo = new THREE.BoxBufferGeometry(50, FENCE_HEIGHT, 0.1)
        let fenceMat = new THREE.MeshBasicMaterial({ color: OUTER_FENCE_COLOR, side: THREE.DoubleSide })
        let fenceMesh = new THREE.Mesh(fenceGeo, fenceMat)
        this.scene.add(fenceMesh)
        fenceMesh.position.set(-fenceRadius, 0, 0)
        fenceMesh.rotateY(Math.PI / 2)

        // side of entrance fences
        fenceGeo = new THREE.BoxBufferGeometry(20, FENCE_HEIGHT, 0.1)
        fenceMat = new THREE.MeshBasicMaterial({ color: OUTER_FENCE_COLOR, side: THREE.DoubleSide })
        fenceMesh = new THREE.Mesh(fenceGeo, fenceMat)
        this.scene.add(fenceMesh)
        fenceMesh.position.set(fenceRadius, 0, 20)
        fenceMesh.rotateY(Math.PI / 2)

        // side of entrance fences
        fenceGeo = new THREE.BoxBufferGeometry(20, FENCE_HEIGHT, 0.1)
        fenceMat = new THREE.MeshBasicMaterial({ color: OUTER_FENCE_COLOR, side: THREE.DoubleSide })
        fenceMesh = new THREE.Mesh(fenceGeo, fenceMat)
        this.scene.add(fenceMesh)
        fenceMesh.position.set(fenceRadius, 0, -20)
        fenceMesh.rotateY(Math.PI / 2)

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        // add left fence:
        let cylinderGeometry = new THREE.CylinderBufferGeometry(fenceRadius, fenceRadius, FENCE_HEIGHT, 32, 1, true, 0, Math.PI)
        let cylinderMaterial = new THREE.MeshPhongMaterial({ color: OUTER_FENCE_COLOR, side: THREE.DoubleSide })
        let cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(xOffset, 0, zOffset)
        cylinder.rotateY((-Math.PI * 1) / 2)
        this.scene.add(cylinder)

        xOffset = 0
        zOffset = -20

        // add right side fence
        cylinderGeometry = new THREE.CylinderBufferGeometry(fenceRadius, fenceRadius, FENCE_HEIGHT, 32, 1, true, 0, Math.PI)
        cylinderMaterial = new THREE.MeshPhongMaterial({ color: OUTER_FENCE_COLOR, side: THREE.DoubleSide })
        cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(xOffset, 0, zOffset)
        cylinder.rotateY((Math.PI * 1) / 2)
        this.scene.add(cylinder)
    }

    createYorbletLabel() {
        let labelRadius = FENCE_RADIUS

        // Draw Label in back of room on wall
        const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json')
        const font = new THREE.Font(fontJson)
        const text = 'Yorblet ' + YORBLET_INDEX.toString()

        const fontGeometry = new THREE.TextBufferGeometry(text, {
            font: font,
            size: 2.5,
            height: 0.01,
            curveSegments: 11,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.1,
            bevelSegments: 6,
        })

        const fontMaterial1 = new THREE.MeshBasicMaterial({ color: PROJECT_NUMBER_COLOR, flatShading: true })
        const fontMaterial2 = new THREE.MeshBasicMaterial({ color: OUTER_FENCE_COLOR, flatShading: true })
        const fontMesh = new THREE.Mesh(fontGeometry, [fontMaterial1, fontMaterial2])
        //alternate color0x787878

        let labelOffsetX = 2
        let labelOffsetY = 13
        let labelOffsetZ = 6

        fontMesh.position.set(-labelRadius + labelOffsetX, labelOffsetY, labelOffsetZ)
        fontMesh.lookAt(0, 2, 6)
        this.scene.add(fontMesh)
    }

    createYorbletStages() {
        let radius = RADIUS

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        let projectIndex = 1
        // make left side projects
        for (let i = 0; i < this.numProjects / 2; i++) {
            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = theta * i

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            this.addPresentationStage(projectIndex, centerX, centerZ, xOffset, zOffset, 1, angle)
            projectIndex++
        }

        xOffset = 0
        zOffset = -20

        // make right side projects
        for (let i = this.numProjects / 2 - 1; i < this.numProjects - 1; i++) {
            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = theta * i

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            this.addPresentationStage(projectIndex, centerX, centerZ, xOffset, zOffset, 1, angle)
            projectIndex++
        }
    }

    createBoltFence(fenceColor) {
        let radius = RADIUS

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        let projectIndex = 1
        // make left side projects
        for (let i = 0; i < this.numProjects * 2; i++) {
            let theta = (Math.PI * 2) / this.numProjects
            let angle = (theta * i) / 4

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            let scale = 1
            let centerY = 0
            let offsetX = 0 // how far to the circle's right
            let offsetY = 2 // how far to the circle's up-down
            let offsetZ = -4 // how far to the circle's forward-backward
            this.drawLightning(scale, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, xOffset, zOffset);

            projectIndex++
        }

        xOffset = 0
        zOffset = -25

        // make right side projects
        for (let i = this.numProjects / 2 - 1; i < (this.numProjects + 1) * 2; i++) {
            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = 2 + (theta * i) / 4

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset

            let scale = 1
            let centerY = 0
            let offsetX = 0 // how far to the circle's right
            let offsetY = 2 // how far to the circle's up-down
            let offsetZ = -4 // how far to the circle's forward-backward
            this.drawLightning(scale, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, xOffset, zOffset);

            projectIndex++
        }
    }

    createTriFence(fenceColor) {
        let radius = RADIUS

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        let projectIndex = 1
        // make left side projects
        for (let i = 0; i < this.numProjects * 2; i++) {
            let theta = (Math.PI * 2) / this.numProjects
            let angle = (theta * i) / 4

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            let scale = 0.05
            let centerY = 0
            let offsetX = 0 // how far to the circle's right
            let offsetY = 4 // how far to the circle's up-down
            let offsetZ = -4 // how far to the circle's forward-backward
            let lookAtX = 0
            let lookAtY = 2
            let lookAtZ = 0

            this.drawTri(scale, scale, scale, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ, -1.5708);

            projectIndex++
        }

        xOffset = 0
        zOffset = -25

        // make right side projects
        for (let i = this.numProjects / 2 - 1; i < (this.numProjects + 1) * 2; i++) {
            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = 2 + (theta * i) / 4

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset

            let scale = 0.05
            let centerY = 0
            let offsetX = 0 // how far to the circle's right
            let offsetY = 4 // how far to the circle's up-down
            let offsetZ = -4 // how far to the circle's forward-backward
            let lookAtX = 0
            let lookAtY = 2
            let lookAtZ = -1.5708

            this.drawTri(scale, scale, scale, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ, -1.5708)

            projectIndex++
        }
    }

    createRectFence(fenceColor) {
        let radius = RADIUS

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        let projectIndex = 1
        // make left side projects
        for (let i = 0; i < this.numProjects * 2; i++) {
            let theta = (Math.PI * 2) / this.numProjects
            let angle = (theta * i) / 4

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            let scale = 1
            let centerY = 0
            let offsetX = 0 // how far to the circle's right
            let offsetY = 2 // how far to the circle's up-down
            let offsetZ = -4 // how far to the circle's forward-backward
            let lookAtX = 0
            let lookAtZ = 0

            let rHeight = 1.5
            let rWidth = 1.5
            this.drawRect(rWidth, rHeight, 5, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

            projectIndex++
        }

        xOffset = 0
        zOffset = -25

        // make right side projects
        for (let i = this.numProjects / 2 - 1; i < (this.numProjects + 1) * 2; i++) {
            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = 2 + (theta * i) / 4

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            let scale = 1
            let centerY = 0
            let offsetX = 0 // how far to the circle's right
            let offsetY = 2 // how far to the circle's up-down
            let offsetZ = -4 // how far to the circle's forward-backward
            let lookAtX = 0
            let lookAtZ = 0

            let rHeight = 1.5
            let rWidth = 1.5
            this.drawRect(rWidth, rHeight, 5, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

            projectIndex++
        }
    }

    createCircleFence(fenceColor) {
        let radius = RADIUS

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        let projectIndex = 1
        // make left side projects
        for (let i = 0; i < this.numProjects * 2; i++) {
            let theta = (Math.PI * 2) / this.numProjects
            let angle = (theta * i) / 4

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            let scale = 1
            let centerY = 0
            let offsetX = 0 // how far to the circle's right
            let offsetY = 2 // how far to the circle's up-down
            let offsetZ = -4 // how far to the circle's forward-backward
            let lookAtX = 0
            let lookAtZ = 0
            let cRadius = 1
            //
            // let rHeight = 1.5;
            // let rWidth = 1.5;
            // this.drawRect(rWidth, rHeight, 5, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

            this.drawCircle(cRadius, 32, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

            projectIndex++
        }

        xOffset = 0
        zOffset = -25

        // make right side projects
        for (let i = this.numProjects / 2 - 1; i < (this.numProjects + 1) * 2; i++) {
            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = 2 + (theta * i) / 4

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            let scale = 1
            let centerY = 0
            let offsetX = 0 // how far to the circle's right
            let offsetY = 2 // how far to the circle's up-down
            let offsetZ = -4.9 // how far to the circle's forward-backward
            let lookAtX = 0
            let lookAtZ = 0
            let cRadius = 1

            // let rHeight = 1.5;
            // let rWidth = 1.5;
            // this.drawRect(rWidth, rHeight, 5, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

            this.drawCircle(cRadius, 32, fenceColor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

            projectIndex++
        }
    }

    // this will update the project posters
    createProjectPodiums() {
        let radius = RADIUS

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        let projectIndex = 0
        // make left side projects
        for (let i = 0; i < this.numProjects / 2; i++) {
            let proj = this.projects[projectIndex]
            if (!proj) return

            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = theta * i

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset

            let hyperlink = this.createHyperlinkedMesh(centerX, 1, centerZ, xOffset, zOffset, proj)
            this.hyperlinkedObjects.push(hyperlink)
            this.scene.add(hyperlink)

            projectIndex++
        }

        xOffset = 0
        zOffset = -20

        // make right side projects
        for (let i = this.numProjects / 2 - 1; i < this.numProjects - 1; i++) {
            let proj = this.projects[projectIndex]
            if (!proj) return

            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = theta * i

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset

            let hyperlink = this.createHyperlinkedMesh(centerX, 1, centerZ, xOffset, zOffset, proj)
            this.hyperlinkedObjects.push(hyperlink)
            this.scene.add(hyperlink)

            projectIndex++
        }
    }


    styleYorblet() {
            // style the area according to which YORBLET we are in
            if (YORBLET_INDEX === 1) {
                // do styling for yorblet 1
                this.addSky(SKY_COLOR_BLUE_ROOM);
                this.createCircleFence(SKY_COLOR_BLUE_ROOM);
            } else if (YORBLET_INDEX === 2) {
                // do styling for yorblet 2
                this.addSky(SKY_COLOR_PINK_ROOM);
                this.createRectFence(SKY_COLOR_PINK_ROOM);
            } else if (YORBLET_INDEX === 3) {
                // do styling for yorblet 3
                this.addSky(SKY_COLOR_YELLOW_ROOM);
                this.createTriFence(SKY_COLOR_YELLOW_ROOM);
            } else if (YORBLET_INDEX === 4) {
                // do styling for yorblet 4
                this.addSky(SKY_COLOR_GREEN_ROOM);
                this.createBoltFence(SKY_COLOR_GREEN_ROOM);
            } else if (YORBLET_INDEX === 5) { //PINK CIRCLE
                // do styling for yorblet 5
                this.addSky(SKY_COLOR_PINK_ROOM);
                this.createCircleFence(SKY_COLOR_PINK_ROOM);
            } else if (YORBLET_INDEX === 6) { // YELLOW SQUARE
                // do styling for yorblet 6
                this.addSky(SKY_COLOR_YELLOW_ROOM);
                this.createRectFence(SKY_COLOR_YELLOW_ROOM);
            } else if (YORBLET_INDEX === 7) { // GREEN TRIANGLE
                // do styling for yorblet 7
                this.addSky(SKY_COLOR_GREEN_ROOM);
                this.createTriFence(SKY_COLOR_GREEN_ROOM);
            } else if (YORBLET_INDEX === 8) { // PINK BOLT
                // do styling for yorblet 8
                this.addSky(SKY_COLOR_PINK_ROOM);
                this.createBoltFence(SKY_COLOR_PINK_ROOM);
            } else if (YORBLET_INDEX === 9) { // YELLOW CIRCLE
                // do styling for yorblet 8
                this.addSky(SKY_COLOR_YELLOW_ROOM);
                this.createCircleFence(SKY_COLOR_YELLOW_ROOM);
            } else if (YORBLET_INDEX === 10) { // BLUE SQUARE
                // do styling for yorblet 8
                this.addSky(SKY_COLOR_BLUE_ROOM);
                this.createRectFence(SKY_COLOR_BLUE_ROOM);
            }
            else if (YORBLET_INDEX === 11) { // BLUE TRIANGLE
                // do styling for yorblet 8
                this.addSky(SKY_COLOR_BLUE_ROOM);
                this.createTriFence(SKY_COLOR_BLUE_ROOM);
            }
            else if (YORBLET_INDEX === 12) { // GREEN CIRCLE
                // do styling for yorblet 12
                this.addSky(SKY_COLOR_GREEN_ROOM);
                this.createCircleFence(SKY_COLOR_GREEN_ROOM);
            }

    }

    addPresentationStage(projectIndex, centerX, centerZ, lookAtX, lookAtZ, scaleFactor = 1, angle) {
        // add the stage itself
        const cylinderGeometry = new THREE.CylinderBufferGeometry(3 * scaleFactor, 3 * scaleFactor, 1, 32, 1, false)
        const cylinderMaterial = new THREE.MeshPhongMaterial({ color: STAGE_COLOR, side: THREE.DoubleSide })
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(centerX, 0, centerZ)
        this.scene.add(cylinder)

        // style the area according to which YORBLET we are in

        if (YORBLET_INDEX === 1) { // BLUE CIRCLE
            // do styling for yorblet 1
            this.addCircleRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_MAIN_BLUE, COL_SECOND_BLUE,COL_MAIN_PINK )
        } else if (YORBLET_INDEX === 2) { // PINK SQUARE
            // do styling for yorblet 2
            this.addRectRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_MAIN_PINK, COL_SECOND_PINK, COL_MAIN_GREEN)
        } else if (YORBLET_INDEX === 3) { // YELLOW TRIANGLE
            // do styling for yorblet 3
            this.addTriRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_MAIN_YELLOW, COL_SECOND_YELLOW, COL_MAIN_BLUE)
        } else if (YORBLET_INDEX === 4) { // GREEN BOLT
            // do styling for yorblet 4
            this.addLightningRoom(centerX, centerZ, lookAtX, lookAtZ, COL_ACCENT_BLUE, COL_SECOND_GREEN, COL_ACCENT_YELLOW)
        } else if (YORBLET_INDEX === 5) { // PINK CIRCLE
            // do styling for yorblet 5
            this.addCircleRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_MAIN_PINK, COL_SECOND_PINK, COL_MAIN_GREEN)
        } else if (YORBLET_INDEX === 6) { // YELLOW SQUARE
            // do styling for yorblet 6
            this.addRectRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_MAIN_YELLOW, COL_SECOND_YELLOW, COL_MAIN_BLUE)
        } else if (YORBLET_INDEX === 7) { // GREEN TRIANGLE
            // do styling for yorblet 7
            this.addTriRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_ACCENT_BLUE, COL_SECOND_GREEN, COL_ACCENT_YELLOW)
        } else if (YORBLET_INDEX === 8) { // PINK BOLT
            // do styling for yorblet 8
            this.addLightningRoom(centerX, centerZ, lookAtX, lookAtZ, COL_MAIN_PINK, COL_SECOND_PINK, COL_MAIN_GREEN);
        } else if (YORBLET_INDEX === 9) { // YELLOW CIRCLE
            // do styling for yorblet 8
            this.addCircleRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_MAIN_YELLOW, COL_SECOND_YELLOW, COL_MAIN_BLUE )
        } else if (YORBLET_INDEX === 10) { // BLUE SQUARE
            // do styling for yorblet 8
            this.addRectRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_MAIN_BLUE, COL_SECOND_BLUE,COL_MAIN_PINK )
        }
        else if (YORBLET_INDEX === 11) { // BLUE SQUARE
            // do styling for yorblet 8
            this.addTriRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_MAIN_BLUE, COL_SECOND_BLUE,COL_MAIN_PINK)
        }
        else if (YORBLET_INDEX === 12) { // GREEN CIRCLE
            // do styling for yorblet 12
            this.addCircleRoom(centerX, centerZ, lookAtX, lookAtZ, angle, COL_ACCENT_BLUE, COL_SECOND_GREEN, COL_ACCENT_YELLOW )
        }

        // making a mini dome
        //https://threejsfundamentals.org/threejs/lessons/threejs-primitives.html
        //trying sphereGeometryconst radius = 7;
        const radius = 7
        const widthSegments = 12
        const heightSegments = 8
        const phiStart = Math.PI * 0
        const phiLength = Math.PI * 1
        const thetaStart = Math.PI * 0.0
        const thetaLength = Math.PI * 0.9
        const domeGeometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength)

        domeGeometry.scale(0.7, 0.7, 0.7)
        const domeMaterial = new THREE.MeshPhongMaterial({ color: DOME_COLOR, side: THREE.DoubleSide })
        const domeMesh = new THREE.Mesh(domeGeometry, domeMaterial)
        domeMesh.position.set(centerX, 1, centerZ)
        domeMesh.lookAt(lookAtX, 2, lookAtZ)
        domeMesh.translateZ(3)
        //domeMesh.translateY(-1)
        domeMesh.rotateY(Math.PI)
        this.scene.add(domeMesh)

        // Draw Label (placeholder for now) - make separate functionn?
        /// Font for numbers
        const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json')
        const font = new THREE.Font(fontJson)

        const projectLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        const index = YORBLET_INDEX.toString()
        const text = index + projectLetters[projectIndex - 1]

        const fontGeometry = new THREE.TextBufferGeometry(text, {
            font: font,
            size: 2.5,
            height: 0.01,
            curveSegments: 11,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.1,
            bevelSegments: 6,
        })

        const fontMaterial1 = new THREE.MeshBasicMaterial({ color: PROJECT_NUMBER_COLOR, flatShading: true })
        const fontMaterial2 = new THREE.MeshBasicMaterial({ color: OUTER_FENCE_COLOR, flatShading: true })
        const fontMesh = new THREE.Mesh(fontGeometry, [fontMaterial1, fontMaterial2])
        //alternate color0x787878

        let fontOffsetX = 3
        let fontOffsetY = 8
        let fontOffsetZ = -3
        fontMesh.position.set(centerX, 0, centerZ)

        // Check if this is the first stage in the group
        let firstStageCheck = projectIndex == 1 || projectIndex == this.numProjects/2 + 1
        // Check if this Yorblet is a bolt
        let yorbletBoltCheck = YORBLET_INDEX == 8 || YORBLET_INDEX == 4
        
        if (firstStageCheck && yorbletBoltCheck) {
          fontOffsetX = 5
          fontOffsetZ = 2
        }

        fontMesh.lookAt(lookAtX, 0, lookAtZ)
        fontMesh.translateX(fontOffsetX)
        fontMesh.translateY(fontOffsetY)
        fontMesh.translateZ(fontOffsetZ)
        this.scene.add(fontMesh)

        /// Font for back walls

        this.projectionScreenManager.addScreen(centerX, 2, centerZ, lookAtX, 2, lookAtZ, scaleFactor)
    }

    //circle version of fence
    addCircleRoom(centerX, centerZ, lookAtX, lookAtZ, angle, color1, color2, color3) {

        //draw the circles
        //center circle
        let offsetX = 0 // how far to the circle's right
        let offsetY = 0 // how far to the circle's up-down
        let offsetZ = -4.2 // how far to the circle's forward-backward
        let segments = 32;
        let radius = 6;
        this.drawCircle(radius, segments, color1, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = 5 // how far to the circle's right
        offsetY = 4.5 // how far to the circle's up-down
        offsetZ = -4.3 // how far to the circle's forward-backward
        radius = 3;
        this.drawCircle(radius, segments, color2, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = -6 // how far to the circle's right
        offsetY = 0.5 // how far to the circle's up-down
        offsetZ = -4 // how far to the circle's forward-backward
        radius = 2;
        this.drawCircle(radius, segments, color2, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = -4 // how far to the circle's right
        offsetY = 2 // how far to the circle's up-down
        offsetZ = -4.1 // how far to the circle's forward-backward
        radius = 1
        this.drawCircle(radius, segments, color3, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

    }

    addRectRoom(centerX, centerZ, lookAtX, lookAtZ, angle, color1, color2, color3) {


        //draw the rectangles

        //center rectangle
        let offsetX = 0 // how far to the circle's right
        let offsetY = 2 // how far to the circle's up-down
        let offsetZ = -4.5 // how far to the circle's forward-backward
        let segments = 32
        let rHeight = 10
        let rWidth = 10

        //drawRect(height, width, faces, matColor, posX, posY, posZ, offsetX, offsetY, offsetZ, lookAtX, lookatZ)

        this.drawRect(rWidth, rHeight, 5, color1, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = -8.5 // how far to the circle's right
        offsetY = 3 // how far to the circle's up-down
        offsetZ = -4.4 // how far to the circle's forward-backward
        rHeight = 4;
        rWidth = 4;
        this.drawRect(rWidth, rHeight, 5, color1, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = -7 // how far to the circle's right
        offsetY = 5 // how far to the circle's up-down
        offsetZ = -4.6 // how far to the circle's forward-backward
        rHeight = 5
        rWidth = 5
        // this.drawRect(rWidth, rHeight, 5, colmedPink, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = 6 // how far to the circle's right
        offsetY = 6 // how far to the circle's up-down
        offsetZ = -4.6 // how far to the circle's forward-backward
        rHeight = 6;
        rWidth = 8;
        this.drawRect(rWidth, rHeight, 5, color2, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = -6 // how far to the circle's right
        offsetY = 2 // how far to the circle's up-down
        offsetZ = -4.2 // how far to the circle's forward-backward
        rHeight = 3;
        rWidth = 3;
        this.drawRect(rWidth, rHeight, 5, color3, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)



    }

    addTriRoom(centerX, centerZ, lookAtX, lookAtZ, angle, color1, color2, color3) {
        //  drawTri(scaleX, scaleY, scaleZ, posX, posY, posZ, triColor, angle, rotateDegrees){


        //center triangle
        let offsetX = 2 // how far to the circle's right
        let offsetY = 6 // how far to the circle's up-down
        let offsetZ = -4.5 // how far to the circle's forward-backward
        let scaleX = .15;
        let scaleY = .15;
        let scaleZ = .15;
        let rotateDegrees = -1.5708;
        this.drawTri(scaleX, scaleY, scaleZ, color2, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ, rotateDegrees);


        offsetX = 2 // how far to the circle's right
        offsetY = 11 // how far to the circle's up-down
        offsetZ = -4.4 // how far to the circle's forward-backward
        scaleX = .15;
        scaleY = .15;
        scaleZ = .15;
        rotateDegrees = -1.5708;
        this.drawTri(scaleX, scaleY, scaleZ, color3, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ, rotateDegrees);


        offsetX = -4 // how far to the circle's right
        offsetY = 8 // how far to the circle's up-down
        offsetZ = -4.4 // how far to the circle's forward-backward
        scaleX = .4;
        scaleY = .4;
        scaleZ = .4;
        rotateDegrees = -1.5708;
        this.drawTri(scaleX, scaleY, scaleZ, color2, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ, rotateDegrees);


        offsetX = -5 // how far to the circle's right
        offsetY = 4 // how far to the circle's up-down
        offsetZ = -4.3 // how far to the circle's forward-backward
        scaleX = .1;
        scaleY = .1;
        scaleZ = .1;
        rotateDegrees = -1.5708;
        this.drawTri(scaleX, scaleY, scaleZ, color3, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ, rotateDegrees);

        offsetX = -6 // how far to the circle's right
        offsetY = 5 // how far to the circle's up-down
        offsetZ = -4.3 // how far to the circle's forward-backward
        scaleX = .1;
        scaleY = .1;
        scaleZ = .1;
        rotateDegrees = (-1.5708 * 3);
        this.drawTri(scaleX, scaleY, scaleZ, color1, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ, rotateDegrees);

    }

    addLightningRoom(centerX, centerZ, lookAtX, lookAtZ, color1, color2, color3){


      let scale = 6;
      let centerY = 4;

      let offsetX = 3;// how far to the circle's right
      let offsetY = 0;// how far to the circle's up-down
      let offsetZ = -4.8;// how far to the circle's forward-backward
      this.drawLightning(scale, color2, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ);


      //two
      scale = 2;
      centerY = 4;

      offsetX = 3;// how far to the circle's right
      offsetY = 2;// how far to the circle's up-down
      offsetZ = -4.5;// how far to the circle's forward-backward
      this.drawLightning(scale, color3, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ);


      //three
      scale = 5;
      centerY = 4;

      offsetX = -5;// how far to the circle's right
      offsetY = -1;// how far to the circle's up-down
      offsetZ = -4;// how far to the circle's forward-backward
      this.drawLightning(scale, color1, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ);


      //three
      // scale = 3;
      // centerY = 4;
      //
      // offsetX = -6;// how far to the circle's right
      // offsetY = 3;// how far to the circle's up-down
      // offsetZ = -3.8;// how far to the circle's forward-backward
      //this.drawLightning(scale, accentGreen, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ);

        //two
        // scale F= -3.8 // how far to the circle's forward-backward
        //this.drawLightning(scale, accentGreen, centerX, centerY, centerZ, offsetX, offsetY, offsetZ);

        // //SMALL FENCE
        // //four
        // scale = 1;
        // centerY = 4;
        //
        // offsetX = 6;// how far to the circle's right
        // offsetY = -3;// how far to the circle's up-down
        // offsetZ = -4;// how far to the circle's forward-backward
        // this.drawLightning(scale, collightGreen, centerX, centerY, centerZ, offsetX, offsetY, offsetZ);
        //
        // //five
        // scale = 1;
        // centerY = 4;
        //
        // offsetX = 10;// how far to the circle's right
        // offsetY = -3.5;// how far to the circle's up-down
        // offsetZ = -4;// how far to the circle's forward-backward
        // this.drawLightning(scale, collightGreen, centerX, centerY, centerZ, offsetX, offsetY, offsetZ);
        //
        // //five
        // scale = 1;
        // centerY = 4;
        //
        // offsetX = 14;// how far to the circle's right
        // offsetY = -3;// how far to the circle's up-down
        // offsetZ = -4;// how far to the circle's forward-backward
        // this.drawLightning(scale, collightGreen, centerX, centerY, centerZ, offsetX, offsetY, offsetZ);
        //
        //
        // //six
        // scale = 1;
        // centerY = 4;
        //
        // offsetX = 18;// how far to the circle's right
        // offsetY = -3.5;// how far to the circle's up-down
        // offsetZ = -4;// how far to the circle's forward-backward
        // this.drawLightning(scale, collightGreen, centerX, centerY, centerZ, offsetX, offsetY, offsetZ);
    }

    addSky(skyColor) {
        //SKY
        const centerGeometry = new THREE.SphereGeometry(200, 32, 32)
        const centerMaterial = new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.DoubleSide })
        const center = new THREE.Mesh(centerGeometry, centerMaterial)
        center.position.set(0, 0, 0)
        this.scene.add(center)

        //label (not enabled currently)
        const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json')
        const font = new THREE.Font(fontJson)

        const text = 'Room Name'

        const fontGeometry = new THREE.TextBufferGeometry(text, {
            font: font,
            size: 2,
            height: 0.01,
            curveSegments: 11,
            bevelEnabled: true,
            bevelThickness: 0.01,
            bevelSize: 0.01,
            bevelSegments: 1,
        })

        const fontMaterial = new THREE.MeshPhongMaterial({ color: 0xc6fc03, flatShading: true })
        const fontMesh = new THREE.Mesh(fontGeometry, fontMaterial)
        fontMesh.position.set(-1, 2, 0)
        fontMesh.rotateY(Math.PI / 2)

        //this.scene.add(fontMesh)
    }

    ///// Shape Helper Functions /////

    //draw circles

    drawCircle(radius, numFaces, matColor, posX, posY, posZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ) {
        const circlegeometry = new THREE.CircleGeometry(radius, numFaces)
        const circlematerial = new THREE.MeshBasicMaterial({ color: matColor, side: THREE.DoubleSide })
        const circle = new THREE.Mesh(circlegeometry, circlematerial)

        // set circle position and lookAt
        circle.position.set(posX, posY, posZ)
        circle.lookAt(lookAtX, 0, lookAtZ)

        // offsets within object space (i.e. from the circles point of view)
        circle.translateX(offsetX)
        circle.translateY(offsetY)
        circle.translateZ(offsetZ)

        this.scene.add(circle)
    }

    // Draw Square

    drawRect(height, width, faces, matColor, posX, posY, posZ, offsetX, offsetY, offsetZ, lookAtX, lookatZ) {
        //plane  1
        const planegeometry = new THREE.PlaneBufferGeometry(height, width, faces)
        const planematerial = new THREE.MeshBasicMaterial({ color: matColor, side: THREE.DoubleSide })
        const plane = new THREE.Mesh(planegeometry, planematerial)

        //set position and lookat
        plane.position.set(posX, posY, posZ)
        plane.lookAt(lookAtX, 0, lookatZ)

        //offset in space
        plane.translateX(offsetX)
        plane.translateY(offsetY)
        plane.translateZ(offsetZ)

        this.scene.add(plane)
    }

    // Draw Triangles
    drawTri(scaleX, scaleY, scaleZ, matColor, posX, posY, posZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ, rotateDegrees) {
        var triangleGeometry = new THREE.Geometry()
        var v1 = new THREE.Vector3(0, 0, 0)
        var v2 = new THREE.Vector3(30, 0, 0)
        var v3 = new THREE.Vector3(30, 30, 0)

        var triangle = new THREE.Triangle(v1, v2, v3)
        var normal = triangle.normal()

        // An example of getting the area from the Triangle class
        //log( 'Area of triangle is: '+ triangle.area() );

        triangleGeometry.vertices.push(triangle.a)
        triangleGeometry.vertices.push(triangle.b)
        triangleGeometry.vertices.push(triangle.c)
        triangleGeometry.faces.push(new THREE.Face3(0, 1, 2, normal))
        triangleGeometry.scale(scaleX, scaleY, scaleZ)

        //geom.scale(new THREE.Vector3(2,2,2));
        const trianglematerial = new THREE.MeshBasicMaterial({ color: matColor, side: THREE.DoubleSide })
        var triangleMesh = new THREE.Mesh(triangleGeometry, trianglematerial)

        //set position and look at and rotate
        triangleMesh.position.set(posX, posY, posZ)
        triangleMesh.lookAt(lookAtX, 0, lookAtZ)

        //offset in space
        triangleMesh.translateX(offsetX)
        triangleMesh.translateY(offsetY)
        triangleMesh.translateZ(offsetZ)

        triangleMesh.rotateZ(rotateDegrees)

        this.scene.add(triangleMesh)
    }

    drawLightning(scale, matcolor, centerX, centerY, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ){

      //draw lightning
      const x = 0, y = 0;

      const lightningBolt = new THREE.Shape();

        lightningBolt.moveTo(x, y)
        lightningBolt.lineTo(x + 0.5, y)
        lightningBolt.lineTo(x + 1.25, y + 1.25)
        lightningBolt.lineTo(x + 0.75, y + 1.25)
        lightningBolt.lineTo(x + 1.25, y + 2)
        lightningBolt.lineTo(x + 0.5, y + 2)
        lightningBolt.lineTo(x, y + 0.75)
        lightningBolt.lineTo(x + 0.5, y + 0.75)
        lightningBolt.lineTo(x + 0.1, y)

        const geometry = new THREE.ShapeGeometry(lightningBolt)
        const material = new THREE.MeshBasicMaterial({ color: matcolor })
        const lightningMesh = new THREE.Mesh(geometry, material)

        //set position and look at and rotate
        lightningMesh.position.set(centerX, centerY, centerZ)
        lightningMesh.lookAt(0, 2, 0)

        //offset in space
        lightningMesh.translateX(offsetX)
        lightningMesh.translateY(offsetY)
        lightningMesh.translateZ(offsetZ)

        lightningMesh.scale.set(scale, scale, scale)

        this.scene.add(lightningMesh)
    }

    //lay out some random big objects in the distance
    addOuterDecoration() {
        //
        // let geo = new THREE.BoxBufferGeometry(20, 120, 30)
        // let mat = new THREE.MeshLambertMaterial({ color: 'hotpink' })
        // mat.flatShading = true
        // let mesh = new THREE.Mesh(geo, mat)
        // this.scene.add(mesh)
        // mesh.position.set(-70, 20, 120)
        // mesh.rotateX(-0.25)

        // geo = new THREE.BoxBufferGeometry(10, 30, 80)
        // mat = new THREE.MeshLambertMaterial({ color: 'darkblue' })
        // mat.flatShading = true
        // mesh = new THREE.Mesh(geo, mat)
        // this.scene.add(mesh)
        // mesh.position.set(70, 60, -120)

        // geo = new THREE.ConeBufferGeometry(10, 200, 4)
        // mat = new THREE.MeshLambertMaterial({ color: 'red' })
        // mat.flatShading = true
        // mesh = new THREE.Mesh(geo, mat)
        // this.scene.add(mesh)
        // mesh.position.set(-30, 0, -90)
        // mesh.rotateY(3);

        //cone
        const coneGeometry = new THREE.ConeBufferGeometry(30, 40, 6)
        const coneEdges = new THREE.EdgesGeometry(coneGeometry)
        const coneLine = new THREE.LineSegments(coneEdges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1, linecap: 'round' }))

        coneLine.position.set(80, 60, -100)
        coneLine.rotateY(3)
        this.scene.add(coneLine)

        //octahedron
        const octGeometry = new THREE.OctahedronBufferGeometry(15)
        const octEdges = new THREE.EdgesGeometry(octGeometry)
        const octLine = new THREE.LineSegments(octEdges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1, linecap: 'round' }))

        octLine.position.set(-30, 50, -90)
        octLine.rotateZ(6)
        this.scene.add(octLine)

        //box
        const boxGeometry = new THREE.BoxBufferGeometry(120, 30, 30)
        const boxEdges = new THREE.EdgesGeometry(boxGeometry)
        const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0xffffff }))

        boxLine.position.set(-70, 60, 120)
        boxLine.rotateZ(3)
        boxLine.rotateX(3)
        this.scene.add(boxLine)

        //cyllinder
        const cylGeometry = new THREE.CylinderBufferGeometry(20, 20, 3, 9)
        const cylEdges = new THREE.EdgesGeometry(cylGeometry)
        const cylLine = new THREE.LineSegments(cylEdges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1, linecap: 'round' }))

        cylLine.position.set(70, 60, 90)
        this.scene.add(cylLine)

        //ring
        const ringGeometry = new THREE.RingBufferGeometry(20, 10, 32)
        const ringEdges = new THREE.EdgesGeometry(ringGeometry)
        const ringLine = new THREE.LineSegments(ringEdges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1, linecap: 'round' }))

        ringLine.position.set(-100, 50, 0)
        ringLine.rotateX(2)
        this.scene.add(ringLine)
    }

    addFloor() {
        // add the ITP floor
        const floorTexture = new THREE.TextureLoader().load(require('../assets/images/textures/floor.jpg'))
        floorTexture.wrapS = THREE.RepeatWrapping
        floorTexture.wrapT = THREE.RepeatWrapping
        floorTexture.repeat.set(40, 40)

        const floorGeometry = new THREE.PlaneBufferGeometry(512, 512, 1, 1)
        const floorMaterial = new THREE.MeshPhongMaterial({ map: floorTexture, side: THREE.DoubleSide })
        const plane = new THREE.Mesh(floorGeometry, floorMaterial)
        plane.lookAt(0, 1, 0)
        this.scene.add(plane)
    }

    /*
     * createHyperlinkedMesh(x,y,z,_project)
     *
     * Description:
     * 	- creates an object3D for each project at position x,y,z
     *	- adds _project as userData to the object3D
     *	- returns object3D
     */

    createHyperlinkedMesh(x, y, z, lookAtX, lookAtZ, _project) {
        let linkDepth = 0.1
        let fontColor = 0x343434
        let statusColor = 0xffffff
        let fontSize = 0.05

        var geometry = new THREE.BoxGeometry(linkDepth, 0.75, 0.75)
        var textBoxGeometry = new THREE.BoxGeometry(linkDepth, 0.5, 0.75)

        let textBoxMat

        // check whether we've visited the link before and set material accordingly
        if (localStorage.getItem(_project.project_id) == 'visited') {
            textBoxMat = this.linkVisitedMaterial
        } else {
            textBoxMat = this.linkMaterial
        }

        let tex
        if (project_thumbnails[_project.project_id]) {
            tex = this.textureLoader.load(project_thumbnails[_project.project_id])
        } else {
            tex = this.textureLoader.load(project_thumbnails['0000']) // default texture
        }
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(1, 1)

        let imageMat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: tex,
        })

        this.linkMaterials[_project.project_id.toString()] = imageMat

        var textSign = new THREE.Mesh(textBoxGeometry, textBoxMat)
        var imageSign = new THREE.Mesh(geometry, imageMat)

        // parse text of name and add line breaks if necessary
        var name = this.parseText(_project.project_name)
        if (name.length > 15) {
            name = this.addLineBreak(name)
        }

        // create name text mesh
        var textMesh = createSimpleText(name, fontColor, fontSize, this.font)

        textMesh.position.x += linkDepth / 2 + 0.01 // offset forward
        textMesh.rotateY(Math.PI / 2)

        imageSign.position.set(x, y, z)
        textSign.position.set(0, -0.75 / 2 - 0.5 / 2, 0)
        textSign.add(textMesh)
        imageSign.add(textSign)

        // parse zoom room status
        // var status_code = _project.zoom_status
        // let status = ''
        // // status_code = 1;
        // if (status_code == '1') {
        //     var statusBoxGemoetry = new THREE.BoxGeometry(linkDepth, 0.125, 0.5)
        //     var statusSign = new THREE.Mesh(statusBoxGemoetry, this.statusBoxMaterial)
        //     status = 'Live now!'
        //     var statusTextMesh = createSimpleText(status, statusColor, fontSize, this.font)
        //     statusTextMesh.position.x += linkDepth / 2 + 0.01
        //     statusTextMesh.position.y -= 0.0625
        //     statusTextMesh.rotateY(Math.PI / 2)
        //     statusSign.add(statusTextMesh)
        //     statusSign.position.y += 0.25
        //     statusSign.position.x += 0.01

        //     imageSign.add(statusSign)
        // }

        // https://stackoverflow.com/questions/24690731/three-js-3d-models-as-hyperlink/24692057
        let now = Date.now()
        imageSign.userData = {
            project: _project,
            lastVisitedTime: now,
        }

        imageSign.name = _project.project_id

        imageSign.lookAt(lookAtX, 1.5, lookAtZ)
        imageSign.rotateY(-Math.PI / 2)
        imageSign.translateZ(2)
        imageSign.translateX(7)
        imageSign.translateY(0.25)

        let pedestalGeo = new THREE.CylinderBufferGeometry(0.5, 0.65, 1, 12)
        let pedestalMat = new THREE.MeshBasicMaterial({ color: 0x232323, flatShading: true, side: THREE.DoubleSide })
        let pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat)
        // let pedestalGeoBigger = new THREE.CylinderBufferGeometry(0.5 + 0.01, 0.65+ 0.01, 1+ 0.01, 12)
        // const wireframe = new THREE.WireframeGeometry(pedestalGeoBigger)
        // const line = new THREE.LineSegments(wireframe)

        // line.material.depthTest = true
        // line.material.opacity = 0.25
        // line.material.transparent = false

        imageSign.add(pedestalMesh)
        // pedestalMesh.add(line);
        pedestalMesh.position.set(0, -1.5, 0)

        return imageSign
    }

    /*
     * updateProjects(projects)
     *
     * Description:
     * 	- empties out the existing projects array and any existing hyperlink objects within it
     * 	- creates XYZ locations for each of the new project hyperlinks
     * 	- calls this.createHyperlinkedMesh for each project in the projects array
     * 	- places returned objects in this.hyperlinkedObjects array and adds them to the scene
     *
     */
    updateProjects(projects) {
        this.projects = projects
        this._updateProjects()
    }

    _updateProjects() {
        if (this.font) {
            let projects = this.projects

            for (let i = 0; i < this.hyperlinkedObjects.length; i++) {
                this.scene.remove(this.hyperlinkedObjects[i])
            }
            this.hyperlinkedObjects = []

            // do a check for duplicates
            let dupeCheck = {}
            let numUniqueProjects = 0

            let uniqueProjects = []

            // do a duplicate check
            for (let projectIndex = 0; projectIndex < projects.length; projectIndex++) {
                let proj = projects[projectIndex]
                if (proj) {
                    let project_id = proj.project_id

                    if (dupeCheck[project_id]) {
                        // log('Duplicate with ID: ', proj.project_id);
                    } else {
                        dupeCheck[project_id] = true
                        numUniqueProjects++
                        uniqueProjects.push(proj)
                    }
                }
            }
            log('Number of total projects: ', this.projects.length)
            // log('Number of unique projects: ', numUniqueProjects)

            // sort the array of incoming projects by position_id:
            log(this.projects)
            try {
                this.projects.sort((a, b) => {
                    if (a.position_id < b.position_id) {
                        return -1
                    }
                    if (a.position_id > b.position_id) {
                        return 1
                    }
                })
            } catch (e) {
                console.error(e)
            }
            log('sorting')
            log(this.projects)

            this.createProjectPodiums()

            // then plae all of the unique projects
            // for (let i = 0; i < uniqueProjects.length; i++) {
            //     let proj = uniqueProjects[i]
            //     let locX = -23.55
            //     let locZ = -80 + i * 1
            //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
            //     this.hyperlinkedObjects.push(hyperlink)
            //     this.scene.add(hyperlink)
            // }

            // log("We've placed ", endIndex, ' projects so far.')
        }
    }

    // this decodes the text twice because the project database seems to be double wrapped in html...
    // https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript
    parseText(encodedStr) {
        var dom = this.textParser.parseFromString('<!doctype html><body>' + encodedStr, 'text/html')
        var decodedString = dom.body.textContent
        var dom2 = this.textParser.parseFromString('<!doctype html><body>' + decodedString, 'text/html')
        var decodedString2 = dom2.body.textContent
        return decodedString2
    }

    addLineBreak(longString) {
        let spaceIndex = longString.indexOf(' ', 10)
        if (spaceIndex != -1) {
            let firstHalf = longString.slice(0, spaceIndex)
            let secondHalf = longString.slice(spaceIndex, longString.length)
            if (secondHalf.length > 15) {
                secondHalf = this.addLineBreak(secondHalf)
            }
            return firstHalf.trim() + '\n' + secondHalf.trim()
        } else {
            return longString
        }
    }

    /*
     * generateProjectModal(project)
     *
     * Description:
     * 	- generates a modal pop up for a given project object
     * 	- project objects look like this:
     *		{
     *			"project_id": "1234",
     *			"project_name": "Cats",
     *			"elevator_pitch": "Cats are loving companions for now and all time.",
     *			"description": "Cats is about building a sustainable online community for earth humans.",
     *			"zoom_link": "http://example.com"
     *		}
     *
     */
    zoomStatusDecoder(status) {
        if (status == '0') {
            return 'Currently Offline'
        } else if (status == '1') {
            return 'Currently Live'
        } else if (status == '2') {
            return 'Project Creator Will Be Right Back'
        } else if (status == '3') {
            return 'Room Full Try Again Soon'
        } else {
            return ''
        }
    }
    generateProjectModal(project) {
        // parse project descriptions to render without &amp; etc.
        // https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript

        if (!document.getElementsByClassName('project-modal')[0]) {
            this.controls.pause()
            localStorage.setItem(project.project_id, 'visited')

            let id = project.project_id
            let name = project.project_name
            let pitch = project.elevator_pitch
            let description = project.description
            let link = project.zoom_link
            let room_status = this.zoomStatusDecoder(project.zoom_status)

            let modalEl = document.createElement('div')
            modalEl.className = 'project-modal'
            modalEl.id = id + '_modal'

            let contentEl = document.createElement('div')
            contentEl.className = 'project-modal-content'

            let closeButton = document.createElement('button')
            closeButton.addEventListener('click', () => {
                modalEl.remove()
                // https://stackoverflow.com/questions/19426559/three-js-access-scene-objects-by-name-or-id
                let now = Date.now()
                let link = this.scene.getObjectByName(id)
                link.userData.lastVisitedTime = now
                this.controls.resume()
                setTimeout(() => {
                    this.activeProjectId = -1
                }, 100) // this helps reset without reopening the modal
            })
            closeButton.innerHTML = 'X'

            let projectImageEl = document.createElement('img')
            let filename = 'https://itp.nyu.edu' + project.image
            // let filename = "images/project_thumbnails/" + project.project_id + ".png";
            projectImageEl.src = filename
            projectImageEl.className = 'project-modal-img'

            let titleEl = document.createElement('h1')
            titleEl.innerHTML = this.parseText(name)
            titleEl.className = 'project-modal-title'

            // names
            let names = ''
            for (let i = 0; i < project.users.length; i++) {
                names += project.users[i].user_name
                if (i < project.users.length - 1) {
                    names += ' & '
                }
            }
            let namesEl = document.createElement('p')
            namesEl.innerHTML = names
            namesEl.className = 'project-modal-names'

            let elevatorPitchHeaderEl = document.createElement('p')
            elevatorPitchHeaderEl.innerHTML = 'Elevator Pitch'
            let elevatorPitchEl = document.createElement('p')
            elevatorPitchEl.innerHTML = this.parseText(pitch)
            elevatorPitchEl.className = 'project-modal-text'

            let descriptionHeaderEl = document.createElement('p')
            descriptionHeaderEl.innerHTML = 'Description'
            let descriptionEl = document.createElement('p')
            descriptionEl.innerHTML = this.parseText(description)
            descriptionEl.className = 'project-modal-text'

            let talkToCreatorDiv = document.createElement('div')
            talkToCreatorDiv.className = 'project-modal-links-header'
            talkToCreatorDiv.innerHTML = 'Learn more about the project:'

            let linksDiv = document.createElement('div')
            linksDiv.className = 'project-modal-link-container'

            let projectLinkEl = document.createElement('a')
            // projectLinkEl.href = link;
            projectLinkEl.href = project.url
            projectLinkEl.innerHTML = 'Project Website'
            projectLinkEl.target = '_blank'
            projectLinkEl.rel = 'noopener noreferrer'

            // let zoomLinkEl = document.createElement('a')
            // // zoomLinkEl.href = link
            // zoomLinkEl.href = link
            // zoomLinkEl.innerHTML = 'Zoom Room - ' + room_status
            // zoomLinkEl.target = '_blank'
            // zoomLinkEl.rel = 'noopener noreferrer'

            linksDiv.appendChild(projectLinkEl)
            // linksDiv.innerHTML += '&nbsp;&nbsp;&nbsp;*&nbsp;&nbsp;&nbsp;'
            // linksDiv.appendChild(zoomLinkEl)

            contentEl.appendChild(closeButton)
            contentEl.appendChild(projectImageEl)
            contentEl.appendChild(titleEl)
            contentEl.appendChild(namesEl)
            contentEl.appendChild(elevatorPitchHeaderEl)
            contentEl.appendChild(elevatorPitchEl)
            contentEl.appendChild(descriptionHeaderEl)
            contentEl.appendChild(descriptionEl)
            contentEl.appendChild(talkToCreatorDiv)
            contentEl.appendChild(linksDiv)

            modalEl.appendChild(contentEl)
            document.body.appendChild(modalEl)
        }
    }

    /*
     * highlightHyperlinks()
     *
     * Description:
     * 	- checks distance between player and object3Ds in this.hyperlinkedObjects array,
     * 	- calls this.generateProjectModal for any projects under a threshold distance
     *
     */
    highlightHyperlinks() {
        let thresholdDist = 5
        let now = Date.now()

        // log(this.hyperlinkedObjects);

        // store reference to last highlighted project id
        let lastHighlightedProjectId = this.hightlightedProjectId

        // cast ray out from camera
        this.raycaster.setFromCamera(this.mouse, this.camera)

        var intersects = this.raycaster.intersectObjects(this.hyperlinkedObjects)

        // if we have intersections, highlight them
        if (intersects.length > 0) {
            if (intersects[0].distance < thresholdDist) {
                let link = intersects[0].object
                this.hightlightedProjectId = link.userData.project.project_id
                // do styling
                this.highlightLink(link)
            }
        }

        // if we've changed which project is highlighted
        if (lastHighlightedProjectId != this.hightlightedProjectId) {
            let link = this.scene.getObjectByName(lastHighlightedProjectId)
            if (link != null) {
                // reset styling
                this.resetLinkMaterial(link)
            }
        } else {
            // no change, so lets check for
            let link = this.scene.getObjectByName(this.hightlightedProjectId)
            if (link != null) {
                if (now - link.userData.lastVisitedTime > 500) {
                    // reset styling
                    this.hightlightedProjectId = -1
                    this.resetLinkMaterial(link)
                }
            }
        }
    }

    highlightLink(link) {
        let now = Date.now()
        link.userData.lastVisitedTime = now
        link.userData.highlighted = true

        link.children[0].material = this.highlightMaterial
        link.scale.set(1.1, 1.1, 1.1)
    }

    resetLinkMaterial(link) {
        link.scale.set(1, 1, 1)
        // reset according to whether we have visited it or not yet
        let mat
        // check whether we've visited the link before and set material accordingly
        if (localStorage.getItem(link.userData.project.project_id) == 'visited') {
            mat = this.linkVisitedMaterial
        } else {
            mat = this.linkMaterial
        }
        // log(link);
        link.children[0].material = mat
    }

    activateHighlightedProject() {
        if (this.hightlightedProjectId != -1 && this.activeProjectId === -1) {
            let link = this.scene.getObjectByName(this.hightlightedProjectId)
            if (link != null) {
                this.generateProjectModal(link.userData.project)
                // hackToRemovePlayerTemporarily() // don't remove player in yorblets

                // reset markers
                this.activeProjectId = link.userData.project.project_id
            }
        }
    }

    update() {
        if (this.activeProjectId == -1) {
            this.highlightHyperlinks()
        }
    }

    onMouseClick(e) {
        this.activateHighlightedProject()
    }
}
