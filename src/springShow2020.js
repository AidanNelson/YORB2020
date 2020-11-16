const THREE = require("./libs/three.min.js");

import {createSimpleText } from "./utils";
import {  hackToRemovePlayerTemporarily
} from "./index.js";

export class SpringShow {
  constructor(scene, camera, controls) {
      this.scene = scene;
      this.camera = camera;
      this.controls = controls;

      // we need some stuff to operate:
      this.raycaster = new THREE.Raycaster();
      this.textureLoader = new  THREE.TextureLoader();
      this.textParser = new DOMParser;



      this.highlightMaterial = new THREE.MeshLambertMaterial({ color: 0xffff1a });
      this.linkMaterial = new THREE.MeshLambertMaterial({ color: 0xb3b3ff });
      this.linkVisitedMaterial = new THREE.MeshLambertMaterial({
        color: 0x6699ff,
      });
      this.statusBoxMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
  
      this.projects = [];
      this.hyperlinkedObjects = [];
      this.linkMaterials = {};
  }

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Interactable Hyperlinks for Spring Show 💎

  setup() {

    var loader = new THREE.FontLoader();
    // https://gero3.github.io/facetype.js/
    loader.load("fonts/helvetiker_bold.typeface.json", (response) => {
      // loader.load('fonts/VCR_OSD_Mono_Regular.json', (response) => {
      this.font = response;
    //   this.createSignage();
      this._updateProjects();
    });
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
    this.projects = projects;
    this._updateProjects();
  }

  _updateProjects() {
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

      for (
        let projectIndex = 0;
        projectIndex < projects.length;
        projectIndex++
      ) {
        let proj = projects[projectIndex];
        if (proj) {
          let project_id = proj.project_id;

          if (dupeCheck[project_id]) {
            // console.log('Duplicate with ID: ', proj.project_id);
          } else {
            dupeCheck[project_id] = true;
            numUniqueProjects++;
            uniqueProjects.push(proj);
          }
        }
      }
      console.log("Number of total projects: ", this.projects.length);
      console.log("Number of unique projects: ", numUniqueProjects);

      if (numUniqueProjects > 0) {
        // if the projects have been updated
        let startIndex = 0;
        let endIndex = 96;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -23.55;
          let locZ = -80 + i * 1;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 16;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -14;
          let offset = i - startIndex * 1;
          let locZ = -6 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 12;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -14;
          let offset = i - startIndex * 1;
          let locZ = -30 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 5;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -14;
          let offset = i - startIndex * 1;
          let locZ = -42.75 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 10;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -7;
          let offset = i - startIndex * 1;
          let locZ = -57 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 18;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -7;
          let offset = i - startIndex * 1;
          let locZ = -77 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 11;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -23.55;
          let offset = i - startIndex * 1;
          let locZ = -93 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          // hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 11;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -17.25;
          let offset = i - startIndex * 1;
          let locZ = -93 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 11;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -16;
          let offset = i - startIndex * 1;
          let locZ = -93 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          // hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 11;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = -23.55;
          let offset = i - startIndex * 1;
          let locZ = -106 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          // hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = endIndex + 8;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let locX = 1.25;
          let offset = i - startIndex * 1;
          let locZ = -106 + offset;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          hyperlink.rotateY(Math.PI);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        // along x axis:

        startIndex = endIndex;
        endIndex = endIndex + 19;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let offset = i - startIndex * 1;
          let locX = -21 + offset;
          let locZ = -106.5;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          hyperlink.rotateY(-Math.PI / 2);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        startIndex = endIndex;
        endIndex = uniqueProjects.length;
        for (let i = startIndex; i < endIndex; i++) {
          let proj = uniqueProjects[i];
          let offset = i - startIndex * 1;
          let locX = -21 + offset;
          let locZ = -95.125;
          let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
          hyperlink.rotateY(Math.PI / 2);
          this.hyperlinkedObjects.push(hyperlink);
          this.scene.add(hyperlink);
        }

        console.log("We've placed ", endIndex, " projects so far.");
      }

      // startIndex = endIndex;
      // endIndex = 200;
      // for (let i = startIndex; i < endIndex; i++) {
      // 	let proj = uniqueProjects[i];
      // 	let locX = -23.55;
      // 	let offset = (i - startIndex * 1);
      // 	let locZ = -80 + offset;
      // 	let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj);
      // 	this.hyperlinkedObjects.push(hyperlink);
      // 	this.scene.add(hyperlink);
      // }
    }
  }

   // this decodes the text twice because the project database seems to be double wrapped in html...
  // https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript
  parseText(encodedStr) {
    var dom = this.textParser.parseFromString(
      "<!doctype html><body>" + encodedStr,
      "text/html"
    );
    var decodedString = dom.body.textContent;
    var dom2 = this.textParser.parseFromString(
      "<!doctype html><body>" + decodedString,
      "text/html"
    );
    var decodedString2 = dom2.body.textContent;
    return decodedString2;
  }

  addLineBreak(longString) {
    let spaceIndex = longString.indexOf(" ", 10);
    if (spaceIndex != -1) {
      let firstHalf = longString.slice(0, spaceIndex);
      let secondHalf = longString.slice(spaceIndex, longString.length);
      if (secondHalf.length > 15) {
        secondHalf = this.addLineBreak(secondHalf);
      }
      return firstHalf.trim() + "\n" + secondHalf.trim();
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
    let linkDepth = 0.1;
    let fontColor = 0x343434;
    let statusColor = 0xffffff;
    let fontSize = 0.05;

    var geometry = new THREE.BoxGeometry(linkDepth, 0.75, 0.75);
    var textBoxGeometry = new THREE.BoxGeometry(linkDepth, 0.5, 0.75);

    let textBoxMat;

    // check whether we've visited the link before and set material accordingly
    if (localStorage.getItem(_project.project_id) == "visited") {
      textBoxMat = this.linkVisitedMaterial;
    } else {
      textBoxMat = this.linkMaterial;
    }

    let filename = "images/project_thumbnails/" + _project.project_id + ".png";

    let tex = this.textureLoader.load(filename);
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

    // parse zoom room status
    var status_code = _project.zoom_status;
    let status = "";
    // status_code = 1;
    if (status_code == "1") {
      var statusBoxGemoetry = new THREE.BoxGeometry(linkDepth, 0.125, 0.5);
      var statusSign = new THREE.Mesh(
        statusBoxGemoetry,
        this.statusBoxMaterial
      );
      status = "Live now!";
      var statusTextMesh = createSimpleText(status, statusColor, fontSize, this.font);
      statusTextMesh.position.x += linkDepth / 2 + 0.01;
      statusTextMesh.position.y -= 0.0625;
      statusTextMesh.rotateY(Math.PI / 2);
      statusSign.add(statusTextMesh);
      statusSign.position.y += 0.25;
      statusSign.position.x += 0.01;

      imageSign.add(statusSign);
    }

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
  zoomStatusDecoder(status) {
    if (status == "0") {
      return "Currently Offline";
    } else if (status == "1") {
      return "Currently Live";
    } else if (status == "2") {
      return "Project Creator Will Be Right Back";
    } else if (status == "3") {
      return "Room Full Try Again Soon";
    } else {
      return "";
    }
  }
  generateProjectModal(project) {
    // parse project descriptions to render without &amp; etc.
    // https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript

    if (!document.getElementsByClassName("project-modal")[0]) {
      localStorage.setItem(project.project_id, "visited");

      let id = project.project_id;
      let name = project.project_name;
      let pitch = project.elevator_pitch;
      let description = project.description;
      let link = project.zoom_link;
      let room_status = this.zoomStatusDecoder(project.zoom_status);

      let modalEl = document.createElement("div");
      modalEl.className = "project-modal";
      modalEl.id = id + "_modal";

      let contentEl = document.createElement("div");
      contentEl.className = "project-modal-content";

      let closeButton = document.createElement("button");
      closeButton.addEventListener("click", () => {
        modalEl.remove();
        this.controls.lock();
        // https://stackoverflow.com/questions/19426559/three-js-access-scene-objects-by-name-or-id
        let now = Date.now();
        let link = this.scene.getObjectByName(id);
        link.userData.lastVisitedTime = now;
      });
      closeButton.innerHTML = "X";

      let projectImageEl = document.createElement("img");
      let filename = "https://itp.nyu.edu" + project.image;
      // let filename = "images/project_thumbnails/" + project.project_id + ".png";
      projectImageEl.src = filename;
      projectImageEl.className = "project-modal-img";

      let titleEl = document.createElement("h1");
      titleEl.innerHTML = this.parseText(name);
      titleEl.className = "project-modal-title";

      // names
      let names = "";
      for (let i = 0; i < project.users.length; i++) {
        names += project.users[i].user_name;
        if (i < project.users.length - 1) {
          names += " & ";
        }
      }
      let namesEl = document.createElement("p");
      namesEl.innerHTML = names;
      namesEl.className = "project-modal-names";

      let elevatorPitchHeaderEl = document.createElement("p");
      elevatorPitchHeaderEl.innerHTML = "Elevator Pitch";
      let elevatorPitchEl = document.createElement("p");
      elevatorPitchEl.innerHTML = this.parseText(pitch);
      elevatorPitchEl.className = "project-modal-text";

      let descriptionHeaderEl = document.createElement("p");
      descriptionHeaderEl.innerHTML = "Description";
      let descriptionEl = document.createElement("p");
      descriptionEl.innerHTML = this.parseText(description);
      descriptionEl.className = "project-modal-text";

      let talkToCreatorDiv = document.createElement("div");
      talkToCreatorDiv.className = "project-modal-links-header";
      talkToCreatorDiv.innerHTML =
        "Talk To The Project Creator In The Zoom Room:";

      let linksDiv = document.createElement("div");
      linksDiv.className = "project-modal-link-container";

      let projectLinkEl = document.createElement("a");
      // projectLinkEl.href = link;
      projectLinkEl.href = project.url;
      projectLinkEl.innerHTML = "Project Website";
      projectLinkEl.target = "_blank";
      projectLinkEl.rel = "noopener noreferrer";

      let zoomLinkEl = document.createElement("a");
      // zoomLinkEl.href = link
      zoomLinkEl.href = link;
      zoomLinkEl.innerHTML = "Zoom Room - " + room_status;
      zoomLinkEl.target = "_blank";
      zoomLinkEl.rel = "noopener noreferrer";

      linksDiv.appendChild(projectLinkEl);
      linksDiv.innerHTML += "&nbsp;&nbsp;&nbsp;*&nbsp;&nbsp;&nbsp;";
      linksDiv.appendChild(zoomLinkEl);

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
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
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
    if (localStorage.getItem(link.userData.project.project_id) == "visited") {
      mat = this.linkVisitedMaterial;
    } else {
      mat = this.linkMaterial;
    }
    // console.log(link);
    link.children[0].material = mat;
  }

  activateHighlightedProject() {
    if (this.hightlightedProjectId != -1) {
      let link = this.scene.getObjectByName(this.hightlightedProjectId);
      if (link != null) {
        this.controls.unlock();
        this.generateProjectModal(link.userData.project);
        hackToRemovePlayerTemporarily();
      }
    }
  }

  update(){
      this.highlightHyperlinks();
  }

}
