import * as THREE from 'three'

import { createSimpleText } from './utils'
import { hackToRemovePlayerTemporarily } from './index.js'
import { Vector3 } from 'three'
import { Portal } from './portals'
//import { Signage } from './signage'

const project_thumbnails = require('../assets/images/project_thumbnails/winterShow2020/*.png')

import debugModule from 'debug'

const log = debugModule('YORB:WinterShow')

const yorbletPortalReference = [
    //for portal creation, needs scene, position, and index
    null, //skips 0 because that's lobby
    { position: new Vector3(-17.58448391833718, 0.4829430999951536, -70.72890305508787) }, //yorblet 1 -- these six are in north side
    // { position: new Vector3(-23, 0, 7) },
    // { position: new Vector3(-23, 0, 4.5) },
    // { position: new Vector3(-23, 0, 2) },
    // { position: new Vector3(-23, 0, -0.5) },
    // { position: new Vector3(-23, 0, -3) }, 
    // { position: new Vector3(-23, 0, -35) }, //these six are in south side
    // { position: new Vector3(-23, 0, -37.5) },
    // { position: new Vector3(-23, 0, -40) },
    // { position: new Vector3(-23, 0, -42.5) },
    // { position: new Vector3(-23, 0, -45) },
    // { position: new Vector3(-23, 0, -47.5) }
]

export class Adler2021 {
    constructor(scene, camera, controls, mouse) {
        this.scene = scene
        this.camera = camera
        this.controls = controls
        this.mouse = mouse

        this.hightlightedProjectId = -1
        this.activeProjectId = -1 // will change to project ID if a project is active

        // we need some stuff to operate:
        this.raycaster = new THREE.Raycaster()
        this.textureLoader = new THREE.TextureLoader()
        this.textParser = new DOMParser()

        this.highlightMaterial = new THREE.MeshLambertMaterial({ color: 0xffff1a })
        this.linkMaterial = new THREE.MeshLambertMaterial({ color: 0xb3b3ff })
        this.linkVisitedMaterial = new THREE.MeshLambertMaterial({
            color: 0x6699ff,
        })
        this.statusBoxMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 })

        this.projects = []
        this.hyperlinkedObjects = []
        this.linkMaterials = {}

        this.portals = []

        // let domElement = document.getElementById('scene-container')
        window.addEventListener('click', (e) => this.onMouseClick(e), false)
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Interactable Hyperlinks for Spring Show 💎

    setup() {
        var loader = new THREE.FontLoader()
        let fontJSON = require('../assets/fonts/helvetiker_bold.json')
        this.font = loader.parse(fontJSON)
        //this._updateProjects()
        //this.addPortals()
        //this.addDecals();
        //var signage = new Signage(this.scene);
        //this.addArrowSigns();
    }


    addDecals(){

      //add welcome sign
        const welcomeTexture = new THREE.TextureLoader().load(require('../assets/images/decals/welcome_sign_export_4x.png'));
        const tipsTexture = new THREE.TextureLoader().load(require('../assets/images/decals/tips_export_4x.png'));
        const mapTexture = new THREE.TextureLoader().load(require('../assets/images/decals/full_map_export_1x_new.png'));

        //add welcome poster
        let posterX = -6.5
        let posterY = 1.6
        let posterZ = -7.25

        let posterRotation = 1.5708*2

        welcomeTexture.wrapS = THREE.RepeatWrapping
        welcomeTexture.wrapT = THREE.RepeatWrapping
        welcomeTexture.repeat.set(1, 1)

        const signGeometry = new THREE.PlaneBufferGeometry(2.7, 2, 1, 1)
        const signMaterial = new THREE.MeshBasicMaterial({ map: welcomeTexture, transparent: true})
        const signPlane = new THREE.Mesh(signGeometry, signMaterial)
        //plane.lookAt(0, 1, 0)
        signPlane.position.set(posterX, posterY, posterZ)
        signPlane.rotateY(posterRotation)
        this.scene.add(signPlane)

        //add tips poster
        posterX = -9.5
        posterY = 1.65
        posterZ = -7.25

        posterRotation = 1.5708*2

        tipsTexture.wrapS = THREE.RepeatWrapping
        tipsTexture.wrapT = THREE.RepeatWrapping
        tipsTexture.repeat.set(1, 1)

        const tipsGeometry = new THREE.PlaneBufferGeometry(2.7, 2, 1, 1)
        const tipsMaterial = new THREE.MeshBasicMaterial({ map: tipsTexture, transparent: true})
        const tipsPlane = new THREE.Mesh(tipsGeometry, tipsMaterial)
        //plane.lookAt(0, 1, 0)
        tipsPlane.position.set(posterX, posterY, posterZ)
        tipsPlane.rotateY(posterRotation)
        this.scene.add(tipsPlane)


        //add map
        posterX = -3.5
        posterY = 1.65
        posterZ = -10.25

        posterRotation = 1.5708*3

        mapTexture.wrapS = THREE.RepeatWrapping
        mapTexture.wrapT = THREE.RepeatWrapping
        mapTexture.repeat.set(1, 1)

        const mapGeometry = new THREE.PlaneBufferGeometry(5, 2.5, 1, 1)
        const mapMaterial = new THREE.MeshBasicMaterial({ map: mapTexture, transparent: true})
        const mapPlane = new THREE.Mesh(mapGeometry, mapMaterial)
        //plane.lookAt(0, 1, 0)
        mapPlane.position.set(posterX, posterY, posterZ)
        mapPlane.rotateY(posterRotation)
        this.scene.add(mapPlane)

        const mapPlane2 = new THREE.Mesh(mapGeometry, mapMaterial);
        mapPlane2.position.set(15,1.75,2.15);
        mapPlane2.rotateY(Math.PI);
        this.scene.add(mapPlane2);


      }

      addArrowSigns() {

        const ArrowImages = require('../assets/images/arrow_signs/*.png')
        const arrowImageObjects = [
            {file:ArrowImages['MainProjArea_Forward'], w:4, h:2.5, x:-9, y:0.01, z:-12, rotateX:-Math.PI / 2, rotateY:Math.PI / 2},
            {file:ArrowImages['MainProjArea_Forward'], w:4, h:2.5, x:-1, y:0.01, z:-12, rotateX:-Math.PI / 2, rotateY:Math.PI / 2},
            {file:ArrowImages['Yorblet1-6_Left'], w:4, h:2, x:-18, y:0.01, z:-5, rotateX:-Math.PI / 2, rotateY:Math.PI / 2},
            {file:ArrowImages['Yorblet6-12_Right'], w:4.5, h:2, x:-18, y:0.01, z:-23, rotateX:-Math.PI / 2, rotateY:Math.PI / 2},
            {file:ArrowImages['ZoomProjects'], w:4, h:2, x:-18, y:0.01, z:-14, rotateX:-Math.PI / 2, rotateY:Math.PI / 2}
        ]
       
        arrowImageObjects.forEach((img) =>{

            const imgTxture = new THREE.TextureLoader().load(img.file);

            imgTxture.wrapS = THREE.RepeatWrapping
            imgTxture.wrapT = THREE.RepeatWrapping
            imgTxture.repeat.set(1, 1)
    
            const imgGeometry = new THREE.PlaneBufferGeometry(img.w, img.h, 1, 1)
            const imgMaterial = new THREE.MeshBasicMaterial({ map: imgTxture, transparent: true, side: THREE.DoubleSide })
            const imgPlane = new THREE.Mesh(imgGeometry, imgMaterial)

            imgPlane.position.set(img.x, img.y, img.z)
    
            imgPlane.rotateY(img.rotateY)
            imgPlane.rotateX(img.rotateX)
            // if (rotateZ) {imgPlane.rotateZ(rotateZ)}
    
            this.scene.add(imgPlane)
        })
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

            for (let projectIndex = 0; projectIndex < projects.length; projectIndex++) {
                let proj = projects[projectIndex]
                if (proj) {
                    let project_id = proj.project_id
                    let isZoomProject = proj.room_id == "-1";
                    if (dupeCheck[project_id])  continue;
                    // if (isZoomProject)  {
                    if (true) {
                        dupeCheck[project_id] = true
                        numUniqueProjects++
                        uniqueProjects.push(proj)
                    }
                }
            }
            // log('Number of total projects: ', this.projects.length)
            // log('Number of unique zoom projects: ', numUniqueProjects)

            if (numUniqueProjects > 0) {
                // if the projects have been updated
                let startIndex = 0
                let endIndex = 63
                for (let i = startIndex; i < endIndex && i < numUniqueProjects; i++) {
                    let proj = uniqueProjects[i]
                    if (!proj) return;
                    let locX = -23.55
                    let locZ = -79 + i * 1.5
                    let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                    this.hyperlinkedObjects.push(hyperlink)
                    this.scene.add(hyperlink)
                }

                startIndex = endIndex
                endIndex = endIndex + 7
                for (let i = startIndex; i < endIndex && i < numUniqueProjects; i++) {
                    let proj = uniqueProjects[i]
                    if (!proj) return;
                    let offset = i - startIndex * 1
                    let locX = -23.55
                    let locZ = 22 + offset * 1.5
                    let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                    this.hyperlinkedObjects.push(hyperlink)
                    this.scene.add(hyperlink)
                }

                startIndex = endIndex
                endIndex = endIndex + 11
                for (let i = startIndex; i < endIndex && i < numUniqueProjects; i++) {
                    let proj = uniqueProjects[i]
                    if (!proj) return;
                    let offset = i - startIndex * 1
                    let locX = -22.55 + offset * 1.5
                    let locZ = 32 
                    let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                    hyperlink.rotateY(Math.PI/2)

                    this.hyperlinkedObjects.push(hyperlink)
                    this.scene.add(hyperlink)
                }

                startIndex = endIndex
                endIndex = endIndex + 16
                for (let i = startIndex; i < endIndex && i < numUniqueProjects; i++) {
                    let proj = uniqueProjects[i]
                    let locX = -14
                    let offset = i - startIndex * 1
                    let locZ = -6 + offset
                    let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                    hyperlink.rotateY(Math.PI)
                    this.hyperlinkedObjects.push(hyperlink)
                    this.scene.add(hyperlink)
                }

                // startIndex = endIndex
                // endIndex = endIndex + 12
                // for (let i = startIndex; i < endIndex && i < numUniqueProjects; i++) {
                //     let proj = uniqueProjects[i]
                //     let locX = -14
                //     let offset = i - startIndex * 1
                //     let locZ = -30 + offset
                //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                //     hyperlink.rotateY(Math.PI)
                //     this.hyperlinkedObjects.push(hyperlink)
                //     this.scene.add(hyperlink)
                // }

                // startIndex = endIndex
                // endIndex = endIndex + 5
                // for (let i = startIndex; i < endIndex && i < numUniqueProjects; i++) {
                //     let proj = uniqueProjects[i]
                //     let locX = -14
                //     let offset = i - startIndex * 1
                //     let locZ = -42.75 + offset
                //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                //     hyperlink.rotateY(Math.PI)
                //     this.hyperlinkedObjects.push(hyperlink)
                //     this.scene.add(hyperlink)
                // }

                // startIndex = endIndex
                // endIndex = endIndex + 10
                // for (let i = startIndex; i < endIndex; i++) {
                //     let proj = uniqueProjects[i]
                //     let locX = -7
                //     let offset = i - startIndex * 1
                //     let locZ = -57 + offset
                //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                //     hyperlink.rotateY(Math.PI)
                //     this.hyperlinkedObjects.push(hyperlink)
                //     this.scene.add(hyperlink)
                // }

                // startIndex = endIndex
                // endIndex = endIndex + 18
                // for (let i = startIndex; i < endIndex; i++) {
                //     let proj = uniqueProjects[i]
                //     let locX = -7
                //     let offset = i - startIndex * 1
                //     let locZ = -77 + offset
                //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                //     hyperlink.rotateY(Math.PI)
                //     this.hyperlinkedObjects.push(hyperlink)
                //     this.scene.add(hyperlink)
                // }

                // startIndex = endIndex
                // endIndex = endIndex + 11
                // for (let i = startIndex; i < endIndex; i++) {
                //     let proj = uniqueProjects[i]
                //     let locX = -23.55
                //     let offset = i - startIndex * 1
                //     let locZ = -93 + offset
                //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                //     // hyperlink.rotateY(Math.PI);
                //     this.hyperlinkedObjects.push(hyperlink)
                //     this.scene.add(hyperlink)
                // }

                // startIndex = endIndex
                // endIndex = endIndex + 11
                // for (let i = startIndex; i < endIndex; i++) {
                //     let proj = uniqueProjects[i]
                //     let locX = -17.25
                //     let offset = i - startIndex * 1
                //     let locZ = -93 + offset
                //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                //     hyperlink.rotateY(Math.PI)
                //     this.hyperlinkedObjects.push(hyperlink)
                //     this.scene.add(hyperlink)
                // }

                // startIndex = endIndex
                // endIndex = endIndex + 11
                // for (let i = startIndex; i < endIndex; i++) {
                //     let proj = uniqueProjects[i]
                //     let locX = -16
                //     let offset = i - startIndex * 1
                //     let locZ = -93 + offset
                //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                //     // hyperlink.rotateY(Math.PI);
                //     this.hyperlinkedObjects.push(hyperlink)
                //     this.scene.add(hyperlink)
                // }

                // startIndex = endIndex
                // endIndex = endIndex + 11
                // for (let i = startIndex; i < endIndex; i++) {
                //     let proj = uniqueProjects[i]
                //     let locX = -23.55
                //     let offset = i - startIndex * 1
                //     let locZ = -106 + offset
                //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                //     // hyperlink.rotateY(Math.PI);
                //     this.hyperlinkedObjects.push(hyperlink)
                //     this.scene.add(hyperlink)
                // }

                // startIndex = endIndex
                // endIndex = endIndex + 8
                // for (let i = startIndex; i < endIndex; i++) {
                //     let proj = uniqueProjects[i]
                //     let locX = 1.25
                //     let offset = i - startIndex * 1
                //     let locZ = -106 + offset
                //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                //     hyperlink.rotateY(Math.PI)
                //     this.hyperlinkedObjects.push(hyperlink)
                //     this.scene.add(hyperlink)
                // }

                // // along x axis:

                startIndex = endIndex
                endIndex = endIndex + 19
                for (let i = startIndex; i < endIndex && i < numUniqueProjects; i++) {
                    let proj = uniqueProjects[i]
                    let offset = i - startIndex * 1
                    let locX = -21 + offset
                    let locZ = -106.5
                    let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                    hyperlink.rotateY(-Math.PI / 2)
                    this.hyperlinkedObjects.push(hyperlink)
                    this.scene.add(hyperlink)
                }

                startIndex = endIndex
                endIndex = uniqueProjects.length
                for (let i = startIndex; i < endIndex && i < numUniqueProjects; i++) {
                    let proj = uniqueProjects[i]
                    let offset = i - startIndex * 1
                    let locX = -21 + offset
                    let locZ = -95.125
                    let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                    hyperlink.rotateY(Math.PI / 2)
                    this.hyperlinkedObjects.push(hyperlink)
                    this.scene.add(hyperlink)
                }

                // console.log("We've placed ", endIndex, ' projects so far.')
            }
        }
    }

    addPortals() {
        //goes through all yorblets except 0 (lobby) and makes portal
        for (let i = 1; i < yorbletPortalReference.length; i++) {
            // log(yorbletPortalReference[i])
            this.portals.push(new Portal(this.scene, yorbletPortalReference[i].position, i))
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
     * createHyperlinkedMesh(x,y,z,_project)
     *
     * Description:
     * 	- creates an object3D for each project at position x,y,z
     *	- adds _project as userData to the object3D
     *	- returns object3D
     */

    createHyperlinkedMesh(x, y, z, _project) {
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

        return imageSign
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
            talkToCreatorDiv.innerHTML = 'Talk To The Project Creator:'

            let linksDiv = document.createElement('div')
            linksDiv.className = 'project-modal-link-container'

            let projectLinkEl = document.createElement('a')
            // projectLinkEl.href = link;
            projectLinkEl.href = project.url
            projectLinkEl.innerHTML = 'Project Website'
            projectLinkEl.target = '_blank'
            projectLinkEl.rel = 'noopener noreferrer'

            let zoomLinkEl = document.createElement('a')
            // zoomLinkEl.href = link
            zoomLinkEl.href = link
            // zoomLinkEl.innerHTML = 'Zoom Room - ' + room_status
            zoomLinkEl.innerHTML = 'Join Live Presentation!'
            zoomLinkEl.target = '_self'
            zoomLinkEl.rel = 'noopener noreferrer'

            linksDiv.appendChild(projectLinkEl)
            linksDiv.innerHTML += '&nbsp;&nbsp;&nbsp;*&nbsp;&nbsp;&nbsp;'
            if (project.zoom_status == 1) {
                linksDiv.appendChild(zoomLinkEl)
            }

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
                hackToRemovePlayerTemporarily()

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
