import { redrawVideoCanvas, makeVideoTextureAndMaterial } from "./utils";
import {
    pauseAllConsumersForPeer,
    resumeAllConsumersForPeer,
  } from "./index.js";
  
  
const THREE = require("./libs/three.min.js");

export class Clients {
  constructor(scene, clients) {
    this.scene = scene;
    this.clients = clients;
  }

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Clients 👫

  // add a client meshes, a video element and  canvas for three.js video texture
  addClient(_id) {
    let _body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1, 0.5),
      new THREE.MeshNormalMaterial()
    );

    let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial(_id);

    let _head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), videoMaterial);

    // set position of head before adding to parent object
    _body.position.set(0, 0, 0);
    _head.position.set(0, 1, 0);

    // https://threejs.org/docs/index.html#api/en/objects/Group
    var group = new THREE.Group();
    group.add(_body);
    group.add(_head);

    // add group to scene
    this.scene.add(group);

    console.log("Adding client to scene: " + _id);

    this.clients[_id].group = group;
    this.clients[_id].texture = videoTexture;
    this.clients[_id].desiredPosition = new THREE.Vector3();
    // this.clients[_id].desiredRotation = new THREE.Quaternion();
  }

  removeClient(_id) {
    this.scene.remove(this.clients[_id].group);
  }

  // overloaded function can deal with new info or not
  updateClientPositions(_clientProps) {
    for (let _id in _clientProps) {
      // we'll update ourselves separately to avoid lag...
      if (_id in this.clients) {
        if (_id != this.mySocketID) {
          this.clients[_id].desiredPosition = new THREE.Vector3(
            _clientProps[_id].position[0],
            _clientProps[_id].position[1],
            _clientProps[_id].position[2]
          );
          // this.clients[_id].desiredRotation = new THREE.Quaternion().fromArray(_clientProps[_id].rotation)
          let euler = new THREE.Euler(
            0,
            _clientProps[_id].rotation[1],
            0,
            "XYZ"
          );
          this.clients[_id].group.setRotationFromEuler(euler);
        }
      }
    }
  }

  // TODO make this simpler...? more performant?
  updatePositions() {
    let snapDistance = 0.5;
    // let snapAngle = 0.2; // radians
    for (let _id in this.clients) {
      if (this.clients[_id].group) {
        this.clients[_id].group.position.lerp(
          this.clients[_id].desiredPosition,
          0.2
        );
        if (
          this.clients[_id].group.position.distanceTo(
            this.clients[_id].desiredPosition
          ) < snapDistance
        ) {
          this.clients[_id].group.position.set(
            this.clients[_id].desiredPosition.x,
            this.clients[_id].desiredPosition.y,
            this.clients[_id].desiredPosition.z
          );
        }
      }
    }
  }

  updateVideoTextures() {
    // update for the clients
    for (let _id in this.clients) {
      let remoteVideo = document.getElementById(_id + "_video");
      let remoteVideoCanvas = document.getElementById(_id + "_canvas");
      if (remoteVideo != null && remoteVideoCanvas != null) {
        redrawVideoCanvas(
          remoteVideo,
          remoteVideoCanvas,
          this.clients[_id].texture
        );
      }
    }
  }


   //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Audio 📣

  updateClientVolumes() {
    for (let _id in this.clients) {
      if (this.clients[_id].audioElement) {
        let distSquared = this.camera.position.distanceToSquared(
          this.clients[_id].group.position
        );
        if (distSquared > this.distanceThresholdSquared) {
          // TODO pause consumer here, rather than setting volume to zero
          this.clients[_id].audioElement.volume = 0;
        } else {
          // from lucasio here: https://discourse.threejs.org/t/positionalaudio-setmediastreamsource-with-webrtc-question-not-hearing-any-sound/14301/29
          let volume = Math.min(1, this.rolloffNumerator / distSquared);
          this.clients[_id].audioElement.volume = volume;
        }
      }
    }
  }

  getClosestPeers() {
    let peerIDs = [];
    for (let _id in this.clients) {
      let distSquared = this.camera.position.distanceToSquared(
        this.clients[_id].group.position
      );
      if (distSquared <= this.distanceThresholdSquared) {
        peerIDs.push(_id);
      }
    }
    return peerIDs;
  }

  selectivelyPauseAndResumeConsumers() {
    for (let _id in this.clients) {
      let distSquared = this.camera.position.distanceToSquared(
        this.clients[_id].group.position
      );
      if (distSquared > this.distanceThresholdSquared) {
        pauseAllConsumersForPeer(_id);
      } else {
        resumeAllConsumersForPeer(_id);
      }
    }
  }

  // At the moment, this just adds a .audioElement parameter to a client stored under _id
  // which will be updated above
  createOrUpdatePositionalAudio(_id) {
    let audioElement = document.getElementById(_id + "_audio");
    if (audioElement == null) {
      console.log("No audio element found for user with ID: " + _id);
      return;
    }
    this.clients[_id].audioElement = audioElement;
  }

}
