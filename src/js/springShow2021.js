import * as THREE from 'three';

import { createSimpleText } from './utils';
import { hackToRemovePlayerTemporarily } from './index.js';
import { Vector3 } from 'three';
import { Portal } from './portals';
import { Signage } from './signage';

const project_thumbnails = require('../assets/images/project_thumbnails/winterShow2020/*.png');

const waterTextureFile = require('../assets/images/TexturesCom_WaterPlain0012_1_seamless_S.jpg');
const grassTextureFile = require('../assets/images/Grass004_1K_Color.jpg');

import debugModule from 'debug';

const log = debugModule('YORB:WinterShow');

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
];

export class SpringShow2021 {
    constructor(scene, camera, controls, mouse) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.mouse = mouse;

        this.hightlightedProjectId = -1;
        this.activeProjectId = -1; // will change to project ID if a project is active

        // we need some stuff to operate:
        this.raycaster = new THREE.Raycaster();
        this.textureLoader = new THREE.TextureLoader();
        this.textParser = new DOMParser();

        this.highlightMaterial = new THREE.MeshLambertMaterial({ color: 0xffff1a });
        this.linkMaterial = new THREE.MeshLambertMaterial({ color: 0xb3b3ff });
        this.linkVisitedMaterial = new THREE.MeshLambertMaterial({
            color: 0x6699ff,
        });
        this.statusBoxMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });

        this.projects = [];
        this.hyperlinkedObjects = [];
        this.linkMaterials = {};

        this.portals = [];

        // let domElement = document.getElementById('scene-container')
        window.addEventListener('click', (e) => this.onMouseClick(e), false);

        this.lazyRiver = new LazyRiver(this.scene, this.camera);
    }

    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
    // Interactable Hyperlinks for Spring Show 💎

    setup() {
        var loader = new THREE.FontLoader();
        let fontJSON = require('../assets/fonts/helvetiker_bold.json');
        this.font = loader.parse(fontJSON);
        this._updateProjects();

        this.addGround();
        this.addPortals();
        // this.addDecals();
        // var signage = new Signage(this.scene);
        // this.addArrowSigns();
    }

    addGround() {
        const grassTexture = new THREE.TextureLoader().load(grassTextureFile);
        grassTexture.wrapS = THREE.RepeatWrapping;
        grassTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.repeat.set(500, 500);

        const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshLambertMaterial({ map: grassTexture }));
        groundPlane.rotateX(-Math.PI / 2);
        this.scene.add(groundPlane);
    }

    // addDecals() {
    //     //add welcome sign
    //     const welcomeTexture = new THREE.TextureLoader().load(require('../assets/images/decals/welcome_sign_export_4x.png'));
    //     const tipsTexture = new THREE.TextureLoader().load(require('../assets/images/decals/tips_export_4x.png'));
    //     const mapTexture = new THREE.TextureLoader().load(require('../assets/images/decals/full_map_export_1x_new.png'));

    //     //add welcome poster
    //     let posterX = -6.5;
    //     let posterY = 1.6;
    //     let posterZ = -7.25;

    //     let posterRotation = 1.5708 * 2;

    //     welcomeTexture.wrapS = THREE.RepeatWrapping;
    //     welcomeTexture.wrapT = THREE.RepeatWrapping;
    //     welcomeTexture.repeat.set(1, 1);

    //     const signGeometry = new THREE.PlaneBufferGeometry(2.7, 2, 1, 1);
    //     const signMaterial = new THREE.MeshBasicMaterial({ map: welcomeTexture, transparent: true });
    //     const signPlane = new THREE.Mesh(signGeometry, signMaterial);
    //     //plane.lookAt(0, 1, 0)
    //     signPlane.position.set(posterX, posterY, posterZ);
    //     signPlane.rotateY(posterRotation);
    //     this.scene.add(signPlane);

    //     //add tips poster
    //     posterX = -9.5;
    //     posterY = 1.65;
    //     posterZ = -7.25;

    //     posterRotation = 1.5708 * 2;

    //     tipsTexture.wrapS = THREE.RepeatWrapping;
    //     tipsTexture.wrapT = THREE.RepeatWrapping;
    //     tipsTexture.repeat.set(1, 1);

    //     const tipsGeometry = new THREE.PlaneBufferGeometry(2.7, 2, 1, 1);
    //     const tipsMaterial = new THREE.MeshBasicMaterial({ map: tipsTexture, transparent: true });
    //     const tipsPlane = new THREE.Mesh(tipsGeometry, tipsMaterial);
    //     //plane.lookAt(0, 1, 0)
    //     tipsPlane.position.set(posterX, posterY, posterZ);
    //     tipsPlane.rotateY(posterRotation);
    //     this.scene.add(tipsPlane);

    //     //add map
    //     posterX = -3.5;
    //     posterY = 1.65;
    //     posterZ = -10.25;

    //     posterRotation = 1.5708 * 3;

    //     mapTexture.wrapS = THREE.RepeatWrapping;
    //     mapTexture.wrapT = THREE.RepeatWrapping;
    //     mapTexture.repeat.set(1, 1);

    //     const mapGeometry = new THREE.PlaneBufferGeometry(5, 2.5, 1, 1);
    //     const mapMaterial = new THREE.MeshBasicMaterial({ map: mapTexture, transparent: true });
    //     const mapPlane = new THREE.Mesh(mapGeometry, mapMaterial);
    //     //plane.lookAt(0, 1, 0)
    //     mapPlane.position.set(posterX, posterY, posterZ);
    //     mapPlane.rotateY(posterRotation);
    //     this.scene.add(mapPlane);

    //     const mapPlane2 = new THREE.Mesh(mapGeometry, mapMaterial);
    //     mapPlane2.position.set(15, 1.75, 2.15);
    //     mapPlane2.rotateY(Math.PI);
    //     this.scene.add(mapPlane2);
    // }

    // addArrowSigns() {
    //     const ArrowImages = require('../assets/images/arrow_signs/*.png');
    //     const arrowImageObjects = [
    //         { file: ArrowImages['MainProjArea_Forward'], w: 4, h: 2.5, x: -9, y: 0.01, z: -12, rotateX: -Math.PI / 2, rotateY: Math.PI / 2 },
    //         { file: ArrowImages['MainProjArea_Forward'], w: 4, h: 2.5, x: -1, y: 0.01, z: -12, rotateX: -Math.PI / 2, rotateY: Math.PI / 2 },
    //         { file: ArrowImages['Yorblet1-6_Left'], w: 4, h: 2, x: -18, y: 0.01, z: -5, rotateX: -Math.PI / 2, rotateY: Math.PI / 2 },
    //         { file: ArrowImages['Yorblet6-12_Right'], w: 4.5, h: 2, x: -18, y: 0.01, z: -23, rotateX: -Math.PI / 2, rotateY: Math.PI / 2 },
    //         { file: ArrowImages['ZoomProjects'], w: 4, h: 2, x: -18, y: 0.01, z: -14, rotateX: -Math.PI / 2, rotateY: Math.PI / 2 },
    //     ];

    //     arrowImageObjects.forEach((img) => {
    //         const imgTxture = new THREE.TextureLoader().load(img.file);

    //         imgTxture.wrapS = THREE.RepeatWrapping;
    //         imgTxture.wrapT = THREE.RepeatWrapping;
    //         imgTxture.repeat.set(1, 1);

    //         const imgGeometry = new THREE.PlaneBufferGeometry(img.w, img.h, 1, 1);
    //         const imgMaterial = new THREE.MeshBasicMaterial({ map: imgTxture, transparent: true, side: THREE.DoubleSide });
    //         const imgPlane = new THREE.Mesh(imgGeometry, imgMaterial);

    //         imgPlane.position.set(img.x, img.y, img.z);

    //         imgPlane.rotateY(img.rotateY);
    //         imgPlane.rotateX(img.rotateX);
    //         // if (rotateZ) {imgPlane.rotateZ(rotateZ)}

    //         this.scene.add(imgPlane);
    //     });
    // }

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
        this.projects = projects;
        this._updateProjects();
    }

    _updateProjects() {
        console.log('updating ', this.projects);
        if (this.font) {
            let projects = this.projects;

            for (let i = 0; i < this.hyperlinkedObjects.length; i++) {
                this.scene.remove(this.hyperlinkedObjects[i]);
            }
            this.hyperlinkedObjects = [];

            // do a check for duplicates
            let dupeCheck = {};
            let numUniqueProjects = 0;

            let uniqueProjects = [];

            for (let projectIndex = 0; projectIndex < projects.length; projectIndex++) {
                let proj = projects[projectIndex];
                if (proj) {
                    let project_id = proj.project_id;
                    let isZoomProject = proj.room_id == '-1';
                    if (dupeCheck[project_id]) continue;
                    // if (isZoomProject)  {
                    if (true) {
                        dupeCheck[project_id] = true;
                        numUniqueProjects++;
                        uniqueProjects.push(proj);
                    }
                }
            }
            // log('Number of total projects: ', this.projects.length)
            // log('Number of unique zoom projects: ', numUniqueProjects)

            if (numUniqueProjects > 0) {
                let gallerySpacingX = 20;
                let gallerySpacingZ = 20;

                this.arrangeMiniGallery(-gallerySpacingX, -gallerySpacingZ, 10, 0, Math.PI, 0xff00ff);
                this.arrangeMiniGallery(gallerySpacingX, -gallerySpacingZ, 10, 0, 0, 0xffffff);
                this.arrangeMiniGallery(-gallerySpacingX, gallerySpacingZ, 10, 0, Math.PI, 0x0000ff);
                this.arrangeMiniGallery(gallerySpacingX, gallerySpacingZ, 10, 0, 0, 0x00ffff);

                // console.log("We've placed ", endIndex, ' projects so far.')
            }
        }
    }

    arrangeMiniGallery(centerX, centerZ, numProjects, projectOffset, yRotation = 0, archCol) {
        let miniGalleryParent = new THREE.Group();

        let projectIndex = projectOffset;
        let projectHeight = 1.5;
        let projectSpacing = 4;

        let locX = 0;
        let locZ = -1 * projectSpacing;

        // arrange one row
        for (let i = 0; i < numProjects / 2; i++) {
            let proj = this.projects[projectIndex];
            if (!proj) return;

            locX += projectSpacing;

            let hyperlink = this.createHyperlinkedMesh(locX, projectHeight, locZ, proj);
            hyperlink.rotateY(-Math.PI / 2);
            this.hyperlinkedObjects.push(hyperlink);
            miniGalleryParent.add(hyperlink);

            projectIndex++;
        }

        locX = 0;
        locZ += projectSpacing * 2;

        // then the other
        for (let i = 0; i < numProjects / 2; i++) {
            let proj = this.projects[projectIndex];
            if (!proj) return;

            locX += projectSpacing;

            let hyperlink = this.createHyperlinkedMesh(locX, projectHeight, locZ, proj);
            hyperlink.rotateY(Math.PI / 2);
            this.hyperlinkedObjects.push(hyperlink);
            miniGalleryParent.add(hyperlink);

            projectIndex++;
        }

        // add entrance:
        const geometry = new THREE.TorusBufferGeometry(4, 0.5, 16, 24, Math.PI);
        const material = new THREE.MeshBasicMaterial({ color: archCol });
        const torus = new THREE.Mesh(geometry, material);
        torus.rotateY(Math.PI / 2);
        miniGalleryParent.add(torus);

        // then a floor
        let floorWidth = projectSpacing * 1.5;
        let floorLength = projectSpacing * (numProjects / 2 + 1);
        let geo = new THREE.BoxGeometry(floorLength, 0.1, floorWidth);
        let mat = new THREE.MeshLambertMaterial({ color: 'hotpink' });
        let mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(projectSpacing * (numProjects / 4), 0, 0);
        miniGalleryParent.add(mesh);

        miniGalleryParent.rotateY(yRotation);
        miniGalleryParent.position.set(centerX, 0, centerZ);

        this.scene.add(miniGalleryParent);
    }
    // this will update the project posters
    arrangeProjectsInOval(radius, numProjects, projectOffset) {
        // set left side offsets
        let xOffset = 0;
        let zOffset = radius / 2;

        let projectHeight = 1;

        let projectIndex = projectOffset;
        // make left side projects
        for (let i = 0; i < numProjects / 2; i++) {
            let proj = this.projects[projectIndex];
            if (!proj) return;

            let theta = (Math.PI * 2) / (numProjects - 2);
            let angle = theta * i;

            let centerX = radius * Math.cos(angle) + xOffset;
            let centerZ = radius * Math.sin(angle) + zOffset;

            let hyperlink = this.createHyperlinkedMesh(centerX, projectHeight, centerZ, proj);
            hyperlink.lookAt(centerX, projectHeight, centerZ);
            this.hyperlinkedObjects.push(hyperlink);
            this.scene.add(hyperlink);

            projectIndex++;
        }

        xOffset = 0;
        zOffset = -radius / 2;

        // make right side projects
        for (let i = numProjects / 2 - 1; i < numProjects - 1; i++) {
            let proj = this.projects[projectIndex];
            if (!proj) return;

            let theta = (Math.PI * 2) / (numProjects - 2);
            let angle = theta * i;

            let centerX = radius * Math.cos(angle) + xOffset;
            let centerZ = radius * Math.sin(angle) + zOffset;

            let hyperlink = this.createHyperlinkedMesh(centerX, projectHeight, centerZ, proj);
            this.hyperlinkedObjects.push(hyperlink);
            this.scene.add(hyperlink);

            projectIndex++;
        }
    }

    addPortals() {
        this.portals.push(new Portal(this.scene, new THREE.Vector3(0, 0, -60), 0));
        //goes through all yorblets except 0 (lobby) and makes portal
        // for (let i = 1; i < yorbletPortalReference.length; i++) {
        //     // log(yorbletPortalReference[i])
        //     this.portals.push(new Portal(this.scene, yorbletPortalReference[i].position, i));
        // }
    }

    // this decodes the text twice because the project database seems to be double wrapped in html...
    // https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript
    parseText(encodedStr) {
        var dom = this.textParser.parseFromString('<!doctype html><body>' + encodedStr, 'text/html');
        var decodedString = dom.body.textContent;
        var dom2 = this.textParser.parseFromString('<!doctype html><body>' + decodedString, 'text/html');
        var decodedString2 = dom2.body.textContent;
        return decodedString2;
    }

    addLineBreak(longString) {
        let spaceIndex = longString.indexOf(' ', 10);
        if (spaceIndex != -1) {
            let firstHalf = longString.slice(0, spaceIndex);
            let secondHalf = longString.slice(spaceIndex, longString.length);
            if (secondHalf.length > 15) {
                secondHalf = this.addLineBreak(secondHalf);
            }
            return firstHalf.trim() + '\n' + secondHalf.trim();
        } else {
            return longString;
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
        console.log(_project);
        let linkDepth = 0.1;
        let fontColor = 0x343434;
        let statusColor = 0xffffff;
        let fontSize = 0.05;

        var geometry = new THREE.BoxGeometry(linkDepth, 0.75, 0.75);
        var textBoxGeometry = new THREE.BoxGeometry(linkDepth, 0.5, 0.75);

        let textBoxMat;

        // check whether we've visited the link before and set material accordingly
        if (localStorage.getItem(_project.project_id) == 'visited') {
            textBoxMat = this.linkVisitedMaterial;
        } else {
            textBoxMat = this.linkMaterial;
        }

        let tex;
        if (project_thumbnails[_project.project_id]) {
            tex = this.textureLoader.load(project_thumbnails[_project.project_id]);
        } else {
            tex = this.textureLoader.load(project_thumbnails['0000']); // default texture
        }
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 1);

        let imageMat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: tex,
        });

        this.linkMaterials[_project.project_id.toString()] = imageMat;

        var textSign = new THREE.Mesh(textBoxGeometry, textBoxMat);
        var imageSign = new THREE.Mesh(geometry, imageMat);

        // parse text of name and add line breaks if necessary
        var name = this.parseText(_project.project_name);
        if (name.length > 15) {
            name = this.addLineBreak(name);
        }

        // create name text mesh
        var textMesh = createSimpleText(name, fontColor, fontSize, this.font);

        textMesh.position.x += linkDepth / 2 + 0.01; // offset forward
        textMesh.rotateY(Math.PI / 2);

        imageSign.position.set(x, y, z);
        textSign.position.set(0, -0.75 / 2 - 0.5 / 2, 0);
        textSign.add(textMesh);
        imageSign.add(textSign);

        // https://stackoverflow.com/questions/24690731/three-js-3d-models-as-hyperlink/24692057
        let now = Date.now();
        imageSign.userData = {
            project: _project,
            lastVisitedTime: now,
        };

        imageSign.name = _project.project_id;

        return imageSign;
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
    generateProjectModal(project) {
        // parse project descriptions to render without &amp; etc.
        // https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript

        if (!document.getElementsByClassName('project-modal')[0]) {
            this.controls.pause();
            localStorage.setItem(project.project_id, 'visited');

            let id = project.project_id;
            let name = project.project_name;
            let pitch = project.elevator_pitch;
            let description = project.description;
            let link = project.zoom_link;

            let modalEl = document.createElement('div');
            modalEl.className = 'project-modal';
            modalEl.id = id + '_modal';

            let contentEl = document.createElement('div');
            contentEl.className = 'project-modal-content';

            let closeButton = document.createElement('button');
            closeButton.addEventListener('click', () => {
                modalEl.remove();
                // https://stackoverflow.com/questions/19426559/three-js-access-scene-objects-by-name-or-id
                let now = Date.now();
                let link = this.scene.getObjectByName(id);
                link.userData.lastVisitedTime = now;
                this.controls.resume();
                setTimeout(() => {
                    this.activeProjectId = -1;
                }, 100); // this helps reset without reopening the modal
            });
            closeButton.innerHTML = 'X';

            let projectImageEl = document.createElement('img');
            let filename = 'https://itp.nyu.edu' + project.image;
            // let filename = "images/project_thumbnails/" + project.project_id + ".png";
            projectImageEl.src = filename;
            projectImageEl.className = 'project-modal-img';

            let titleEl = document.createElement('h1');
            titleEl.innerHTML = this.parseText(name);
            titleEl.className = 'project-modal-title';

            // names
            let names = '';
            for (let i = 0; i < project.users.length; i++) {
                names += project.users[i].user_name;
                if (i < project.users.length - 1) {
                    names += ' & ';
                }
            }
            let namesEl = document.createElement('p');
            namesEl.innerHTML = names;
            namesEl.className = 'project-modal-names';

            let elevatorPitchHeaderEl = document.createElement('p');
            elevatorPitchHeaderEl.innerHTML = 'Elevator Pitch';
            let elevatorPitchEl = document.createElement('p');
            elevatorPitchEl.innerHTML = this.parseText(pitch);
            elevatorPitchEl.className = 'project-modal-text';

            let descriptionHeaderEl = document.createElement('p');
            descriptionHeaderEl.innerHTML = 'Description';
            let descriptionEl = document.createElement('p');
            descriptionEl.innerHTML = this.parseText(description);
            descriptionEl.className = 'project-modal-text';

            let talkToCreatorDiv = document.createElement('div');
            talkToCreatorDiv.className = 'project-modal-links-header';
            talkToCreatorDiv.innerHTML = 'Talk To The Project Creator:';

            let linksDiv = document.createElement('div');
            linksDiv.className = 'project-modal-link-container';

            let projectLinkEl = document.createElement('a');
            // projectLinkEl.href = link;
            projectLinkEl.href = project.url;
            projectLinkEl.innerHTML = 'Project Website';
            projectLinkEl.target = '_blank';
            projectLinkEl.rel = 'noopener noreferrer';

            let zoomLinkEl = document.createElement('a');
            zoomLinkEl.href = link;
            zoomLinkEl.innerHTML = 'Join Live Presentation!';
            zoomLinkEl.target = '_self';
            zoomLinkEl.rel = 'noopener noreferrer';

            linksDiv.appendChild(projectLinkEl);
            linksDiv.innerHTML += '&nbsp;&nbsp;&nbsp;*&nbsp;&nbsp;&nbsp;';
            if (project.zoom_status == 1) {
                linksDiv.appendChild(zoomLinkEl);
            }

            contentEl.appendChild(closeButton);
            contentEl.appendChild(projectImageEl);
            contentEl.appendChild(titleEl);
            contentEl.appendChild(namesEl);
            contentEl.appendChild(elevatorPitchHeaderEl);
            contentEl.appendChild(elevatorPitchEl);
            contentEl.appendChild(descriptionHeaderEl);
            contentEl.appendChild(descriptionEl);
            contentEl.appendChild(talkToCreatorDiv);
            contentEl.appendChild(linksDiv);

            modalEl.appendChild(contentEl);
            document.body.appendChild(modalEl);
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
        let thresholdDist = 5;
        let now = Date.now();

        // store reference to last highlighted project id
        let lastHighlightedProjectId = this.hightlightedProjectId;

        // cast ray out from camera
        this.raycaster.setFromCamera(this.mouse, this.camera);

        var intersects = this.raycaster.intersectObjects(this.hyperlinkedObjects);

        // if we have intersections, highlight them
        if (intersects.length > 0) {
            if (intersects[0].distance < thresholdDist) {
                let link = intersects[0].object;
                this.hightlightedProjectId = link.userData.project.project_id;
                // do styling
                this.highlightLink(link);
            }
        }

        // if we've changed which project is highlighted
        if (lastHighlightedProjectId != this.hightlightedProjectId) {
            let link = this.scene.getObjectByName(lastHighlightedProjectId);
            if (link != null) {
                // reset styling
                this.resetLinkMaterial(link);
            }
        } else {
            // no change, so lets check for
            let link = this.scene.getObjectByName(this.hightlightedProjectId);
            if (link != null) {
                if (now - link.userData.lastVisitedTime > 500) {
                    // reset styling
                    this.hightlightedProjectId = -1;
                    this.resetLinkMaterial(link);
                }
            }
        }
    }

    highlightLink(link) {
        let now = Date.now();
        link.userData.lastVisitedTime = now;
        link.userData.highlighted = true;

        link.children[0].material = this.highlightMaterial;
        link.scale.set(1.1, 1.1, 1.1);
    }

    resetLinkMaterial(link) {
        link.scale.set(1, 1, 1);
        // reset according to whether we have visited it or not yet
        let mat;
        // check whether we've visited the link before and set material accordingly
        if (localStorage.getItem(link.userData.project.project_id) == 'visited') {
            mat = this.linkVisitedMaterial;
        } else {
            mat = this.linkMaterial;
        }
        // log(link);
        link.children[0].material = mat;
    }

    activateHighlightedProject() {
        if (this.hightlightedProjectId != -1 && this.activeProjectId === -1) {
            let link = this.scene.getObjectByName(this.hightlightedProjectId);
            if (link != null) {
                this.generateProjectModal(link.userData.project);
                hackToRemovePlayerTemporarily();

                // reset markers
                this.activeProjectId = link.userData.project.project_id;
            }
        }
    }

    update() {
        if (this.activeProjectId == -1) {
            this.highlightHyperlinks();
        }

        this.lazyRiver.update();
    }

    onMouseClick(e) {
        this.activateHighlightedProject();
    }
}

class LazyRiver {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        this.hasStarted = false;
        this.isMoving = false;

        this.raycaster = new THREE.Raycaster();
        this.downVector = new THREE.Vector3(0, -1, 0);

        this.speedFactor = 0.035;

        this.textureOffset = 0;

        this.pointsResolution = 256;

        // spline movement variables:
        this.direction = new THREE.Vector3();
        this.binormal = new THREE.Vector3();
        this.normal = new THREE.Vector3();
        this.position = new THREE.Vector3();
        this.lookAt = new THREE.Vector3();

        this.addSpline();
    }

    addSpline() {
        let points = [
            [-0.02, 0, -66.26],
            [6.28, 0, -62.53],
            [20.07, 0, -27.31],
            [43.46, 0, -26.63],
            [44.1, 0, -14.43],
            [23.82, 0, -13.18],
            [20.64, 0, 11.77],
            [42.64, 0, 13.81],
            [43.61, 0, 23.59],
            [43.63, 0, 26.02],
            [21.06, 0, 26.88],
            [16.27, 0, 60.36],
            [10.6, 0, 70.93],
            [-5.38, 0, 74.3],
            [-15.0, 0, 65.78],
            [-15.62, 0, 58.38],
            [-20.09, 0, 26.99],
            [-41.19, 0, 25.74],
            [-43.89, 0, 20.71],
            [-43.15, 0, 15.09],
            [-43.16, 0, 14.18],
            [-21.57, 0, 13.5],
            [-20.1, 0, -14.17],
            [-42.28, 0, -14.1],
            [-42.67, 0, -24.82],
            [-42.67, 0, -26.15],
            [-20.42, 0, -26.14],
            [-4.26, 0, -60.54],
        ];
        let vectors = [];
        for (let i = 0; i < points.length; i++) {
            let pt = points[i];
            console.log(pt);
            vectors.push(new THREE.Vector3(pt[0], pt[1], pt[2]));
        }
        // this.lazyRiverPath = new THREE.CatmullRomCurve3([
        //     new THREE.Vector3(0, 0, -5),
        //     new THREE.Vector3(20, 0, -20),
        //     new THREE.Vector3(80, 0, -20),
        //     new THREE.Vector3(20, 0, 20),
        //     new THREE.Vector3(-20, 0, 20),
        // ]);
        console.log(vectors);
        this.lazyRiverPath = new THREE.CatmullRomCurve3(vectors);

        this.lazyRiverPath.curveType = 'catmullrom';
        this.lazyRiverPath.closed = true;

        this.tubeGeometry = new THREE.TubeGeometry(this.lazyRiverPath, 128, 0.25, 12, true);

        // Extrusion
        const extrudeSettings1 = {
            steps: 128,
            bevelEnabled: false,
            extrudePath: this.lazyRiverPath,
        };

        const pts1 = [],
            count = 3;

        for (let i = 0; i < count; i++) {
            const l = 3;
            const a = ((2 * i) / count) * Math.PI;
            pts1.push(new THREE.Vector2(Math.cos(a) * l, Math.sin(a) * l));
        }

        const shape1 = new THREE.Shape(pts1);
        const geometry1 = new THREE.ExtrudeGeometry(shape1, extrudeSettings1);

        this.waterTexture = new THREE.TextureLoader().load(waterTextureFile);
        this.waterTexture.wrapS = THREE.RepeatWrapping;
        this.waterTexture.wrapT = THREE.RepeatWrapping;
        this.waterTexture.repeat.set(0.1, 0.1);
        const material1 = new THREE.MeshLambertMaterial({ color: 0xaaaaff, wireframe: false, side: THREE.DoubleSide, map: this.waterTexture });

        const mesh1 = new THREE.Mesh(geometry1, material1);

        this.scene.add(mesh1);
        mesh1.position.set(0, -1.49, 0);

        this.lazyRiverMesh = mesh1;

        this.pointsAlongLazyRiver = this.lazyRiverPath.getPoints(this.pointsResolution);
        this.findClosestPointAlongLazyRiver();
    }

    findClosestPointAlongLazyRiver() {
        let closestIndex = -1;
        let closest = null;
        let closestDistance = Infinity;
        for (let i = 0; i < this.pointsAlongLazyRiver.length; i++) {
            let pt = this.pointsAlongLazyRiver[i];
            let distSquared = this.camera.position.distanceToSquared(pt);
            if (distSquared < closestDistance) {
                closestDistance = distSquared;
                closest = pt;
                closestIndex = i;
            }
        }
        return closestIndex / this.pointsResolution;
    }

    update() {
        this.textureOffset -= 1;
        this.waterTexture.offset.set((this.textureOffset % 1000) / 1000, 0);
        this.raycaster.set(this.camera.position, this.downVector);
        let intersections = this.raycaster.intersectObject(this.lazyRiverMesh);
        if (intersections[0]) {
            this.positionAlongCurve = this.findClosestPointAlongLazyRiver();
            this.tubeGeometry.parameters.path.getTangent(this.positionAlongCurve, this.direction);
            this.camera.position.add(this.direction.multiplyScalar(this.speedFactor));
        }
    }
}
