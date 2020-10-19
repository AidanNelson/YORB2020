import {
    mySocketID,
    socket,
       yorbScene
} from './index'

let localCam,
device,
joined,
localScreen,
recvTransport,
sendTransport,
camVideoProducer,
camAudioProducer,
screenVideoProducer,
screenAudioProducer,
// currentActiveSpeaker = {},
consumers = [],
pollingInterval,
webcamVideoPaused = false,
webcamAudioPaused = false,
screenShareVideoPaused = false,
screenShareAudioPaused = false;

import * as mediasoup from "mediasoup-client";
import debugModule from "debug";

const log = debugModule("YORB");
const warn = debugModule("YORB:WARN");
const err = debugModule("YORB:ERROR");


// adding constraints, VIDEO_CONSTRAINTS is video quality levels
// localMediaCOnstraints is passed to the getUserMedia object to request a lower video quality than the maximum
// I believe some webcam settings may override this request

const VIDEO_CONSTRAINTS = {
    qvga: { width: { ideal: 320 }, height: { ideal: 240 } },
    vga: { width: { ideal: 640 }, height: { ideal: 480 } },
    hd: { width: { ideal: 1280 }, height: { ideal: 720 } },
  };
  let localMediaConstraints = {
    audio: true,
    video: {
      width: VIDEO_CONSTRAINTS.qvga.width,
      height: VIDEO_CONSTRAINTS.qvga.height,
      frameRate: { max: 30 },
    },
  };

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Mediasoup Code:
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

//
// meeting control actions
//

export async function createDevice(){
      // create mediasoup Device
  try {
    device = new mediasoup.Device();
  } catch (e) {
    if (e.name === "UnsupportedError") {
      console.error("browser not supported for video calls");
      return;
    } else {
      console.error(e);
    }
  }
}

export async function joinRoom() {
    if (joined) {
        return
    }
    log('join room')

    try {
        // signal that we're a new peer and initialize our
        // mediasoup-client device, if this is our first time connecting
        let resp = await socket.request('join-as-new-peer')
        let { routerRtpCapabilities } = resp
        if (!device.loaded) {
            await device.load({ routerRtpCapabilities })
        }
        joined = true
    } catch (e) {
        console.error(e)
        return
    }

    await pollAndUpdate() // start this polling loop
}

export async function sendCameraStreams() {
    log('send camera streams')

    // make sure we've joined the room and started our camera. these
    // functions don't do anything if they've already been called this
    // session

    await joinRoom()
    await startCamera()

    // create a transport for outgoing media, if we don't already have one
    if (!sendTransport) {
        sendTransport = await createTransport('send')
    }

    // start sending video. the transport logic will initiate a
    // signaling conversation with the server to set up an outbound rtp
    // stream for the camera video track. our createTransport() function
    // includes logic to tell the server to start the stream in a paused
    // state, if the checkbox in our UI is unchecked. so as soon as we
    // have a client-side camVideoProducer object, we need to set it to
    // paused as appropriate, too.
    if (localCam) {
        camVideoProducer = await sendTransport.produce({
            track: localCam.getVideoTracks()[0],
            encodings: camEncodings(),
            appData: { mediaTag: 'cam-video' },
        })

        if (getCamPausedState()) {
            try {
                await camVideoProducer.pause()
            } catch (e) {
                console.error(e)
            }
        }

        // same thing for audio, but we can use our already-created
        camAudioProducer = await sendTransport.produce({
            track: localCam.getAudioTracks()[0],
            appData: { mediaTag: 'cam-audio' },
        })

        if (getMicPausedState()) {
            try {
                camAudioProducer.pause()
            } catch (e) {
                console.error(e)
            }
        }
    }
}

export async function startScreenshare() {
    log('start screen share')

    // make sure we've joined the room and that we have a sending
    // transport
    await joinRoom()
    if (!sendTransport) {
        sendTransport = await createTransport('send')
    }

    // get a screen share track
    localScreen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
    })

    // create a producer for video
    screenVideoProducer = await sendTransport.produce({
        track: localScreen.getVideoTracks()[0],
        encodings: screenshareEncodings(),
        appData: { mediaTag: 'screen-video' },
    })

    // create a producer for audio, if we have it
    if (localScreen.getAudioTracks().length) {
        screenAudioProducer = await sendTransport.produce({
            track: localScreen.getAudioTracks()[0],
            appData: { mediaTag: 'screen-audio' },
        })
    }

    // handler for screen share stopped event (triggered by the
    // browser's built-in screen sharing ui)
    screenVideoProducer.track.onended = async () => {
        log('screen share stopped')
        try {
            await screenVideoProducer.pause()

            let { error } = await socket.request('close-producer', {
                producerId: screenVideoProducer.id,
            })
            await screenVideoProducer.close()
            screenVideoProducer = null
            if (error) {
                err(error)
            }
            if (screenAudioProducer) {
                let { error } = await socket.request('close-producer', {
                    producerId: screenAudioProducer.id,
                })
                await screenAudioProducer.close()
                screenAudioProducer = null
                if (error) {
                    err(error)
                }
            }
        } catch (e) {
            console.error(e)
        }
    }

    if (screenAudioProducer) {
    }
}
window.screenshare = startScreenshare

export async function startCamera() {
    if (localCam) {
        return
    }
    log('start camera')
    try {
        localCam = await navigator.mediaDevices.getUserMedia(localMediaConstraints)

    } catch (e) {
        console.error('Start camera error', e)
        webcamAudioPaused = true
        webcamVideoPaused = true
        toggleWebcamImage()
        toggleMicrophoneImage()
    }
}

// switch to sending video from the "next" camera device in our device
// list (if we have multiple cameras)
export async function cycleCamera() {
    if (!(camVideoProducer && camVideoProducer.track)) {
        warn('cannot cycle camera - no current camera track')
        return
    }

    log('cycle camera')

    // find "next" device in device list
    let deviceId = await getCurrentDeviceId(),
        allDevices = await navigator.mediaDevices.enumerateDevices(),
        vidDevices = allDevices.filter((d) => d.kind === 'videoinput')
    if (!vidDevices.length > 1) {
        warn('cannot cycle camera - only one camera')
        return
    }
    let idx = vidDevices.findIndex((d) => d.deviceId === deviceId)
    if (idx === vidDevices.length - 1) {
        idx = 0
    } else {
        idx += 1
    }

    // get a new video stream. might as well get a new audio stream too,
    // just in case browsers want to group audio/video streams together
    // from the same device when possible (though they don't seem to,
    // currently)
    log('getting a video stream from new device', vidDevices[idx].label)
    localCam = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: vidDevices[idx].deviceId } },
        audio: true,
    })

    // replace the tracks we are sending
    await camVideoProducer.replaceTrack({ track: localCam.getVideoTracks()[0] })
    await camAudioProducer.replaceTrack({ track: localCam.getAudioTracks()[0] })
}

export async function stopStreams() {
    if (!(localCam || localScreen)) {
        return
    }
    if (!sendTransport) {
        return
    }

    log('stop sending media streams')
    // $('#stop-streams').style.display = 'none';

    let { error } = await socket.request('close-transport', {
        transportId: sendTransport.id,
    })
    if (error) {
        err(error)
    }
    // closing the sendTransport closes all associated producers. when
    // the camVideoProducer and camAudioProducer are closed,
    // mediasoup-client stops the local cam tracks, so we don't need to
    // do anything except set all our local variables to null.
    try {
        await sendTransport.close()
    } catch (e) {
        console.error(e)
    }
    sendTransport = null
    camVideoProducer = null
    camAudioProducer = null
    screenVideoProducer = null
    screenAudioProducer = null
    localCam = null
    localScreen = null
}

export async function leaveRoom() {
    if (!joined) {
        return
    }

    log('leave room')

    // stop polling
    clearInterval(pollingInterval)

    // close everything on the server-side (transports, producers, consumers)
    let { error } = await socket.request('leave')
    if (error) {
        err(error)
    }

    // closing the transports closes all producers and consumers. we
    // don't need to do anything beyond closing the transports, except
    // to set all our local variables to their initial states
    try {
        recvTransport && (await recvTransport.close())
        sendTransport && (await sendTransport.close())
    } catch (e) {
        console.error(e)
    }
    recvTransport = null
    sendTransport = null
    camVideoProducer = null
    camAudioProducer = null
    screenVideoProducer = null
    screenAudioProducer = null
    localCam = null
    localScreen = null
    lastPollSyncData = {}
    consumers = []
    joined = false
}

export async function subscribeToTrack(peerId, mediaTag) {
    log('subscribe to track', peerId, mediaTag)

    // create a receive transport if we don't already have one
    if (!recvTransport) {
        recvTransport = await createTransport('recv')
    }

    // if we do already have a consumer, we shouldn't have called this
    // method
    let consumer = findConsumerForTrack(peerId, mediaTag)
    if (consumer) {
        err('already have consumer for track', peerId, mediaTag)
        return
    }

    // ask the server to create a server-side consumer object and send
    // us back the info we need to create a client-side consumer

    let consumerParameters = await socket.request('recv-track', {
        mediaTag,
        mediaPeerId: peerId,
        rtpCapabilities: device.rtpCapabilities,
    })
    log('consumer parameters', consumerParameters)
    consumer = await recvTransport.consume({
        ...consumerParameters,
        appData: { peerId, mediaTag },
    })
    log('created new consumer', consumer.id)

    // the server-side consumer will be started in paused state. wait
    // until we're connected, then send a resume request to the server
    // to get our first keyframe and start displaying video
    while (recvTransport.connectionState !== 'connected') {
        log('  transport connstate', recvTransport.connectionState)
        await sleep(100)
    }
    // okay, we're ready. let's ask the peer to send us media
    await resumeConsumer(consumer)

    // keep track of all our consumers
    consumers.push(consumer)

    // ui
    await addVideoAudio(consumer, peerId)
}

export async function unsubscribeFromTrack(peerId, mediaTag) {
    let consumer = findConsumerForTrack(peerId, mediaTag)
    if (!consumer) {
        return
    }

    log('unsubscribe from track', peerId, mediaTag)
    try {
        await closeConsumer(consumer)
    } catch (e) {
        console.error(e)
    }
}

// TODO check these functions
export async function pauseAllConsumersForPeer(_id) {
    if (lastPollSyncData[_id]) {
        if (!(_id === mySocketID)) {
            for (let [mediaTag, info] of Object.entries(lastPollSyncData[_id].media)) {
                let consumer = findConsumerForTrack(_id, mediaTag)
                if (consumer) {
                    if (!consumer.paused) {
                        log('Pausing', mediaTag, 'consumer for peer with ID: ' + _id)
                        await pauseConsumer(consumer)
                    }
                }
            }
        }
    }
}

export async function resumeAllConsumersForPeer(_id) {
    if (lastPollSyncData[_id]) {
        if (!(_id === mySocketID)) {
            for (let [mediaTag, info] of Object.entries(lastPollSyncData[_id].media)) {
                let consumer = findConsumerForTrack(_id, mediaTag)
                if (consumer) {
                    if (consumer.paused) {
                        log('Resuming', mediaTag, 'consumer for peer with ID: ' + _id)
                        await resumeConsumer(consumer)
                    }
                }
            }
        }
    }
}

export async function pauseConsumer(consumer) {
    if (consumer) {
        log('pause consumer', consumer.appData.peerId, consumer.appData.mediaTag)
        try {
            await socket.request('pause-consumer', { consumerId: consumer.id })
            await consumer.pause()
        } catch (e) {
            console.error(e)
        }
    }
}

export async function resumeConsumer(consumer) {
    if (consumer) {
        log('resume consumer', consumer.appData.peerId, consumer.appData.mediaTag)
        try {
            await socket.request('resume-consumer', { consumerId: consumer.id })
            await consumer.resume()
        } catch (e) {
            console.error(e)
        }
    }
}

export async function pauseProducer(producer) {
    if (producer) {
        log('pause producer', producer.appData.mediaTag)
        try {
            await socket.request('pause-producer', { producerId: producer.id })
            await producer.pause()
        } catch (e) {
            console.error(e)
        }
    }
}

export async function resumeProducer(producer) {
    if (producer) {
        log('resume producer', producer.appData.mediaTag)
        try {
            await socket.request('resume-producer', { producerId: producer.id })

            await producer.resume()
        } catch (e) {
            console.error(e)
        }
    }
}

async function closeConsumer(consumer) {
    if (!consumer) {
        return
    }
    log('closing consumer', consumer.appData.peerId, consumer.appData.mediaTag)
    try {
        // tell the server we're closing this consumer. (the server-side
        // consumer may have been closed already, but that's okay.)
        await socket.request('close-consumer', { consumerId: consumer.id })
        await consumer.close()

        consumers = consumers.filter((c) => c !== consumer)
        removeVideoAudio(consumer)
    } catch (e) {
        console.error(e)
    }
}

// utility function to create a transport and hook up signaling logic
// appropriate to the transport's direction
//
async function createTransport(direction) {
    log(`create ${direction} transport`)

    // ask the server to create a server-side transport object and send
    // us back the info we need to create a client-side transport
    let transport,
        { transportOptions } = await socket.request('create-transport', {
            direction,
        })
    log('transport options', transportOptions)

    if (direction === 'recv') {
        transport = await device.createRecvTransport(transportOptions)
    } else if (direction === 'send') {
        transport = await device.createSendTransport(transportOptions)
    } else {
        throw new Error(`bad transport 'direction': ${direction}`)
    }

    // mediasoup-client will emit a connect event when media needs to
    // start flowing for the first time. send dtlsParameters to the
    // server, then call callback() on success or errback() on failure.
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        log('transport connect event', direction)

        let { error } = await socket.request('connect-transport', {
            transportId: transportOptions.id,
            dtlsParameters,
        })
        if (error) {
            err('error connecting transport', direction, error)
            errback()
            return
        }
        callback()
    })

    if (direction === 'send') {
        // sending transports will emit a produce event when a new track
        // needs to be set up to start sending. the producer's appData is
        // passed as a parameter
        transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
            log('transport produce event', appData.mediaTag)
            // we may want to start out paused (if the checkboxes in the ui
            // aren't checked, for each media type. not very clean code, here
            // but, you know, this isn't a real application.)
            let paused = false
            if (appData.mediaTag === 'cam-video') {
                paused = getCamPausedState()
            } else if (appData.mediaTag === 'cam-audio') {
                paused = getMicPausedState()
            }
            // tell the server what it needs to know from us in order to set
            // up a server-side producer object, and get back a
            // producer.id. call callback() on success or errback() on
            // failure.

            let { error, id } = await socket.request('send-track', {
                transportId: transportOptions.id,
                kind,
                rtpParameters,
                paused,
                appData,
            })
            if (error) {
                err('error setting up server-side producer', error)
                errback()
                return
            }
            callback({ id })
        })
    }

    // for this simple demo, any time a transport transitions to closed,
    // failed, or disconnected, leave the room and reset
    //
    transport.on('connectionstatechange', async (state) => {
        log(`transport ${transport.id} connectionstatechange ${state}`)
        // for this simple sample code, assume that transports being
        // closed is an error (we never close these transports except when
        // we leave the room)
        if (state === 'closed' || state === 'failed' || state === 'disconnected') {
            log('transport closed ... leaving the room and resetting')
            // leaveRoom();
            alert('Your connection failed.  Please restart the page')
        }
    })

    return transport
}

//
// polling/update logic
//

async function pollAndUpdate() {
    log('Polling server for current peers array!')
    let { peers, error } = await socket.request('sync')

    if (error) {
        err('PollAndUpdateError: ', error)
    }

    if (!mySocketID in peers) {
        warn("Server doesn't think you're connected!")
    }

    // decide if we need to update tracks list and video/audio
    // elements. build list of peers, sorted by join time, removing last
    // seen time and stats, so we can easily do a deep-equals
    // comparison. compare this list with the cached list from last
    // poll.

    // auto-subscribe to their feeds:
    // TODO auto subscribe at lowest spatial layer
    let closestPeers = yorbScene.getClosestPeers()
    for (let id in peers) {
        // for each peer...
        if (id !== mySocketID) {
            // if it isnt me...
            if (closestPeers.includes(id)) {
                // and if it is close enough in the 3d space...
                for (let [mediaTag, info] of Object.entries(peers[id].media)) {
                    // for each of the peer's producers...
                    if (!findConsumerForTrack(id, mediaTag)) {
                        // that we don't already have consumers for...
                        log(`auto subscribing to track that ${id} has added`)
                        await subscribeToTrack(id, mediaTag)
                    }
                }
            }
        }
    }

    // if a peer has gone away, we need to close all consumers we have
    // for that peer and remove video and audio elements
    for (let id in lastPollSyncData) {
        if (!peers[id]) {
            log(`Peer ${id} has exited`)
            consumers.forEach((consumer) => {
                if (consumer.appData.peerId === id) {
                    closeConsumer(consumer)
                }
            })
        }
    }

    // if a peer has stopped sending media that we are consuming, we
    // need to close the consumer and remove video and audio elements
    consumers.forEach((consumer) => {
        let { peerId, mediaTag } = consumer.appData
        if (!peers[peerId]) {
            log(`Peer ${peerId} has stopped transmitting ${mediaTag}`)
            closeConsumer(consumer)
        } else if (!peers[peerId].media[mediaTag]) {
            log(`Peer ${peerId} has stopped transmitting ${mediaTag}`)
            closeConsumer(consumer)
        }
    })

    // push through the paused state to new sync list
    lastPollSyncData = peers

    setTimeout(pollAndUpdate, 1000)
}

function findConsumerForTrack(peerId, mediaTag) {
    return consumers.find((c) => c.appData.peerId === peerId && c.appData.mediaTag === mediaTag)
}

//
// -- user interface --
//

export function getCamPausedState() {
    return webcamVideoPaused
}

export function getMicPausedState() {
    return webcamAudioPaused
}

export function getScreenPausedState() {
    return screenShareVideoPaused
}

export function getScreenAudioPausedState() {
    return screenShareAudioPaused
}

export async function toggleWebcamVideoPauseState() {
    if (getCamPausedState()) {
        resumeProducer(camVideoProducer)
    } else {
        pauseProducer(camVideoProducer)
    }
    webcamVideoPaused = !webcamVideoPaused
}

export async function toggleWebcamAudioPauseState() {
    if (getMicPausedState()) {
        resumeProducer(camAudioProducer)
    } else {
        pauseProducer(camAudioProducer)
    }
    webcamAudioPaused = !webcamAudioPaused
}

export async function toggleScreenshareVideoPauseState() {
    if (getScreenPausedState()) {
        pauseProducer(screenVideoProducer)
    } else {
        resumeProducer(screenVideoProducer)
    }
    screenShareVideoPaused = !screenShareVideoPaused
}

export async function toggleScreenshareAudioPauseState() {
    if (getScreenAudioPausedState()) {
        pauseProducer(screenAudioProducer)
    } else {
        resumeProducer(screenAudioProducer)
    }
    screenShareAudioPaused = !screenShareAudioPaused
}

function addVideoAudio(consumer, peerId) {
    if (!(consumer && consumer.track)) {
        return
    }
    let elementID = `${peerId}_${consumer.kind}`
    let el = document.getElementById(elementID)

    // set some attributes on our audio and video elements to make
    // mobile Safari happy. note that for audio to play you need to be
    // capturing from the mic/camera
    if (consumer.kind === 'video') {
        if (el == null) {
            console.log('Creating video element for user with ID: ' + peerId)
            el = document.createElement('video')
            el.id = `${peerId}_${consumer.kind}`
            el.autoplay = true
            el.muted = true // necessary for
            el.style = 'visibility: hidden;'
            document.body.appendChild(el)
            el.setAttribute('playsinline', true)
        }

        // TODO: do i need to update video width and height? or is that based on stream...?
        console.log('Updating video source for user with ID: ' + peerId)
        el.srcObject = new MediaStream([consumer.track.clone()])
        el.consumer = consumer

        // let's "yield" and return before playing, rather than awaiting on
        // play() succeeding. play() will not succeed on a producer-paused
        // track until the producer unpauses.
        el.play()
            .then(() => {})
            .catch((e) => {
                console.log('Play video error: ' + e)
                err(e)
            })
    } else {
        // Positional Audio Works in Firefox:
        // Global Audio:
        if (el == null) {
            console.log('Creating audio element for user with ID: ' + peerId)
            el = document.createElement('audio')
            el.id = `${peerId}_${consumer.kind}`
            document.body.appendChild(el)
            el.setAttribute('playsinline', true)
            el.setAttribute('autoplay', true)
        }

        console.log('Updating <audio> source object for client with ID: ' + peerId)
        el.srcObject = new MediaStream([consumer.track.clone()])
        el.consumer = consumer
        el.volume = 0 // start at 0 and let the three.js scene take over from here...
        yorbScene.createOrUpdatePositionalAudio(peerId)

        // let's "yield" and return before playing, rather than awaiting on
        // play() succeeding. play() will not succeed on a producer-paused
        // track until the producer unpauses.
        el.play()
            .then(() => {})
            .catch((e) => {
                console.log('Play audio error: ' + e)
                err(e)
            })
    }
}

function removeVideoAudio(consumer) {
    document.querySelectorAll(consumer.kind).forEach((v) => {
        if (v.consumer === consumer) {
            v.parentNode.removeChild(v)
        }
    })
}

export async function getCurrentDeviceId() {
    if (!camVideoProducer) {
        return null
    }
    let deviceId = camVideoProducer.track.getSettings().deviceId
    if (deviceId) {
        return deviceId
    }
    // Firefox doesn't have deviceId in MediaTrackSettings object
    let track = localCam && localCam.getVideoTracks()[0]
    if (!track) {
        return null
    }
    let devices = await navigator.mediaDevices.enumerateDevices(),
        deviceInfo = devices.find((d) => d.label.startsWith(track.label))
    return deviceInfo.deviceId
}

//
// encodings for outgoing video
//

// just two resolutions, for now, as chrome 75 seems to ignore more
// than two encodings
//
const CAM_VIDEO_SIMULCAST_ENCODINGS = [
    { maxBitrate: 36000, scaleResolutionDownBy: 2 },
    // { maxBitrate: 96000, scaleResolutionDownBy: 2 },
    // { maxBitrate: 680000, scaleResolutionDownBy: 1 },
]

function camEncodings() {
    return CAM_VIDEO_SIMULCAST_ENCODINGS
}

// how do we limit bandwidth for screen share streams?
//
function screenshareEncodings() {
    null
}

//
// promisified sleep
//

async function sleep(ms) {
    return new Promise((r) => setTimeout(() => r(), ms))
}
