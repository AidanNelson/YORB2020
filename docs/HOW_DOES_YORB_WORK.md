## How does Yorb work?  

YORB 2020 is a website which allows multiple people to cohabitate in the same rendered 3D environment and communicate with one another in real time using their webcam audio and video. It is built using a whole host of [Web APIs](https://developer.mozilla.org/en-US/docs/Web/API), including the following:
   
* [WebGL (*Web Graphics Language*)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) is used to render the 3D environment of Yorb and everything in it,  
* [WebRTC (*Web Real Time Communication*)](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) is used to faciliate real-time audio and video communication between the various people in the Yorb space,
* [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/Websockets_API) are used to faciliate communication between the people in the space (commonly known as *clients* in the web development world) and a server.  This communication contains information such as where a client is in the 3D space and details of their audio & video webcam streams

Each of these WebAPIs are used with the help of a library.  These libraries make the process of implementing commonly used features **much easier** and we are **very grateful** to the open-source community and the individual contributors and maintains of the libraries we use!  Here are some of the libraries in use by Yorb:


#### Libraries:

* [THREE.js](https://threejs.org/) is a javascript library for creating and interacting within 3D environments. In addition to making it much easier to use the [WebGL API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API), THREE.js also implements movement controls, interactions between people and 3D objects, and much more.

* [Mediasoup](https://mediasoup.org/) is collection of several libraries which make it possible to implement [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) communications (webcam audio and video) between people in the Yorb.  More information on how this works can be found on [this documentation page](./REAL_TIME_COMMUNICATIONS.md).


* [Socket.io](https://socket.io/) is a javascript library which implements [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/Websockets_API) for *"real-time, bidirectional and event-based communication."*  YORB uses socket.io for the following purposes:
    * Creating a multiplayer environment: each client uses sockets to share information such as when they enter and leave the space and the position and rotation of their character in 3D space
      
    * Allowing audio/video communication by managing [Mediasoup signaling](https://mediasoup.org/documentation/v3/communication-between-client-and-server)





## Codebase:

Because this project is quite large, it is split across a number of files. 


#### Server-side:

* [server.js](/server.js): this file contains all of the server logic
* [config.js](/config.js): this file contains Mediasoup Router configuration settings

#### Client-side:

* [index.js](/src/index.js): this file contains all of the client side socket setup and Mediasoup signaling
* [scene.js](/src/scene.js): this file exposes the `Scene` class which contains all of the three.js scene logic (interaction in the 3D space)
