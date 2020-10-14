## How does the video work in YORB?

There are a number of steps this application needs to take to get incoming webcam video into the THREE.js scene.  This document will go through these steps, where they happen in the code, and how you might add to or change this functionality to suit your particular needs.  *(Note that this will not go over WebRTC signaling or how the video actually gets to your machine in the first place)* 

When the server tells us that there is a new client, we do what any caring member of a commmunity would do: we set things up such that this incoming client feels welcome.  Within the THREE.js scene, we create the client's *avatar* (their representation in 3D space).  Within the WebRTC signaling code, we accept their incoming video & audio streams (if they have a webcam enabled).

#### In the THREE.js scene:
* An avatar is created in the `addClient()` function.  This function does the following:
    * calls the `makeVideoTextureAndMaterial()` function to create a - you guessed it - `videoTexture` and a `videoMaterial` for this client.  What are these and why should I care, you ask? This is what allows us to get video within the THREE.js scene.  This is what allows us to see one another!  The `videoMaterial` is what is used to create the client's THREE.js Mesh.  The `videoTexture` is what that `videoMaterial` uses to determine how it looks.  For more on this, check out [Discover three.js](https://discoverthreejs.com/book/first-steps/first-scene/)!
* This client's avatar's `videoTexture` (see above) is updated each and every frame from that client's HTML `<video>` element **if and only if** that HTML `<video>` element exists


#### In  Index.js

* A client's incoming video stream is turned into a [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) and attached to an HTML `<video>` element (which is hidden by default!)
