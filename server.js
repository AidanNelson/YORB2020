/* 
* YORB 2020
* 
* This server uses code from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* And a WEBRTC chat app made by Mikołaj Wargowski:
* https://github.com/Miczeq22/simple-chat-app
*
* Aidan Nelson, April 2020
*
*/

const config = require('./config');
const debugModule = require('debug');
const mediasoup = require('mediasoup');
const express = require('express');
const https = require('https');
const fs = require('fs');

require('dotenv').config();
// if we are in production environment, copy over config from .env file:
if (process.env.NODE_ENV == 'production') {
  config.sslCrt = process.env.PRODUCTION_CERT;
  config.sslKey = process.env.PRODUCTION_KEY;
  config.httpIp = process.env.PRODUCTION_IP;

  config.mediasoup.webRtcTransport.listenIps = [
    { ip: '127.0.0.1', announcedIp: null },
    { ip: process.env.PRODUCTION_IP, announcedIp: null }
  ];
}

const expressApp = express();
let httpsServer;
let io;
let socketIO = require('socket.io');

const log = debugModule('demo-app');
const warn = debugModule('demo-app:WARN');
const err = debugModule('demo-app:ERROR');

// one mediasoup worker and router
//
let worker, router, audioLevelObserver;

//
// and one "room" ...
//
const roomState = {
  // external
  peers: {},
  activeSpeaker: { producerId: null, volume: null, peerId: null },
  // internal
  transports: {},
  producers: [],
  consumers: []
}
//
// for each peer that connects, we keep a table of peers and what
// tracks are being sent and received. we also need to know the last
// time we saw the peer, so that we can disconnect clients that have
// network issues.
//
// for this simple demo, each client polls the server at 1hz, and we
// just send this roomState.peers data structure as our answer to each
// poll request.
//
// [peerId] : {
//   joinTs: <ms timestamp>
//   lastSeenTs: <ms timestamp>
//   media: {
//     [mediaTag] : {
//       paused: <bool>
//       encodings: []
//     }
//   },
//   stats: {
//     producers: {
//       [producerId]: {
//         ...(selected producer stats)
//       }
//     consumers: {
//       [consumerId]: { ...(selected consumer stats) }
//     }
//   }
//   consumerLayers: {
//     [consumerId]:
//         currentLayer,
//         clientSelectedLayer,
//       }
//     }
//   }
// }
//
// we also send information about the active speaker, as tracked by
// our audioLevelObserver.
//
// internally, we keep lists of transports, producers, and
// consumers. whenever we create a transport, producer, or consumer,
// we save the remote peerId in the object's `appData`. for producers
// and consumers we also keep track of the client-side "media tag", to
// correlate tracks.
//

//
// our http server needs to send 'index.html' and 'client-bundle.js'.
// might as well just send everything in this directory ...
//

expressApp.use(express.static(__dirname + "/public"));



// Add environment variables:
// https://www.twilio.com/blog/2017/08/working-with-environment-variables-in-node-js.html
// https://stackoverflow.com/questions/21831945/heroku-node-env-environment-variable

// Twilio network traversal (ICE servers) for WebRTC peer connections
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;

// const twilioClient = require('twilio')(accountSid, authToken);
// let iceToken;
// let iceServers = null;
// let iceServers = [{
//   url: 'stun:global.stun.twilio.com:3478?transport=udp',
//   urls: 'stun:global.stun.twilio.com:3478?transport=udp'
// },
// {
//   url: 'turn:global.turn.twilio.com:3478?transport=udp',
//   username:
//     '5ede97dbe494bd3996915935ec364d8fc16c65bd47a2dc54c016a553a987c5a1',
//   urls: 'turn:global.turn.twilio.com:3478?transport=udp',
//   credential: 'bg0qfo0rQW+ZjibIUirV7XZYFZyPMF3K1U+dL1fBub8='
// },
// {
//   url: 'turn:global.turn.twilio.com:3478?transport=tcp',
//   username:
//     '5ede97dbe494bd3996915935ec364d8fc16c65bd47a2dc54c016a553a987c5a1',
//   urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
//   credential: 'bg0qfo0rQW+ZjibIUirV7XZYFZyPMF3K1U+dL1fBub8='
// },
// {
//   url: 'turn:global.turn.twilio.com:443?transport=tcp',
//   username:
//     '5ede97dbe494bd3996915935ec364d8fc16c65bd47a2dc54c016a553a987c5a1',
//   urls: 'turn:global.turn.twilio.com:443?transport=tcp',
//   credential: 'bg0qfo0rQW+ZjibIUirV7XZYFZyPMF3K1U+dL1fBub8='
// }];

// twilioClient.tokens.create().then(token => {
//   iceToken = token;
//   iceServers = token.iceServers;
//   console.log("Got ICE Server credentials from Twilio.");
//   console.log(token.iceServers);
// });

let clients = {};
let testProjects = [
  {
    "project_id": "8556",
    "project_name": "e-Cycle: The Making and Discarding of Electronics",
    "elevator_pitch": "A mobile exhibit interactive about the life cycle of electronics seen through the lens of labor, materials and waste. E-Cycle: the Making &amp;amp; Discarding of Electronics visualizes the complex flow of electronic materials in order to reveal the efforts and conflicts involved in the manufacturing and disposing of digital devices.",
    "description": "Electronics require an inordinate amount of material and labor to manufacture. From the mining sites to the clean room, there are thousands of hands, chemicals, and minerals that make a technological product possible. In the process of creating high technology there are significant amounts of waste generated that give rise to health and environmental issues. Waste and wasting happens throughout the manufacturing and supply chain, not just at the point of disposal. In addition, the infrastructure for discarding an electronic item consists of a multitude of processes and machinery. Few of our current disposal methods, including recycling, are optimal &amp;ndash; our options take for granted the high labor, environmental, energy and health impacts required to create the technological products we&amp;#039;ve come to rely on. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe purpose of this project is not to condemn high technology, but rather to show the complicated movement of electronic materials and to empower others to imagine alternatives to this current cycle. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://nyu.zoom.us/j/96098602432?pwd=YVQwZGI2eUh5dEhGTTJ0SzY2QXJ2dz09"
  },
  {
    "project_id": "8558",
    "project_name": "You Are Not the Only Particle in Universe",
    "elevator_pitch": "A multi-media performance using home lamps as performing instruments. You Are Not the Only Particle in Universe is an experiment of transforming home lamps to new interfaces of performing music and light as interactive props in performance.",
    "description": "I have a background in stage lighting design. In most stage performances, designers hide the light instrument above the stage or on the side behind curtains where audience could not see the light source itself. When I designed lighting for dance, I always thought I am also creating choreography but with medium of light. With this experience, I started to wonder what if I put light on stage, so that they are no longer complimentary roles in performance, but instead an actor, an expressive performing instrument on stage. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nYou Are Not the Only Particle in Universe is a continued research from a past performance project, In a Box, which I first created a performance that included a custom made instrument with home lamps and home lamp switches. My thesis project further develops this instrument with more interactive functions and allows the performer to create more versatile music and movement.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nLight 2.0 is a multimedia performance that combines light, music, and movement, when light and music are not complementary roles and movement and performers are also not leading roles. Together, all these elements become performing instruments on stage.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe performer can bow, tap, or spin the lamps to create various combinations of music, light, and movement. When bowing the lamp with a bow or tap near the sensors, it looks like bowing a cello and plucking. The performer can also spin the lamp shade to activate different parts of music composition.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://nyu.zoom.us/j/2673933378"
  },
  {
    "project_id": "8561",
    "project_name": "Structure-Body: Truss I",
    "elevator_pitch": "What unique artistic possibilities or properties might emerge when combining the movement forms of contemporary dance with the interactive installations and objects enabled by digital technology? Structure-Body: Truss I is an experiment exploring this new ground.",
    "description": "Structure-Body: Truss I is an interactive kinetic sculpture designed to be danced with in a performance setting. The sculpture is a large metal &amp;ldquo;truss&amp;rdquo; (a long structure of connected beams, like the arm of a crane or the side of a bridge) mounted on a rotating base. Using distance sensors and a motor, it responds to the movement and presence of bodies nearby, moving away when approached and following back when retreated from. Nine feet tall at its highest point and reaching down into the performance space to cross the dancer&amp;rsquo;s body at chest level, it forms an industrial structure which dancers must navigate, but which also acts as another body on stage, moving with and reacting to dancers&amp;rsquo; movements, mechanical but seemingly alive.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nTruss I is meant as a prototype, demonstration, and inspiration for further choreographic research. The boom in inexpensive hobby electronics and the online availability of technical know-how has enabled artists to build machines that can sense and respond to their environment. What can happen when these sorts of machines are incorporated into contemporary dance, a field of performance structured around space, form, movement, physical touch, and physical force - all things which today&amp;rsquo;s electronics can readily sense and manipulate? Truss I offers a jumping-off point for that discussion. It creates a simple dialogue between the movement of a dancer and the movement of a physical object, but even this simple interaction opens up infinite choreographic possibilities. Moreover, due to its large size and its placement at the level of the dancer&amp;rsquo;s torso, Truss I plays with space as well. It is not only visually imposing; it obstructs the dancer&amp;rsquo;s path and divides up the space around itself. How will dance change if the dance space can reconfigure itself continuously in reaction to the dancer&amp;rsquo;s actions?",
    "zoom_link": ""
  },
  {
    "project_id": "8577",
    "project_name": "Depth2Web",
    "elevator_pitch": "Depth2Web is a desktop platform that allows depth feeds to be used in the web space.",
    "description": "Depth2Web is a device agnostic desktop application that sends depth feed to the web. It can be used to stream raw depth feed or analyzed data of the feed; constrained only by threshold and joints detected. The platform currently supports various versions of Intel RealSense and versions of Microsoft Kinect sensors and the platform standardizes data from the different depth cameras. All standardized feed from depth cameras are sent via peer network as stream objects. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe application aims to encourage more people to make web applications for users to interact beyond the mouse and keyboard. Depth2Web provides an opportunity for artists, creators and programmers to use depth and body motion as modes of web interaction by making the use of depth cameras more approachable and by  supporting a large range of devices that can be  used interchangeably.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8578",
    "project_name": "Complication of the Computer Mouse",
    "elevator_pitch": "As the mouse becomes a less necessary element within the continuously emerging ensembles of ubiquitous networked computing my thesis seeks to ask questions not only of how humans and computers shape one another but of what is surfaced when the mouse is taken on its own terms, as the element which entangles humans with computers.",
    "description": "Inside the 1984 Macintosh computer manual there are six pages which describe how to use a computer mouse. In the present, it is the expectation that computer screens are navigated with your hand. The mouse, on the other hand, has become an optional device, its function assumed to be intuitive to the human user. As the mouse becomes a less necessary element within the continuously emerging ensembles of ubiquitous networked computing my thesis seeks to ask questions not only of how humans and computers shape one another but of what is surfaced when the mouse is taken on its own terms, as the element which entangles humans with computers. If we are to ask questions of the technologies which hold dominion over our daily lives, it might be as urgent as ever that we have a philosophical understanding of them and if we look closely at the mouse as a part of a whole we will also see that the whole is deeply embedded within the mouse itself. I will take this as my starting point by putting forth an understanding of the mouse as a technological element in order to ask meaningful questions of the larger technological ensembles it takes part in.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8579",
    "project_name": "Poles",
    "elevator_pitch": "",
    "description": "",
    "zoom_link": "https://"
  },
  {
    "project_id": "8580",
    "project_name": "Food Infographic: Why Do We Crave Sweet &amp;amp; Salty Foods?",
    "elevator_pitch": "Have you ever wondered why we love sweet and/or salty foods so much?",
    "description": "&amp;ldquo;First we eat, then we do everything else.&amp;rdquo; This famous quote by MFK Fisher shows how much people love food. There is even a category called food porn now. However, too much of anything is bad for you. Today there is not only an excessive amount and choices of food, but information as well. How much is too much? We know foods that are too fatty, sweet or salty are bad for you, but what is the cutline? We look at the nutrition facts on the back but how much is 21% fat? Or six grams of sugar? Is six grams too much or too less?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nTo catch two birds with one stone, I wanted to create an infographic animation that would not only inform users about why we crave sweet and salty foods, but also entertain and raise awareness about how we should be more mindful of what we eat. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nFirst, what is an infographic?  According to the Oxford English Dictionary, means a visual representation of information or data. However, there is a more specific definition. A more apt description would be that it is a collection of imagery, charts, and minimal text that gives an easy-to-understand overview of a topic. Today where huge volumes of new information are constantly being created and our consistent exposure to them, infographics play a huge role in compacting all that data and keeping them simple.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8581",
    "project_name": "Augmented Music Playground",
    "elevator_pitch": "This is the project to turn various things around you or things in Nature into playful inspiring music media so that anybody could enjoy create/co-create music symphony with others and things.",
    "description": "As a jazz pianist, mathematician, STEAM educator, I have been really passionate in delivering the joy to: &amp;lt;br /&amp;gt;\r\n&amp;bull;\tCreate Your Music &amp;lt;br /&amp;gt;\r\n&amp;bull;\tCo-create Music&amp;lt;br /&amp;gt;\r\n&amp;bull;\tCo-exist with diverse daily things / Nature&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nUnder these passions, in this thesis journey, I explored to produce &amp;ldquo;Augmented Music Playgrounds&amp;rdquo;, which aims to turn daily life objects or Nature around you into some musical media, so that people (even with no music backgrounds) could enjoy to create/co-create music through spatial, multi-sensory intuitive interactions with them. &amp;lt;br /&amp;gt;\r\nBasically, I explored 2 main new music media to create or co-create music with others: &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n1.\tFruits/Vegetables/SLIME&amp;hellip; : Turing your weird haptic experiences into music &amp;lt;br /&amp;gt;\r\n2.\tHand-drawing Doodles: Turning Doodles into musical media through magic camera  &amp;lt;br /&amp;gt;\r\nThese could trigger not only hidden, augmented music (or any sound effects) but also visual effects as well. So, you could enjoy music creation, not only by listening, but also by touching, seeing, smelling, tasting(?), and feeling. I believe this research would open up new playful, inclusive, participatory ways of music creation and to turn the &amp;ldquo;music live performance stage&amp;rdquo; into our daily life, like what Minyo or traditional music have been. &amp;lt;br /&amp;gt;\r\nAlso, this project is under the Japanese animistic concept of &amp;ldquo;YAOYOROZUNOKAMI&amp;rdquo; (8 millions of God), in which people respect the soul or divinity inside objects such as stones, rice, water, mountains, toilets, pencils, robots, as well as concepts like numbers, or even abstract things like emptiness. We sense the soul or Kami-sama(God) in everything.  This does not mean that everything is perfect but rather that imperfect diverse divinity is present everywhere which should be respected for and sensed by intuition. Through this thesis project, I tried to let people get aware of these hidden divinities inside objects, by hearing and sensing their &amp;ldquo;singing&amp;rdquo;, which could create the whole, augmented improvisational miracle symphony of our life.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8582",
    "project_name": "Crazy Little Beliefs",
    "elevator_pitch": "Crazy Little Beliefs is a series of whimsical objects that reimagine through the lens of present-day technology some of our common if often irrational beliefs that have persisted through time. Interaction with these objects has been designed to allow users to reflect on their collective past experience and the influences that have shaped their fears and wishes, personalities and perspectives.",
    "description": "When was the last time you wished on a fallen eyelash or said bless you to someone who sneezed? Many of our commonly held beliefs are widely known to be irrational, not based on reasoning, fact or knowledge. Over time and across cultures, people have found ways to explain unexplainable things and to feel control over their fears of the unknown through seemingly random and arbitrary sayings and actions. Studies have shown that this kind of magical thinking decreases as we age. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nCrazy Little Belief aims to recreate the whimsical aspect of our irrational beliefs in the world today that is often automated, machine-operated, and algorithmically optimized. My thesis project consists of three objects, the Cautious, the Visionary, and the Charming, each emphasizing the state of mind of people who believe in it. The purpose of this project is not to critique or dismiss these irrational beliefs and behaviors, but rather to encourage them and remind us that many of our beliefs are part of our culture and identity.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8583",
    "project_name": "God Design",
    "elevator_pitch": "Designing new gods in a contemporary context",
    "description": "Human beings create gods or gods create human beings, that is a romantic question. Growing up in a society where I could be exposed to both polytheism and monotheism, I was thinking, while new gadgets and tools were invented and upgraded to enhance people&amp;rsquo;s lives, gods haven&amp;#039;t been updated for a rather long time. To explore the possibility of creating new gods who could specifically address problems and issues in human&amp;#039;s daily life in a contemporary context, I use the term &amp;ldquo;god design&amp;rdquo; which means utilizing design thinking in creating new gods, everything in this project begins with this concept.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe basic layer of god design is to &amp;ldquo;design&amp;rdquo; new gods that work in a modern way, they use familiar objects that we usually see in our everyday life to impose their power just like the traditional gods use their weapons, however, the scenario they use the objects is not as usual. To showcase the gods and communicate with the audience, a booth-like interactive installation and a website are developed as &amp;ldquo;god search engine&amp;rdquo;, where the audience could input their daily life concern and being returned with a certain god that relates to their input in the form of a card. The installation took the concept of small size &amp;ldquo;pop-up&amp;rdquo; shrines that usually can be found in Japan and India, it will be finished in a hi-tech product aesthetic, and the website will be visually simple and playful.&amp;lt;br /&amp;gt;\r\n \t&amp;lt;br /&amp;gt;\r\nThis project is not aiming at creating a new religion, it is more about looking at everyday life from another angle, focusing on the small daily problems and concerns, delivered in a more absurd and playful way, but still, with its whimsical nature, I hope it could bring positive attitudes and a delightful experience to the audience.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8584",
    "project_name": "New York University Library Website Redesign for Accessibility",
    "elevator_pitch": "My goal is to redesign NYU Library website to make it apply accessibility principles for the people with disabilities.",
    "description": "This is a redesign program for the current NYU Library website to solve its user experience problem. Our users are 53,138 NYU students and the goal of the products is to meet the accessibility requirements of people with disabilities. Study shows there are 20% of students at NYU who have accessibility problems. NYU librarians compile the most useful and appropriate Library resources into the website to help students with their research based on the Library System. Every day students with disabilities browse the library website to search for useful resources, do the research and finish their papers. If the website doesn&amp;rsquo;t meet the metrics of accessibility, it will make resources not be searchable. How could we utilize accessibility metrics to make resources be searchable for students with a disability?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nIf you evaluate the current Libguide system, you will find it not to follow the accessibility principles and is not user-friendly and makes library resources which universities spent millions to buy become hard to be found for students. So my thesis devotes to redesign the system and recode it. I will conduct the accessibility principles to help the library to improve the accessibility problems. Besides, I will give suggestions on the website redesign and code part.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8585",
    "project_name": "The Parallel",
    "elevator_pitch": "The Parallel is a series of VR spatial experience that explores the design of space when you are not bound by the limitations of the physical world.",
    "description": "The Parallel addresses virtual reality as a new medium in designing spatial experience. Instead of using VR as a tool to recreate and replicate the existing environment, It aims to challenge and explore spatial design methods that are without the limitations of the physical world. Within the each designed virtual environment, Sensory perception is deeply informed by the combination of objective properties of light, color, materials, subjective responses, and environmental context.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n\tCan whales fly in the sky? Can you walk on the ocean? The world of Surrealism utilizes the irrational juxtaposition of images to stimulate the imagination; Seeing something so huge yet so light, so solid yet so soft, the world of Lightness will bring you the experience of being easy with pressure and force, gentle and delicate in movement and cheerful in heart; When seemingly walking down the staircases, you enter a door that only takes you back to the top. In the world of Displacement, there is no such thing as a linear journey; For every move you make, you will not be able to distinguish if you are walking on black tiled ground or a gap down to the abyss. In the world of Perception, you are constantly confused and disoriented by the surrounding environment; How do you inspire texture in a world where there is no touch? The light, color, movement and viscosity of objects in space will submerge you into the world of texture; Falling from the sky down into this field of spikes, the world of force puts you on a single path of encountering danger with no consequence. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n\tThe nuance between reality and fantasy fosters a constant complimentary that exists and transmits the experience so that the viewers envision it for themselves. The core of this project is to explore and articulate the possibilities in the design of space with virtual reality technology.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8586",
    "project_name": "Interactive Bench",
    "elevator_pitch": "A form-changing bench that directs human-to-human and human-to-object interaction.",
    "description": "The Interactive Bench is an experimental public furniture design that aims to explore the relation between forms and functions; and the interaction between objects and human beings. Being set up in public places like parks and subway stations, it can perform different shapes by moving the parts dynamically on its seat. It can also detect if humans are seated in certain areas, and then actuator a few playful tangible interactions with the person to express certain abstract emotions or personalities.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8587",
    "project_name": "The Everyone Knows Machine",
    "elevator_pitch": "The Everyone Knows Machine is an installation that stamps a random Twitter post on the player&amp;rsquo;s arm temporarily. By doing so, it evokes empathy for those who suffered from unjustified online-shaming and lets people be more conscious when shaming others.",
    "description": "Cyber-bullying can cause real-life consequences, including physical and psychological damage. For instance, social media shaming really concerns me as it happens frequently. Most of the time the damages and effects of it are unknown to the authors because of the way social media is set up. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nOver-shaming behaviors haven&amp;rsquo;t raised enough public attention. Since studies and researches have been largely focusing on the intervention aspect (e.g. filtering algorithm), I want to tackle this purely digital, social behavior problem in a physical, fun way. Thus, instead of raising a practical UX solution, I come up with The Everyone Knows Machine, an interactive, performative art installation that stamps a player&amp;rsquo;s random Twitter post on the inner side of the player&amp;rsquo;s arm temporarily. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThis project is trying to evoke empathy by giving the audience a similar experience as the subjects, those who are judged or critiqued because of unilateral sides of their online behaviors. In other words, I want to replicate the feeling of being &amp;ldquo;mislabeled&amp;rdquo;. It is not meant to solve cyber-bullying problems. Instead, it aims to raise awareness of unjustified online-shaming. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe experience emphasizes the reflection moment when the participant starts to worry that they might have posted something bad to be stamped on a visible part of their body. It is questioning, &amp;ldquo;Are you comfortable enough with EVERY POST you make that you&amp;rsquo;d wear them on your skin under any circumstances?&amp;rdquo; The assumption is that most people may hesitate to answer &amp;ldquo;yes&amp;rdquo; because anyone may have posted inappropriate words or words that could be misinterpreted due to the lack of contexts. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nAdditionally, this project challenges the lack of accountability and responsibility for online commenting. By making posts as stamps on visible body parts, it creates strong accountability and even identity which links online behaviors with real-life social relationships.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8588",
    "project_name": "Nuclear States of Being",
    "elevator_pitch": "This project investigates the nuclear landscape from social, economic, and environmental issues on the ground.&amp;lt;br /&amp;gt;",
    "description": "The nuclear fuel cycle is a complex set of frictions that travel along a line of gnarled perceptibility, weaving in and out of people&amp;rsquo;s lives at different points in time. This nature makes the net output of the cycle questionable in terms of processes and systems built to continue pushing the atomic era. This project seeks to investigate the nuclear landscape from social, economic, and environmental issues on the ground.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nWhen people think of the word nuclear what comes to mind? Energy, weapons, politics, the environment? The word is so front-loaded with bias that it is difficult for many people to look past this initial perception and see the complex infrastructures built from the ruins of the first atomic bomb. To view into the nuclear world and see what complex ontologies thrive within it will help to expand interest and criticality into the subject matter. I  invite people to look at what the future of this infrastructure could look like and to think more critically about the nature of the current nuclear fuel cycle.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe artifacts created for this thesis project highlight specific points of tension within the cycle. Most specifically, gaps within supply chain knowledge, colonial power dynamics that still have a large grasp of African resource extraction, current high level nuclear waste storage in the United States, an attempt to unflatten the information within the world&amp;rsquo;s uranium market, and lastly, reframing the high level waste cask as a site for memorialization.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8589",
    "project_name": "READING THE STREETS AT ONCE",
    "elevator_pitch": "Digital archive of the street art and signs produced during the Chilean Social Uprising that started in October 2019.",
    "description": "In October 2019, Chile saw one of the biggest social uprisings that continues till the day I submitted this words (May 2020). What started as a strike for a rise of the metro fare escalated to nationwide protests that demand social justice across health, education and pensions. The government&amp;rsquo;s response has only aggravated the movement by empowering the riot police causing multiple violations of human rights. Not being able to directly participate in the movement, it was impossible to walk away from it since every social media feed was dedicated to document and share the events on the street.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIn an effort to keep track and remember the facts I decided to archive the movement through the people&amp;rsquo;s visual expression. For this, I searched and scraped social media and collected over 6000 images that fell into the category of street art and protest signs. By using computer vision methods to extract text and object labels I was able to read and analyze this collection as a whole. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nReading the Streets at Once intends to tell the story of this movement as it develops while reflecting on how and why to archive and its output on memory. The result of this collection is an effective way to understand the diverse sociocultural groups that participate in the movement. To make available the texts and symbols that the people leave behind, combined with filtering and sorting tools, allows the viewer to gather their own conclusions and therefore, understand and acknowledge a social movement.",
    "zoom_link": "https://karinahy.com/reading"
  },
  {
    "project_id": "8590",
    "project_name": "Data in a New Dimension",
    "elevator_pitch": "Data in a New Dimension uses augmented reality to concisely visualize a large dataset for a general audience. The dataset used examines educational outcomes in New York City, considering factors like location, poverty level, and admissions method.",
    "description": "&amp;quot;Excellence in statistical graphics consists of complex ideas communicated with clarity, precision and efficiency.&amp;quot; -Edward Tufte, Data Visualization pioneer&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nVisualization is key for helping people understand the implications of big datasets. However, traditional methods of data visualization (e.g. bar charts, line graphs, scatterplots) often fail to capture attention or interest, because they are seen as uninteresting or difficult to understand. Creating striking, dynamic data visualizations that present data clearly while remaining engaging is crucial to helping inform viewers. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nAugmented reality (AR) has reached a point where it is accessible on common consumer devices like tablets, iPhone, and Android. AR also affords many possibilities to enhance the data presentation: movement, sound, three-dimensionality, and real-time adjustment of features.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nData in a New Dimension is an augmented reality application for iOS that aims to act as a proof of concept of AR for data visualization, while also providing a tool for New York parents of school-aged children to inform and understand the complexities of public high school performance. With a complicated application process requiring eighth graders to rank their choices of over 400 non-charter public high schools spread over the 5 boroughs, Data in a New Dimension aims to clarify the factors affecting school performance.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8591",
    "project_name": "Homo ex Humo",
    "elevator_pitch": "Homo ex Humo (Man from dirt) is a memento mori for nature, an interactive sculpture about the human disconnect from nature.",
    "description": "In the past few centuries humankind has been systematically removing itself from nature. Today we live in a society where &amp;ldquo;nature&amp;rdquo;, is understood as &amp;ldquo;plants&amp;rdquo;, &amp;ldquo;city parks&amp;rdquo;, or &amp;ldquo;landscapes&amp;rdquo;, all of which are sculpted by human hands and must attempt to exist on human terms, at timescales that are ever faster. This installation inverses that relationship, and asks what it would feel like if humans existed in the slow realm, on plant terms. The installation consists of a series of robotic branches protruding from a wall. They react slowly to human presence in the room, and demand people to adjust their movement to exist on their terms, which mimic real natural responses of plants. A failure to slow down will harm the branches and only as the humans leave, will they slowly heal again. Though if a meaningful co-presence is achieved, the branches will thrive and cast the room in a beautiful lumia light.",
    "zoom_link": "https://nyu.zoom.us/j/98000848789?pwd=eUJjbWJaQWxSUHhnMmpueGQ3K1dNQT09"
  },
  {
    "project_id": "8592",
    "project_name": "From needs to customized  Assistive Technologies",
    "elevator_pitch": "Design Framework to transform the needs of people with disabilities and those supporting them describe their ideas of 3d printed assistive technologies",
    "description": "Assistive Technologies are unaffordable and difficult to customize. A contributor factor is that Makers, designers, and fabricators are not developing them enough because they fear they don&amp;rsquo;t have knowledge or communication with end-users. Sometimes people with disabilities and those supporting them are able to identify a task that is difficult to perform and they might have ideas that would help them better perform those tasks. However, rarely do they have the skills required to translate these needs into the specs required to 3D print their solution. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nA design framework must be developed to enhance the collaboration between people with upper motor disabilities, their family members, caregivers, and clinicians, in order to better understand their needs and collect ideas for assistive technologies that can be 3d printed by designers, makers, or fabricators and will subsequently help them become more independent at cooking their own meals.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe first iteration was tested under an approved IRB and used to describe adaptations for home cooking. The goal is that in the future it will be used for multiple health conditions and day-to-day activities. The goal of this project is to be able to understand the way that participants describe their conditions, and ideas and will demonstrate the potential of using visual aids to spark creativity and engage them in a collaborative design process. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe design framework consists of a series of artifacts divided into three main categories, inspired by principles of Human-Centered Design. &amp;quot;Explore&amp;quot; consists on a questionnaire that will help the researcher have more empathy, &amp;quot;Ideate&amp;quot; uses two different artifacts, virtual cards with prompts for participants to &amp;ldquo;fill in the blanks&amp;rdquo; and a PDF with a breakdown of cooking tasks and tools, and &amp;ldquo;Create&amp;rdquo; uses a collaborative drawing and ideation board (Aww app), that will be presented during 1:1 virtual interviews.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8593",
    "project_name": "Grandma&amp;rsquo;s companion",
    "elevator_pitch": "An installations for my grandma to provide awareness of my well-being and daily activities through photographs and voice mail.",
    "description": "While modern technology is making remote communication easier, senior people like my grandma still don&amp;#039;t have many choices. Even learning how to use a smartphone is challenging enough for her and she still prefers to use a flip phone and she&amp;rsquo;s only doing phone calls with it. But phone calls are far from enough for our communication. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nMy thesis project aims to explore a more accessible way to strengthen the bonding and create better companionship for elder people like my grandma. The end goal is to create an easy-to-use product that can show my daily life visually and auditorily to my grandma. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8594",
    "project_name": "Chicken, Parrot and Sparrow",
    "elevator_pitch": "An interactive website features typography animation that inspires audiences to review why and how certain birds in modern urban life aren&amp;#039;t living as birds but being objectified as food or products.",
    "description": "Birds are everywhere in our cities. We eat chicken as food, keeping parrots as pets, and we see sparrows flying across the streets. Between all the living beings, birds are such a unique group of which that&amp;#039;s so close to urban humans as three distinct roles: food, pets, and neighbors.  &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThough humans&amp;#039; needs for birds as products might never be gone, I hope one day all birds could just be flapping their wings as they&amp;#039;re born to do. To achieve this wild goal, this interactive website - Chicken, Parrot, and Sparrow - is created to intrigue audiences to review and rethink why and how some birds are objectified as products, compared to the ones living as our neighbors, despite the fact that all of them are all birds born with wings. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nDesigned to target graphic design lovers, the backbone of this interactive website is a series of hand-coded typography animations consisting of the typeface Helvetica to visualize the processes of objectifying birds. In addition to the animations, the interactions and information on the website are designed and curated for audiences to keep thinking about our relationships with the birds after experiencing the website.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8595",
    "project_name": "Setting the Table",
    "elevator_pitch": "Setting the Table is a facilitation tool built to explore the ingredients behind building productive and meaningful conversations in a digital world.  The product aims to amplify individual voices and experiences in a group conversation by implementing sourced questions, collective data, visual reinforcement, and community engagement.",
    "description": "Setting the Table is both an online and physical workshop experience designed to guide groups through thoughtful and productive community forums.  The experience is centered around a dinner table theme in reference to the types of conversations the experience aims to elicit.  The dinner table symbolizes a place to listen, share, trust, understand and grow.  The goal of a Setting the Table workshop is to extract the ingredients of a successful dinner table discussion, and implement them in a conversation beyond the table. The mechanisms by which Setting the Table creates this experience is largely inspired by two key projects.  The first inspiration comes from a project by Giorgia Lupi called The Data We Don&amp;rsquo;t See, where graphic symbols representing individuals provide insight on the similarities and differences between people who do not know each other.  The other inspiration comes from a project by Daniel Goddemeyer called Data Futures, where audience members are given an opportunity to provide information to presenters in order to spur a more powerful talk.  Elements from both of these projects were merged together to form a workshop experience that adds insight, community engagement and internal reflection to group conversation forums.  The table is set with the ingredients for groups to learn how to listen, share and discuss, respectfully. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8596",
    "project_name": "A look at looking (through not looking)",
    "elevator_pitch": "An ontological fantasy that surveys humans from non-human perspectives.An examination of the inter-relation between human&amp;rsquo;s phenomenal worlding and vision-based perceptual experience, which has been modernized through spectacle and media.",
    "description": "A look at looking (through not looking) is an artistic research project that consists of three experiments that defamiliarize users&amp;rsquo; predominant way of perceiving familiar contexts with other animals&amp;rsquo; perceptual mechanisms.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nEpisode I. How does a dog understand a map? &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nA physical map of the ITP floor made from smells. Users sniff around the map to feel the spatial relation. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nEpisode II. How does a digital interface feel to a mole?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nAn AR application in which users are invited to experience the haptic texture of a digitally rendered blanket from artist&amp;rsquo; childhood.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nEpisode III. What does /Apple Logo.jpg/ mean to a bat?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nA VR experience in which users are embodied as a bat wandering in Time Square, trying to understand humans through echolocating.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://nyu.zoom.us/j/94813653389"
  },
  {
    "project_id": "8597",
    "project_name": "EmoCaptcha: Opening the Black Box of Emotions",
    "elevator_pitch": "EmoCaptcha is a collection of speculative projects using affect recognition technology&amp;mdash;human emotion detection&amp;mdash;with escalating consequences to reflect on enigmatic black box systems and their capacity for misuse and discrimination.",
    "description": "The origins of this thesis project started from the concept of black boxes&amp;mdash;a system in which the inputs and outputs can be observed, but the inner workings of the system are concealed&amp;mdash;and the shortcomings and discriminatory consequences that can occur when these complex systems are deployed without critical consideration or analysis. EmoCaptcha uses &amp;quot;affect recognition technology&amp;quot; as its black box to invoke critical reflections on black box systems for audiences with casual digital practices and basic understanding of AI and automated decisions systems.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nAffect recognition technology uses a machine learning model trained off of categorized headshots to determine human emotion based off of facial expressions. The problem with relying on human affect predictions made by this technology is that studies have shown facial expressions to be an unreliable indicator of emotional state. Categorical universal emotions have been questioned too. Yet businesses and governments have started to integrate emotion detection technologies as black box entities into complex systems that range from determining the employability of a candidate to the likelihood of someone being a terrorist.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nEmoCaptcha aims to capture and hopefully illuminate for users the potentially escalating consequences of affect recognition technologies and other black box systems through a series of digital projects in which the determined emotional user state impacts their experience and ending outcome.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8598",
    "project_name": "Creativity &amp;quot;in Crisis&amp;quot;",
    "elevator_pitch": "What will I learn about my creativity through this experience of the pandemic? Will some of these insights allow me to make creative choices that will prepare myself for the future of an ever-changing world, full of uncertainties and challenges?&amp;lt;br /&amp;gt;",
    "description": "To date, many still question: how do people come up with ideas? How to be more creative? As someone recently entering the creative field, I have a strong interest in answering these questions myself.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe study of creativity and how the brain generates ideas, is not new. There have been numerous researchers and experts who spent years studying, researching on creativity and innovation. Despite extensive research, many of them admit that we still don&amp;rsquo;t have a complete understanding of exactly how the brain works to affect creativity. Other successful interdisciplinary professionals have also tried to come up with theories and suggestions for how to be creative. Yet, I thought, like everything else, creativity may very well be different from one person to another. This is due to reasons, including: different training and professional backgrounds, diverse environments of upbringing and living situations. What about during a time of crisis such as a pandemic? As a result, in order to answer my question about creativity, what&amp;rsquo;s better than studying my own creative practice, observing my own way of creatively thinking and making to see what interesting learnings I will find. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nMy thesis is a personal case study, a documentation that details my process of thinking and making projects over the past three months, from the start of COVID-19 pandemic, reflecting on various factors that have influenced my creative process. The goal is to give myself a reflection and better understanding of what drives and influences my creative thoughts and decisions, before and during the pandemic. What are the differences? What will I learn about my creativity through this experience? Was I doing something right or everything wrong? Will some of these insights allow me to make creative choices that will prepare myself for the future of an ever-changing world, full of uncertainties and challenges?&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8599",
    "project_name": "Shift+Control+End+Delete Encoded Stigma",
    "elevator_pitch": "My thesis speculates toward a syllabus for technologists who want to design at the sex+tech intersection and build technology that is safe for sex workers as informed by sex workers and their experience in the digital sphere.",
    "description": "In proposing a syllabus, I am setting the technology school as the locus for a radical participatory design movement rooted in a place of learning that recognizes the complicated, co-constitutive relationship between sex, society, and interactive technology. My motivation comes from a place of accountability as a creative technologist who wishes to design toward harm reduction, to signal-boost the voices of the Other-Wise, and confront uncomfortable topics in hopes of expanding the perspective of those creating in the realm of the &amp;ldquo;recently possible.&amp;rdquo; Sex/work stigma is a computer ethics design question in that those who labor in sex trades (and by proxy those who explore sexuality in the digital space) have been useful for communications technology developers only as far as they invest as early adopters or pose as a problem to be solved, without consideration of the incredible breadth of knowledge each has to offer&amp;mdash;as observers, laborers, artists, educators, entrepreneurs, targets, activists, and partners. Curriculum proposals include Data Feminism techniques, recommendations for FinTech companies in a post-Covid world after individuals turned to online sex work for income while isolated, and potential for mutually-beneficial allyship between developer schools and formerly incarcerated sex workers. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n(I don&amp;#039;t know how to make video documentation for a research paper, so I included my midterm thesis presentation instead)",
    "zoom_link": "https://"
  },
  {
    "project_id": "8600",
    "project_name": "Beyond Case Closed: From Making Sense to Building Resilience",
    "elevator_pitch": "A series of Title IX related projects in exploring the use of creative medium and technology to build resilience and communities.",
    "description": "How can we build resilience facing traumatic and complex scenarios, especially in times when conventional means of protest is not feasible, or when traditional ideas of social justice could not heal? &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;ldquo;Beyond Case Closed: From Making Sense to Building Resilience&amp;rdquo; is a series of projects driven by my experience filing a Title IX complaint at my undergraduate institution and at the Department of Education. In navigating the stressful process and aftermath of filing a case, I realized the limitation of procedural measures in seeking social justice, and thus seek for alternative approaches.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nEach project in this thesis marks a different exploration in the search for resolutions, where I used various creative mediums &amp;mdash; shifting between more implicit art forms and more explicit media communication platforms, negotiated between personal expression and involving the public audience, and worked with different information sources &amp;mdash; from personal documents to public to scraped data. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;ldquo;Because It Also Happened&amp;rdquo; is a picture book depicting the incidents that led to my filing. &amp;ldquo;OCR 01-15-2179&amp;rdquo; is an interactive installation conceptualizing a boundary line. Excerpts from a personal letter are laser-etched in decreasing font size. If the audience decides to cross the &amp;ldquo;line&amp;rdquo; to read the text, the light flickers/fades and turns off. When the audience steps back, the light turns back on. The time when they crossed the line is printed on the display, which is also recorded on a SD card that I collect at the end of the day. &amp;ldquo;2020 U.S. Top Colleges By Open Title IX Investigations&amp;rdquo; is a web-based resource guide and participatory project with map visualization, dynamic updates, real-time database and visualization designed to inform survivors and advocates about Title IX investigations, and acknowledge their lived experiences.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8601",
    "project_name": "Crafting Technomagical Experiences",
    "elevator_pitch": "Exploring applications of technology as a toolbox to create magical experiences that inspire wonder and embrace human connection. As well as combination of magic with technology to give people an impression of what may lie beyond our current technological capabilities and communication limitations.",
    "description": "We live in a crucial moment when the role of stories and how they connect us has taken on an urge and importance. Humans are storytelling animals and story is what helps us to understand the world that we experience around us. Technologies shape how the stories are being delivered and consumed. As these technologies have matured and the art of storytelling has evolved, our ambitions have grown. The underlying question is  &amp;ndash; &amp;ldquo;how do we use these technologies and skills to tell stories that will bring a positive and lasting impact.&amp;rdquo; One of the answers I found in my art practice is magic. Don&amp;rsquo;t think about it as a trickery or a puzzle. It is bigger than that, magic is a philosophy, a narrative and a story, it is understanding how the mind works. Magician has a creative and non traditional mindset, it is a &amp;ldquo;toolbox&amp;rdquo; that can be applied to any art practice.&amp;lt;br /&amp;gt;\r\n Series of projects are done using augmented, virtual and mixed reality mediums as well as voice controlled interfaces with the purpose of crafting magical experiences and entertaining performances. I take on unconventional missions. Missions to inspire wonder and embrace human connection. Missions to build experiences that transport and thrill. Missions that bring people together and evoke emotions of wonder in the audience. I am investigating the relationship between technology, magic and illusions, the role of a magician at a time when technology is making &amp;ldquo;anything&amp;rdquo; possible and we almost lose our sense of wonder. My work is an applied exploration of audiovisual deception and misdirection in digital, aka technomagical experiences.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8602",
    "project_name": "Commas.space",
    "elevator_pitch": "Commas dot space is a web art experiment in ephemeral text",
    "description": "Commas.space is a web app focused on ephemeral text.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nParticipants type messages onto a looping display, one character at a time. The messages scroll and loop over a 12 second interval. Each time a message is shown to another participant, it fades away a bit. Messages eventually fade to nothing, making way for new messages.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nCommas.space grew out of research into the differences between orality vs. text and the history of technologically mediated conversation.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nText has been used for record keeping from its beginning. Its ability to store and transfer information was transformational. As communications technologies have advanced, we&amp;rsquo;ve kept the assumption to record text. For example, chat and email typically take the form of a series of timestamped records, a log.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nCommas.space is a conversational text without permanent records. The messages temporarily exist in the volatile memory of the server and the participants.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nInformation can only persist through the act of retelling. It is up to the participants whether to to respond and navigate other messages to build a shared construction or create a cacophony.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe looper acts as a retelling mechanism and buffers the communication of messages across windows of time. Participants can leave messages for future participants or weave message threads with themselves.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8604",
    "project_name": "Moment Journal",
    "elevator_pitch": "Moment Journal is a mobile augmented reality application that allows ticket lovers to archive their memories using physical tickets in the form of journal, media and 3d animation.",
    "description": "People use different ways and media to document the present and remember the past. One nostalgia method that some people are still obsessed with in this digital age is collecting and keeping physical tickets, which is also a way to remember a moment and evoke a memory. However, as time passes, the information that illustrates our memory fades away quicker than we thought. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIs there a creative and effective method for memory storage and retrieval? My thesis project aims to create an experience that uses the advantages of AR technology to let people store their memories in a digital way using physical tickets. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nUsing this app, users are able to type their thoughts or upload multimedia files in AR, and add them directly onto the surface of physical tickets. Contents that have been added to the tickets will then be stored instantly on the phone. At any future point, the user can re-experience the journal projected in AR by scanning the ticket.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8605",
    "project_name": "My Own Apophenia",
    "elevator_pitch": "My Own Apophenia is a series of kinetic objects--ambiguous forms, semi-revealed behind cloudy glass. The objects recreate collections from my childhood. To me, they represent a version of apophenia--a space of connection between unrelated objects, of the limbo between memory and loss.",
    "description": "This is my first piece resulting from my ongoing research on apophenia, memory, and perception. I recreated some of my secret childhood collections--I used to hide them in cabinets from my family--: jars of mealworms, cans of fruit seeds, and used ballpoint pen refills. They are just low or even no value items, but there is a high level of emotional connection I have to their subject matters. As I grew up, I have learned to streamline my belongings, to pack lighter to move around easier and stress about less. My passions for the material forms of my previous collections faded after a certain point, but I still feel supported emotionally every time I get reminded of that fearless time in my life. I want to tackle the idea of remembrance while leaving it amorphous and open for viewers to bring their own interpretations to their experience.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nCarrying an abstract and subtle quality, the kinetic objects suggest worms crawling, fruit seeds dancing and ballpoint pen refills rolling in the cabinet of secrets. This lively moment is interrupted as soon as any human activities around it are detected&amp;ndash;&amp;ndash;as in Toy Story&amp;ndash;&amp;ndash;a playful mystery that allows our imagination to take over. My interest in the idea of apophenia inspired me to create visual cues in order to make dynamic triggers of perception and connections through which memories are activated. My intent, by changing the format of the original objects, is to transfer emotions attached to them, update the memory of a former self, and to trigger new perceptions in a divergent context.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8606",
    "project_name": "HomeLog",
    "elevator_pitch": "HomeLog proposes a new way of digital communication; it doesn&amp;rsquo;t rely on a smartphone and is designed to bring us closer to ourselves, our families, and our loved ones in a more personal, less immediate way.",
    "description": "We live in a time where everyone is a few taps away. A myriad of mobile apps constantly proposes fresh new ways of connecting us with others. Ironically, when looking at current studies, data shows that we are one of the loneliest generations ever. So how come the promise of an always-connected and immediately-reachable world makes us feel so dissatisfied, facile, and alone?&amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;\r\nOver the course of 12 weeks, a product and different social dynamics were designed and tested to empower my family and friends by digitally connecting us in a more personal way. HomeLog is a device for the home that you cannot take with you everywhere you go and that does not interrupt you. It&amp;rsquo;s a new way of digital communication; it doesn&amp;rsquo;t rely on a smartphone and is designed to bring us closer to ourselves and our loved ones in a more passive and less-immediate way.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8607",
    "project_name": "GET HIP: THE APP",
    "elevator_pitch": "Get Hip: The App is an iOS application that serves as a digital hub for hip-hop fans to play trivia games, view branded content, and gain exclusive access to brand events and merchandise.",
    "description": "In 2018, I began extensive research on Hip-Hop culture and history in order to produce and write the content of my game show &amp;lsquo;GET HIP&amp;rsquo;. For my thesis project, I am investigating the intersection of education and recreation through Hip-Hop culture. I am looking to ask and answer the question: how can a learning experience be satisfying without over gamifying the information?&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nHip-Hop is a subculture and lifestyle at the forefront of popular culture, yet there is a lack of consistent recreational experiences focusing on hip-hop, its music, and culture. Having created and developed the &amp;#039;Get Hip&amp;#039; game show, which is centered around Hip-Hop, over the past 2 years, I realized that using current events and notable figures in order to assist in education makes knowledge more accessible to users. This project will be used as a way to not only educate the masses on Hip-Hop and all it has to offer, but also, market and further publicize the video content that we make through the GET HIP brand.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8608",
    "project_name": "W E N I V E R S E",
    "elevator_pitch": "Interdimensional immersive space for people to connect",
    "description": "Originally envisioned as an onsite video sculpture concept&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nfor galleries, festivals and nightlife venues, reimagined as a virtual visionary video chat interface, encouraging human connection.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8609",
    "project_name": "Artifice Social VR",
    "elevator_pitch": "A social VR experience where you are challenged to identify if the interaction is with a human or with a pre-programmed robot .",
    "description": "Artifice uses virtual reality technology to explore human connection.&amp;lt;br /&amp;gt;\r\nTwo players are invited to participate in Artifice. At the beginning of the experience, both players put on their VR headset in separate rooms. A narrator explains their individual missions. Player One is asked to serve as the judge to observe three robots&amp;#039; movements with the goal of identifying the other human player. Player Two serves as a performer in one of the robot avatar&amp;#039;s body. Their crucial task is to perform different activities in the hope of demonstrating humanness and distinguishing him/herself from other pre-programmed robots.Hopefully this experience will spark a conversation about the reasoning behind their decision-making and share their uncanny valley experience together. &amp;lt;br /&amp;gt;\r\nArtifice invites two participants to explore an alternate reality that takes place in a post-epidemic world.. At Artifice lab, a tech company provides a service allowing human consciousness to be uploaded to a robot. This service is often utilized by family members of the deceased who are not ready to let go of their loved ones. After consciousness is uploaded to a new body, the person no longer has to worry about aging and illness. However, there are overwhelming demands for this service. In the beta program, the company could only select a few candidates to be uploaded. The candidates need to go through quality control calibration to make sure they are able to maintain their human movement with their new robot body. The company selects judges to observe their movement and make a decision on who is the most human human deserving to go out of this lab with a new body.",
    "zoom_link": "http://shorturl.at/tuKMV"
  },
  {
    "project_id": "8610",
    "project_name": "The art of keeping a secret",
    "elevator_pitch": "A hands-on workshop that demystifies encryption through collective problem solving",
    "description": "It is important to understand the technologies we use every day because understanding empowers us to make informed choices about how we may choose to engage with those technologies and the world around us. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nSince the digitization of data as well as most of the services we use today, the privacy and security of our data has become tremendously important. However, there is very little common knowledge on the subject of encryption which is what keeps out digital data secure. My project is a hands-on workshop that demystifies encryption. The workshop is structured as a combination of short discussions and hands-on activities intended to convey the concepts through collective problem solving&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nFollowing are the learning objectives of the workshop:&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n1) Develop a conceptual understanding of encryption&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n2) Understand how modern encryption keeps our data secure&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n3) Encourage participants to create a&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\ndaily digital practice that is empowered, informed and secure",
    "zoom_link": "https://"
  },
  {
    "project_id": "8611",
    "project_name": "Drop of Life",
    "elevator_pitch": "Using only my post-meal blood sugar responses, I was determined to uncover how the foods I ate affected my body and overall health as a non-diabetic, African American male. This was particularly important to understand during the times of me being at the epic center (New York City) of the COVID - 19 Pandemic.",
    "description": "As a creative technologist, I have always been interested in investigating preventative methods of diseases that have historically plagued the African American. Including, but not limited to, heart disease, diabetes, and strokes. I decided to use my thesis as an opportunity to do just that. In my personal experiment, I was determined to understand how the foods I ate affected my blood sugar. This effort would ultimately help me understand how my body responds to food and what gives me the best odds of not succumbing to the aforementioned illnesses. This experiment was executed by developing a simple iOS mobile application. Specifically, the app would track my blood glucose food responses and visualize them for quick and easy interpretation. Ultimately, it is my hope that my experiment will help me gain a better understanding of myself and the foods I consumed. At the start of my research, I was unsure about which of my vitals I&amp;rsquo;d use as an indicator of how my body reacted to foods. That all changed after reading The Personalized Diet. This text pulled back the curtain on how revealing a post-meal blood sugar response (PMBSR) could be in helping me understand the foods I ate. What is more, I was also informed about how a proper analysis of my PMBSR could help me steer clear of heart disease, diabetes, and other metabolic diseases. For those reasons, I decided to use blood sugar as my sole barometer. As I conducted research on mobile app solutions that did similar things I wanted to accomplish with my experiment, one stood out in particular. The One Drop app helped users affordably manage diabetes and other chronic illnesses. But unlike most apps out there, One Drop also did it in such a way where it presented vital information in a clear and cogent way. Their simplistic user interface design helped me set the standard of making sure as I designed my own app, I would not overwhelm my screen with impertinent information. Therefore, One Drop was my greatest inspiration while designing and developing my app. All in all, this personalized experiment set a strong basis for the research I plan to continue to explore post ITP.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8612",
    "project_name": "Urban_OS",
    "elevator_pitch": "An experimental research and design fiction project that uses the analogy of the computer operating system to re-imagine the &amp;ldquo;smart city&amp;rdquo;, carried out through three augmented reality case studies.",
    "description": "As the smart city movement continues to grow, I believe it is imperative to think deeply and critically about their design and underlying architectures, data structures, communication protocols and interfaces - essentially their operating systems. I argue that it is worth questioning some of these systems we accept at &amp;ldquo;neutral&amp;rdquo; and think about new computing approaches - ones that foreground equity, environmental sustainability, and maintenance/care - as we integrate more and more technology into the fabric of the physical space we inhabit. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThis research project consists of three case studies and a user manual. Each case study uses a specific smart city component found in my neighborhood (Bed-Stuy, Brooklyn) or NYU&amp;rsquo;s Brooklyn campus (Downtown Brooklyn) as a way to imagine different parts of a speculative Urban_OS ecosystem. The case studies re-think and re-design smart city hardware, interfaces and memory systems using augmented reality. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe manual ties these case studies together with design principles that were developed by transposing the original 17 principles from UNIX, one of the most ubiquitous and oldest operating systems. The manual was additionally informed by a wide variety of ongoing interviews with experts in the community, at the New York City government, at IoT companies, and at academic and research institutions.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThese experimental case studies and manual make up an ongoing topology meant to generate conversation around the ethics, aesthetics, and methods in smart city design and technology. This project challenges designers, city planners, academics and policymakers to ask: if we are embedding computing into our urban landscape, what values are we embedding by doing so?&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8613",
    "project_name": "The Places You&amp;#039;ll Go",
    "elevator_pitch": "&amp;ldquo;The Places You&amp;rsquo;ll Go&amp;rdquo; is a real-time video simulation, exploring and addressing the anxiety and uncertainty of a coexisting future with advanced technology.",
    "description": "Computerization of human lives was the beginning of the end of traditional methods and non-automated devices. We start to live in transformative scenarios in adaptation to the changes around us. As the advances in technology offer us convenience and tremendous wealth, it also modifies interrelationships that shape us as humans. We risk being replaced by automation and losing the work that is often assumed as an important source of our identity and purpose. How do we continue to make meaning of the world and our sense of self? &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n&amp;ldquo;The Places You&amp;rsquo;ll Go&amp;rdquo; consists of a series of synthetic and automated environments that are algorithmically structured to encompass the transformation of a world in miniature. Mundane scenes inspired by the everyday are adapted into semi-surreal artscape, each providing a different perspective and reality. The first scene takes a nostalgic look at the rise of the Internet and AI in the earlier decades, where formerly prominent software and technology began to disappear. This is a place where the outdated technology lives, and when AI continues to replace and retire people in the workforce, this may also become a place where humans live. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nAs AI learns to interpret and respond to human emotion, can they also be measured, understood, and even simulated? The audience in the second scene is placed inside a traditional Chinese wedding ceremony where all kinds of emotions are celebrated. When humanity is encoded as a set of parameters and data-driven analysis, how will it affect our understanding of love and connection to each other?&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nWhile there are regrets for the past and fears of the unknowns, there are surely opportunities and potential to develop a blueprint of coexistence for humans and AI. The last piece provides an open-ended exploration of the future in the workforce. Since more of the routine and repetitive jobs are taken away, the future opens up for creativity and compassion driven tasks, as well as collaboration with machine minds. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8614",
    "project_name": "Overview",
    "elevator_pitch": "What does a collection of stories about isolation and social distancing look like? What do we gain when we experience those stories from a cosmic perspective?",
    "description": "The overview effect is a cognitive shift observed in astronauts who see the entire Earth from space. There is something about experiencing the whole planet from a cosmic perspective that strengthens the connection to humanity, life, and peace. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIn the current climate of social distancing and isolation, can we use this inherently optimistic cognitive shift to help build empathy and connect to others through a shared experience.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nOverview is a web-based meditation experience that explores its namesake effect in the context of the global COVID-19 crisis, specifically through the lens of stories about the day-to-day isolation experience. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8615",
    "project_name": "Echoes",
    "elevator_pitch": "Echoes is a speculative software suite that uses artificial intelligence trained on its user&amp;rsquo;s email, messaging and voice data to automate personal communication. It explores the ways in which our data can and can&amp;rsquo;t be used to recreate ourselves.",
    "description": "Since its beginning in the 1950s, the field of artificial intelligence has been working towards a single goal - &amp;ldquo;to develop machines that possess intelligence comparable to that of humans,&amp;rdquo; according to Fran&amp;ccedil;ois Chollet. Mostly, this goal is accomplished by using data in aggregate - massive datasets that allow an Alexa or a Siri to behave like a person in general. But why not try and replicate a specific intelligence, create an AI that behaves like a specific person?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nEchoes is a speculative software suite made up of three services: automating messaging over text and social media; automating e-mail; and automating voice conversation. Each model is trained on my own personal data: every message I&amp;rsquo;ve sent on each platform, every e-mail I&amp;rsquo;ve sent in the past fifteen years, and over 10 hours of voice recordings. Rather than acting as a sleek, helpful AI assistant, the products act for you, following their own whims. They are messy, unpredictable, and nerve-wracking to use. TThough I am its first user, this suite can be used by anyone who&amp;rsquo;s spent enough time online.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe suite explores the use of AI models and data as techniques for replicating and understanding ourselves. Though these models can capture odd truths, and even at moments behave the way we might in a given context, their basic assumptions go against the way we think of and view ourselves. What seems like a huge change to us is just another datapoint to them. They are entirely backward-looking. They don&amp;rsquo;t know how to respond to new information, to emergent phenomena. And they fail to understand the context and nuance of the ways we talk to one another. But they do offer a window into the ways our data reflect us, and the people we used to be. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8616",
    "project_name": "DYAD AR",
    "elevator_pitch": "DYAD is an IKEA-themed, relationship-testing AR game that experiments with how to use networked devices in physical spaces to create experiences that encourage participants to communicate, connect, and grow together.",
    "description": "My core research topic for thesis emerged as &amp;ldquo;How can we best create Communal Transcendence through Physidigital Play&amp;rdquo;, basically how to take the best parts of online and in-person interactive experiences and highlight the aspects that make the audience or users feel more joy, power, and connection. My goal was to build an experience that leveraged connected devices and digital tools to augment fun interactions taking place between a group in meat space, or offline, (Physidigital Play) and that through this experience, participants felt the emergence of a shared power arising as they collaborated to overcome a challenge, exceeding the limits of what would be possible for them on their own (Communal Transcendence).&amp;lt;br /&amp;gt;\r\n\tDyad AR, is one project that experiments with this question, but specifically under the lens of AR &amp;mdash; is augmented reality perhaps the best answer to those looking for a type of digital tool that highlights and engages with the user&amp;rsquo;s physical environment? Dyad is an AR mobile game where people play as a couple trying not to break up as they decorate their apartment with IKEA furniture they drop from the sky. My goal was to create a sandbox where people could play in the same location while utilizing engaging networked AR tools, and in the process, learn a little more about how they communicate their wants and needs, how to listen to their partners, and how to compromise for the good of the relationship. Linking it to my core research idea, my hope was that the obstacle of a tense, absurd, semi-cooperative puzzle game would challenge them to work together in a way where they would leave the game feeling more connected, more heard, and more equipped to communicate better with everyone in their lives.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8617",
    "project_name": "Unstructured structure",
    "elevator_pitch": "Unstructured structure is a sonic XR experience featuring a series of sculptures. It investigates a mixture of transgressive music compositional techniques developed throughout music history. Through this project, I hope to shine a light on music that arises from unconventional creative processes and invite viewers to reconceptualize the core of what is music and how we listen.",
    "description": "Unstructured structure is a body of work featuring a series of sonic XR sculptures that showcase a mixture of unconventional compositional techniques throughout music history. Through this project, I hope to invite viewers to reconceptualize the boundaries of music and how we listen.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8618",
    "project_name": "In search of a &amp;#039;sense&amp;#039; of time",
    "elevator_pitch": "Can you nurture a &amp;#039;sense&amp;#039; of time without clocks?",
    "description": "In our increasingly time-sensitive and quantified lives and societies, clocks have become smaller and embedded themselves in the fabric of our society through their presence in all manner of objects and infrastructure, big or small. From the pacemakers to refrigerators to satellites, their quiet ticks govern the contours of our lives and we, humans have internalized their logic into the self-management of our lives. But most of us forget that clocks are a measure of *a* system of time, not *the* system of keeping time. Humans construct most of their meaning in the world qualitatively rather than quantitatively. While clocks give us numbers that give us equally spaced markers in a day, we still relate it through the lens of the changes in the surrounding phenomena like the environment, our human rhythms, and social/personal rituals. Even though clocks stare at us from the corner of almost every digital screen all around us and yet, they are woefully inadequate in communicating a &amp;lsquo;sense&amp;rsquo; of time. The number 3.30 PM makes sense only if we relate to its relative position in a day or the position of the sun in the sky or the activities that are associated with that hour or the specific needs our bodies have during that time of the day. And in case, the environments, rituals, and rhythms are disrupted, we lose our sense of time completely as evidenced by most of us during our current corona life. My thesis began as a rumination around my fractured sense of time that has evolved into a journey through a written article, built experiments that I have lived with, and where I seek to construct a sense of time for myself that is instinctive rather than quantitative. For my final thesis, I have built a collection of timepieces that create a &amp;lsquo;sense&amp;rsquo; of time by qualitatively displaying time as interpretive changes in natural and digital phenomena in my personal environment. By exploring this space of abstracting and creating qualitative phenomena out of data and living with it, I wish to reexamine our relationship with quantification and what it means to have a sense of data and how we live in the world. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8619",
    "project_name": "Bridge to the Internet",
    "elevator_pitch": "Bridge to the Internet creates a platform for localized network infrastructure to minimize resources required for communication to better serve their local communities during times of intermittent connection.",
    "description": "Bridge to the Internet is a router which hosts robust local area communication applications which activates local area networks to strengthen connection within a local community. With the internet under heavy strain due to the COVID-19 pandemic it becomes clear that we must maximize our network resources and look for alternatives to internet based communication. This project is especially relevant for people in remote areas with impacted bandwidth. It creates more resilient communication channels. The use cases are endless, from wireless doorbell monitoring, to communicating to neighbors within a building, and - with additional wifi repeaters - potentially scaled to cover a city block.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe router applies network infrastructure typically reserved for businesses and institutions into a single device. It can quickly set up an internet sharing wireless hot spot with an Proxy Web Server for caching and a DNS Sinkhole pre-configured. It also hosts a local web server running an asynchronous message board, and real time text chat.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8620",
    "project_name": "MirrorVR",
    "elevator_pitch": "Mirror VR is an immersive multiplayer VR Escape Room that explores the power of storytelling in VR through an immersive environment, gamifying narrative, and real time and social interaction. &amp;lt;br /&amp;gt;",
    "description": "MirrorVR is a two player VR escape room game. MirrorVR offers immersive storytelling and real time interaction, in which players are asked to share information, communicate and cooperate in order to progress the story and eventually escape from the room. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe players will represent the same Character, Stephen Collins, in two different times - as a student in 2020 and as a pioneer physicist in 2040. Players are each trapped in Collins&amp;rsquo; Room in 2020 and in 2040. The Mirrors in both rooms are reflecting the other room. Players need to figure out how to escape by cooperating and sharing information gathered in each room through the Mirror. As players are not able to hear each other, they have to communicate through body language or handwriting. The main game interactions are inspired by quantum mechanics. Players need to find multiple unstable crystals, as they are constantly teleporting between times and spaces(Collins&amp;rsquo;s room in 2020 and 2040). As the story progresses, players will learn more about the crystals and try to escape from their influence.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8621",
    "project_name": "The Centaur Hypothesis",
    "elevator_pitch": "A series of AI/ML experiments used as a medium of interaction &amp;amp; creativity. Inspecting how AI as a medium can amplify our augment user behavior. What implications it can have in a tech utopia where technology is seamlessly integrated into our lives.",
    "description": "we interact with our surroundings. In time AI/ML algorithms have encroached our daily life with passive automation such as movie &amp;amp; product recommendations &amp;amp; active augmentation by helping us write better emails. Every day we interact with more of these algorithms which render themselves based on our selective interactions. As technology improves &amp;amp; permeates more aspects of our daily life such as fitness trackers &amp;amp; voice assistants, how can we design for these new mediums of interaction? What should we consider? &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nWhat?: To investigate &amp;amp; imagine these scenarios I devised three experiments.&amp;lt;br /&amp;gt;\r\nAn app that reminds me to sit straight while watching youtube videos&amp;lt;br /&amp;gt;\r\nAn app that alerts me when I touch my face when I&amp;rsquo;m on my computer.&amp;lt;br /&amp;gt;\r\nA generative text model trained on 3700 TED talk transcripts to help me write a fictional TED talk.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nHow?: Using current consumer-grade machine learning models, designing applications/tools for specific use-cases. Firstly, using teachable machine to retrain poseNet(a human pose estimation model) to identify &amp;amp; distinguish between different poses. A medium to prototype for applications with constant camera access. &amp;lt;br /&amp;gt;\r\nSecondly, retraining GPT-2(a generative text model) with transcripts from 3700 TED talks over the years to write a fictional tech future story &amp;amp; a fictional TED talk.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8622",
    "project_name": "Another Pop-Up",
    "elevator_pitch": "An online pop-up store experience that parodies internet culture and advertising to an extreme. Infused with an attempt to softly subvert it through transparency and vulnerability.",
    "description": "What happens when we remove the concern of maximizing profit online? When we encourage kindness, genuineness, and vulnerability, will we be able to produce more thoughtful and transparent technologies and virtual communities?&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nAfter observing a shift in online expression and content from competitive to wholesome during the COVID-19 pandemic, I realized that our technologies directly mirror ourselves. With the relatively recent rise of online personas and fake news some might disagree, while others may say this has already been obvious. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nWe&amp;rsquo;ve been fostered by and fostering technology in a culture that prioritizes income and individual growth. The rise of loneliness due to social distancing and reliance on technological tools for communication led me to believe that our feelings of isolation and disconnect is a direct byproduct of this society and its tools. In a time when we are craving intimacy and authentic interaction, our technology cannot satisfy that need because they weren&amp;rsquo;t made to. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nDystopia Pop-up creates an online pop-up experience that parodies this online culture geared towards profit and advertising and is also my attempt to resist it through sharing my own vulnerabilities. My hope through this project is that by recognizing that our technologies mirror us and our actions, people will be encouraged to express themselves more thoughtfully, kindly, and transparently. Our desire to earn revenue has limited our technologies to be designed with profit as its priority, which has directly influenced the structure and content of our virtual interactions. Whether it&amp;rsquo;s earning the biggest buck or gaining the most clout, we will constantly feel pressured to conform to and prioritize what gains traction when generating online content and tools. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nI don&amp;rsquo;t claim to have the answers to the questions posed earlier or know if these are even the right ones to ask. However, I hope raising them can plant the idea of pausing from our routine to act with a little more softness, kindness, and gratitude for what we currently have and love, especially in this period of tragedy, uncertainty, and isolation.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8623",
    "project_name": "Me, Myself &amp;amp; My Bacteria",
    "elevator_pitch": "My thesis project involved an exploration on how bacteria from my mouth can be used to portray the essence of myself and my identity without having control over the final outcome of the bacteria. It started as an attempt to discover my artistic identity by exploring bacterial changes caused by the food I eat and, eventually, due to extenuating circumstances (i.e. global pandemic), bacterial changes caused by my shifting moods.",
    "description": "I proposed and started this exploration because I wanted to leave ITP doing something random, open ended and related to my questions about my artistic identity. When I was younger, my parents emphasized that studying art and creativity was a hobby rather than a career. I pursued science and math simply because I was good at it and understood the underlying concepts rather easily. I studied physics in college partly because it was the first science I was good at without much effort and partly because the physical world around me made sense. But as I continued my education, the world no longer made sense. Eventually, I didn&amp;rsquo;t want to study theorems and formulas anymore so I applied to ITP. I may have switched my path of study, but I remained confused about my identity within this new field of the recently possible at the intersection of art and technology. The switch to such an open-ended program has made me more confused about where I fit. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nI thought it would be useful to dedicate my thesis to this dilemma in an effort to try to grow as an artist and see if I can develop a different sense of self. I used bacteria because I like to work with randomness and noise, and bacteria is unpredictable and autonomous in its outcomes. Since I am confused about who I am in terms of my artistic identity, for my thesis project I decided to work with a medium like bacteria with which I cannot control the outcome. I used my own saliva as a fitting source of bacteria since I&amp;rsquo;m exploring my own identity. I think my identity has a lot to do with my physical body, so I thought that using my own saliva would produce unique results that pertain specifically to me. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8624",
    "project_name": "celebrate:HER",
    "elevator_pitch": "Media representation is essential for a fair society that respects and values the societal make up. celebrate : HER is an installation that intends to bring awareness to the impact of having narratives in black female perspective in mass media and celebrating the black women.",
    "description": "celebrate : HER, the installation, will take place at Window Studio. Windows Studio is an art center in Bedford Stuyvesant with a community centered model that provided artist residencies, workshops, exhibits and events. The  selected location is made to reach black communities by displaying the value of reframing dominant culture gazes on the black experience through archival media. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nUsing inspiration from a market in Bed-Stuy, BLK MKT (a shop of black collectibles that are sourced from estate sales, donations, and other second hand shops) the curation of the installation space is made to fulfill black curiosity and house black cultural artifacts. With this curation of space the intention is to create an accessible archive to brings attention to experiences of joy in black lives. &amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;\r\nArchives do not present themselves as accessible so by breaking down the structural barriers and allowing the individuals in the occupy a space with cultural resonance using curated media artifacts. The patron will be presented the option to become a part of the archive and can contribute to its maintenance and its presence. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8625",
    "project_name": "SynthWorks",
    "elevator_pitch": "A tool to generate synthetic datasets for your machine learning model hassle-free.",
    "description": "For many artists and researchers, they can solve a problem when there is an existing tailored dataset for the problem; they can also collect and process their own data set, but this is very time-consuming. Sythwork eliminates this hurdle by allowing users to generate datasets with a click of a button. As of February 2019, there is no free and simple synthetic image generation tool available for artists and researchers to use. Many solution companies have inhouse software but they are designed for agencies and locked behind a paywall. There are other tools and frameworks made by research institutions but those are very case-specific and they are hard to replicate for personal use. For my Big Screen project during Fall 2019, I tried to train a machine learning model to recognize a few sounds that a large crowd would make. However, since there wasn&amp;rsquo;t a dataset that could help me train my model, I had to collect and generate my own datasets from scratch. In the end, the project was not able to perform because I didn&amp;rsquo;t have good training data. Sythwork is designed to be free and accessible, filling the white space.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8626",
    "project_name": "Personalized Mi",
    "elevator_pitch": "&amp;ldquo;Personalized Me&amp;rdquo; is an object detection AR game that attempts to address how one&amp;#039;s life path can be gradually affected through personalized advertising by merging in a choice-based storytelling mechanism.",
    "description": "Imagine a fantasy world, everything is running and relying on data, and every piece of data can inform people&amp;#039;s everyday decision making. Mi, our protagonist, like everyone else, is living through his life surrounded by all types of screens, receiving customized information from the TV, his cellphone, and billboards. Advertisement technology has reached its ultimate development. Merchants are able to use AI not only to understand people&amp;#039;s demand, but also to shape their lifestyle by sending out personalized messages via image, videos, or even the voice assistant.&amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;\r\nThat is where you come in... Now, you are the advertiser. &amp;quot;Personalized Mi&amp;quot; grants you access to all the data generated throughout Mi&amp;#039;s life. With these historical data points, you can decide what ads to show Mi in real-time. During the game, players can use mobile devices to capture any object, and it will be projected on Mi&amp;#039;s screens. While playing this interactive game, the player should realize how each little piece of content received by Mi can gradually shape Mi&amp;#039;s life path. &amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;\r\nViewers experience the four life stages of Mi, from childhood, young, mid-age to senior-life. Viewers are able to &amp;quot;project&amp;quot; advertisements into Mi&amp;#039;s daily routine through Mi&amp;#039;s TV, voice assistant, mobile phone, AR glasses, or social platforms. The ad content can be common objects within the viewer&amp;#039;s daily life，, for example, a laptop, a cup, or even a teddy bear.  During the content selection, there will be hints about Mi&amp;#039;s personal preferences. Viewer&amp;#039;s advertising credit will be deducted，if the placed ads don&amp;#039;t not suite Mi&amp;#039;s preferences.&amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;\r\nThis choice-based interactive tale is a little different but designed for novelty. It tells a universal story about the relationship between personal data and personalizations in people&amp;#039;s life. While you can&amp;#039;t speak to Mi directly during the experience, you can feel the information that is gradually affecting our daily life through this &amp;quot;transposition experience&amp;quot; with Mi&amp;#039;s &amp;quot;screen world.&amp;quot; It expresses the gradual impact of personalized advertisements on our &amp;quot;day-to-day life&amp;quot; by allowing viewers to use anything and advertise to Mi in any scene. This nonlinguistic narrative favors expression over a direct narrative. We hope that Mi will be instructive (inspiring) for everyone.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8627",
    "project_name": "Open Source World Building",
    "elevator_pitch": "TBD",
    "description": "TBD",
    "zoom_link": "https://"
  },
  {
    "project_id": "8628",
    "project_name": "Shape of Memory",
    "elevator_pitch": "Shape of Memory is an introspective VR piece explores what shapes of memory your loved ones take and the stories that become entwined.",
    "description": "Shape of Memory is an introspective VR piece based around the events leading to my grandparent&amp;rsquo;s marriage.  Central to this narrative is the act of dwelling, waiting, and patience in the face of the unknown - an act that has defined our lives within this global pandemic. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nI chose to build out this narrative for two reasons, one as a homage to the past, and two, as a message for the future. My grandfather passed this fall and I developed a tiny ritual of holding this red jade necklace he gave me the last time I saw him.  When I hold this necklace, our histories overlay, the conclusion of his illuminating my current state, what seems to be my intermission.  &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nYou start this experience by entering my room and sitting at my desk, making sure not to hit your head on the frame of my lofted bed, under which you will sit.  Once seated, you turn to face the wall, the headset on a thin white desk that spans the width of the room.  To your right, from the undercarriage of my bed frame, hangs the red jade necklace.   You put the headset on and the room transforms into it&amp;rsquo;s virtual self, the majority of the clutter and detail absent.  What does remain is the necklace. You go to pull it, both virtually and physically.  As you hold onto the necklace, the wall in front of you begins to shift to the side, revealing a long hallway with cloth draped on either side.  The narration begins, and you begin to glide slowly down the memory lane of my grandparent&amp;rsquo;s story, as remembered by my mother in loving detail, and virtually reconstructed and distorted by yours, truly.  Although I don&amp;#039;t ask you outright, I am curious to know what shapes of memory your loved ones take and the stories that become entwined.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://nyu.zoom.us/j/91570082618?pwd=RXJlYkluYVZkeVZWTVVKTDhXazdQUT09"
  },
  {
    "project_id": "8629",
    "project_name": "Moon People",
    "elevator_pitch": "An interactive non-linear story of the inward world of a person with depression.&amp;lt;br /&amp;gt;",
    "description": "Part I: What are you investigating?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nUse a metaphor to help people learn more about the experience of depression. My goal is to create an experience that helps the general audience generate empathy about how does it feel like to have depression. The keyword of this experience is NOT hopeless, it&amp;#039;s neutral and poetic.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nPart II: Why?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nWhen I was recently diagnosed with depression, the depression has already lived with me for more than 8 years. Although nothing had changed, I was still overwhelmed by depression more than ever. Then I realized, depression did not change who I am but knowing that I have depression really changed the way I see myself. People always see things in the way they think it should be, it&amp;#039;s part of human nature that can hardly be changed. In this case, why not make something to influence the way people think it should be.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nPart III: What it will be?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nAn interactive experience where people will control a moon to travel through the ocean to collect lights. I always think to live with depression feels like a moon living along with stars &amp;ndash; a moon can&amp;#039;t control it&amp;#039;s dim or shine, and all the shining stars are so far away from the moon. If a moon wants to shine, it has to spend extra effort to chase the light.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8630",
    "project_name": "Blooming clock",
    "elevator_pitch": "The augmented clock which manages cosmetic items for recycling",
    "description": "Abstract&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe &amp;#039;Blooming clock&amp;#039; is an augmented flower clock that helps people manage old cosmetic items to easily recycle their plastic containers By indicating their expiration date. While using augmented visualization as an indication of the expiration date, this Thesis aimed to design a delightful yet simple solution for complex problems.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nAR (augmented reality) has been developed as one of the tools for information and data collection, especially with machine learning features. However, sometimes AR data visualization hurts user&amp;#039;s experience when it comes to its accessibility such as heavy-text base AR content or user&amp;#039;s mobility. Through the perspective of AR product design &amp;amp; development, this thesis focused on finding the best way to manage augmented information for user&amp;#039;s better experience by developing 3D interaction. Furthermore, this thesis has been developed as a tool for people&amp;#039;s engagement to social good not only as a tool for delivering information. I believe that a simple and delightful experience is an effective tool to call to action for the social issue.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nContext/Research&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThroughout the thesis process, I conducted diverse quality and quantity research to goal setting and value proposition as a feasible solution. After the research, I&amp;#039;ve learned about how important the esthetic aspect as an indication design of cosmetic&amp;#039;s expiration date compared to food&amp;#039;s expiration date. Also, this research made me become more convinced the AR feature is a great solution for the issues that I tackled out.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nQuality research (Survey, Interview with prototypes, Field trip, )&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n1) Survey with 20 cosmetic enthusiasts about&amp;lt;br /&amp;gt;\r\n&amp;bull; their general cosmetic usage routine&amp;lt;br /&amp;gt;\r\n&amp;bull;thoughts about the expiration date&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n2) In-depth interview with 3 cosmetic enthusiasts to talk about&amp;lt;br /&amp;gt;\r\n&amp;bull; their preference about 3 different prototypes to the expiration date indication&amp;lt;br /&amp;gt;\r\n&amp;bull;their thoughts about cosmetic package recycling&amp;lt;br /&amp;gt;\r\n&amp;bull;their thoughts about engaging &amp;#039;social goods&amp;#039;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nQuantity research (Competitive analysis, Statistics, Articles, documentation)&amp;lt;br /&amp;gt;\r\n1)How &amp;#039;old cosmetics&amp;#039; can be damaged to skin&amp;lt;br /&amp;gt;\r\n2)How &amp;#039;cosmetic plastic package&amp;#039; can be a damaged environment&amp;lt;br /&amp;gt;\r\n3)The current plastic recycling rate&amp;lt;br /&amp;gt;\r\n4)How many users keep their old cosmetic, and why&amp;lt;br /&amp;gt;\r\n5)Analysis of current recycling systems by different companies, brands, start-up, &amp;lt;br /&amp;gt;\r\n6)Analysis of AR design guidance (by Google / Apple / Unity)&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nTechnical Details&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThis AR mobile app was developed using Unity, ARKit, AR foundation, Cinema 4D (3D modeling). Ideally, it will be combined with OCR(Optical character recognition) to scan the cosmetic brand&amp;#039;s name &amp;amp; item type, and cosmetic expiration date database to visualize the Augmented expiration date.&amp;lt;br /&amp;gt;",
    "zoom_link": ""
  },
  {
    "project_id": "8631",
    "project_name": "S.M.A.R.T. Wire",
    "elevator_pitch": "Shape Memory Alloy Resistance Tracking (S.M.A.R.T) Wire provides Arduino software and educational information about Shape Memory Wires to artists, hobbyists and Arduino tinkerers who would like to learn and quickly use nickel-titanium wire actuation in their work without having to go through extensive research or testing.",
    "description": "The world of Nickel-Titanium alloys is exciting and futuristic, but notoriously complicated. Commercially, those alloys are used in established industries such as medical, automotive, space exploration where there is a need for materials that can restore to their pre-trained shapes when being heated to certain temperatures. But what about non-commercial applications? What about artists, creative technologists and electronics lovers? Why isn&amp;rsquo;t there an easy way to make art projects with Shape Memory Wires? Those are the questions I had in mind after failing to make my first Shape Memory wire flower project. After more research on this topic, it turns out that there is not 1, but 3 components of working with Shape Memory materials that are difficult&amp;ndash; fabrication, actuation and understanding how these wires work. Surprisingly, it is also the last element - gathering correct information and understanding how Shape Memory wires work, which turns out to be the most challenging part for most people.&amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;\r\nThis is how S.M.A.R.T. wire project becomes useful. It is an attempt to bridge the gap between fabrication, electronic actuation, and information about Nickel-Titanium wires. By carefully researching, collecting, testing and summarizing information about Shape Memory Wires, as well as providing an easy-to-use electronic actuation solution with a ready-to-go open source Arduino library, S.M.A.R.T. wire is designed to be one of the quickest and most informative resources you could use to get started with your own Shape Memory wire project. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8633",
    "project_name": "Extinction Party",
    "elevator_pitch": "An educational puzzle game about the history of life on Earth.",
    "description": "What do you do when the world falls apart? Extinction Party is an educational puzzle game that explores the history of life on Earth by looking at the five major mass extinction events. It will take the form of a 3-foot high standing pentagon shape, with each side of the pentagon containing fun ways for participants to explore what life looked like before and after the extinction, and how why scientists think it happened in a certain way.&amp;lt;br /&amp;gt;\r\nMy thesis project is one side of this theoretical sculpture, which will be playable as a computer game. The game will be a proof of concept for a larger physical sculpture, which would be installed in a museum. I hope that both kids and adults will enjoy playing with it.&amp;lt;br /&amp;gt;\r\nThe history of life on Earth isn&amp;rsquo;t a smooth progression. It&amp;rsquo;s full of leaps and setbacks, devastation and rebirth. When I think about humanity&amp;rsquo;s current climate crisis, I often find it helpful to look to the past for context. Cataclysmic events can happen, and while life always finds a way to rebound, it often doesn&amp;rsquo;t look the same as it did before.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8634",
    "project_name": "Break the Silence",
    "elevator_pitch": "We all gotta get involved. As victims, participants, and spectators.",
    "description": "&amp;ldquo;Break the Silence&amp;rdquo; is a video installation that recreates the scenario of the seemingly harmless interactions with strangers in our life could have significant and pervasive psychological costs for women that they might not even be aware of.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8635",
    "project_name": "Circuit Samplers",
    "elevator_pitch": "Exploring how to teach embroidery enthusiasts with no computer science or programming background how to enhance their embroidery practice with simple circuits.",
    "description": "Embroiderers and fiber artists love to learn. As a community that is mostly self-taught, we find ourselves constantly combing the internet for projects and tools that will help us build on our existing skillset to make more beautiful and impressive things. &amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;\r\nAs an ITP first year, I was excited to learn physical computing. As a tactile person who loves making physical objects, I expected this to be the subject where I excelled. Instead, I found myself caught in a sisyphean cycle of &amp;ldquo;debugging&amp;rdquo; code that didn&amp;rsquo;t need to be touched only to find out that I had a loose connection in my circuit, and I had now broken my code. &amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;\r\nE-textiles and soft circuits open up a world of possibility for exciting additions to embroidery and fiber art, but many of the resources available to learn how to use them are either geared towards children (with quick projects that don&amp;rsquo;t require much technical construction skill) or geared towards people with a background in electronics (with complex circuitry or a need to understand code). This project is an attempt to make these exciting tools feel accessible to adult crafters who want to challenge themselves with a new material, but aren&amp;rsquo;t ready to make the leap to learn C++. By focusing the project on learning how to make secure electrical connections before introducing code, I&amp;rsquo;m hoping I can help embroiderers avoid the discouragement that comes along with debugging and get them enthusiastic about soft circuitry!&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8636",
    "project_name": "DisneylandToyFactory.com",
    "elevator_pitch": "DisneylandToyFactory.com is a two-part critical art project made up of a satirical website and an ongoing 3D printing experiment. Through a repeated, cyclical process of 3D scanning and printing the same figurine of Mickey Mouse from a renowned Disney-branded Mold-A-Rama machine new, more compelling, figures are produced ,which are then advertised with satiric consumerist language on the accompanying website.",
    "description": "The 1960s and 70&amp;rsquo;s in the United States were the peak of popularity for a rare type of Disney vending machine called the Disneyland Toy Factory, which produced injection-molded Disney figurines on-demand at theme parks and zoos. DisneylandToyFactory.com is a satirical project in the lineage of these machines that instead allows the unpredictability of digital fabrication technology to reveal what Claudia Hart refers to as &amp;ldquo;expressiveness through imperfection&amp;rdquo;. The first part of this project is the objects themselves called &amp;ldquo;Mold-A-Rama Mickey&amp;rdquo;, a series of 3D printed replicas of an actual Toy Factory figure manipulated by a unique process of iterative 3D printing and scanning that produces sequential Mickey figures, in a way such that each is more deformed than the last. This morphing as a result of a theoretically lossless process reveals a more interesting, meaningful form as mediated by the idiosyncrasies of that process itself. The second component of DisneylandToyFactory.com is a website, serving as the contemporary replacement for the physical vending machine. The main page offers simplified and vague exaltations of &amp;ldquo;Mold-A-Rama Mickey&amp;rdquo;, claiming that, &amp;ldquo;thanks to the advancements of 3D printing&amp;rdquo; these collectibles can be printed on-demand and uniquely for every customer. The reality, however, is that each Mickey sold is actually just the latest iteration of the transformed figures from the cyclical 3D printing process. By framing this subversive concept in consumerist terms, it both offers a light jab at the emptiness of consumption as well as provides a stealthy way of bringing the resistance of this new more expressive object to more people. Finally, the artistic merit of the imperfections is further emphasized through the creation of high-quality resin versions of a selection of the figures, all glitches, and striations intact.",
    "zoom_link": ""
  },
  {
    "project_id": "8637",
    "project_name": "in:verse",
    "elevator_pitch": "What is a programming language, and what can it be? What does a programming language that is not imbued with values of efficiency, utility and terseness look like? Can a poem be a program? Can code be as compelling as the artifact it attempts to create? in:verse is an experiment and exploration to answer these questions.",
    "description": "Programming languages are associated with utility and efficiency, but for decades, programmers have been exploring the bounds and definitions of programming languages through the creation of impractical, whimsical and absurd languages &amp;mdash; designed not for their utility value, but rather the experience they propose. Much like the constraints and rules that writers and poets use to fuel creativity, these &amp;quot;esoteric&amp;quot; languages present constraints that create space for different kinds of thinking, and posit new ways of examining the communication between humans and machines.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nInspired by this rich history, in:verse is a programming language and development environment with embedded values that stand in opposition to the languages we are accustomed to; where poetry is code, random chance is valued more than precision, and telling a story is valued more than succinct, terse code. It is an experiment in engaging a broader audience in the speculations of what a programming language can be.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nin:verse allows writers to create visuals with words, to mold the language to their liking, and to effortlessly explore unusual variations to their programs &amp;mdash; with the assurance that their programs will never crash. It presents a writer with a puzzle in three parts &amp;mdash; writing a shader, which requires a different mode of thinking than most computational drawing tools; using a stack-based programming paradigm, that is rarely seen in mainstream programming languages; and telling a story or writing poetry within these constraints.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nin:verse encourages writers to build worlds in their minds as they write programs; to indulge in the practice of constraint-based writing; to explore new modes of collaboration; to forgo the need for speed and efficiency; and to embrace uncertainty and a lack of control.",
    "zoom_link": "https://nyu.zoom.us/j/7530733491"
  },
  {
    "project_id": "8638",
    "project_name": "Journey Behind the Food",
    "elevator_pitch": "An interactive storytelling App tells history behind the Chinese dishes combines with personal quizzes and game",
    "description": "Journey Behind the Dish is an interactive storytelling App tells the history behind the Chinese dishes, specifically targets to people who are ethnically Chinese were born outside of China. The players need to finish the quiz first and get the result about which part of mainland China they originally come from. The App will show a typical dish at this region and player can experience the journey to learn about the history by reading texts, seeing animations and playing game. The culture and history is rich behind Chinese dishes. This is a playful App for educational purpose that inspires Chinese to learn about their culture of origin while embracing their identity no matter where they are.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8639",
    "project_name": "Kill Me, Help Me",
    "elevator_pitch": "&amp;quot; Kill Me, Help Me&amp;quot; is a mobile application game aiming to provide a medium to help the people understand phobia, ease fear, and bridge gaps.",
    "description": "In this project, by showing common phobias and feedback from the user&amp;#039;s face or voice in the front of fear, with the permission of the user, to enable the user to understand common fears and to generate the willingness to understand several major types of rare phobias, helping to create empathy and bridge gaps. ( Primarily between the people having uncommon phobias and others).The introduction and adaptation of the uncommon fears, as well as the gradual improvement of the rare fear collection and communication function, help to strengthen the help role of the app.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n&amp;mdash;Experience phobias with exposure&amp;lt;br /&amp;gt;\r\nPlayers are exposed to the photos, audios, and videos of phobias based cognitive behavioral therapy.&amp;lt;br /&amp;gt;\r\n&amp;mdash;Three modes to terminate the experience of fears based on personal requests and instinctive reactions.&amp;lt;br /&amp;gt;\r\n1. Manually exit: If you can&amp;#039;t stand exposure to phobias any more, you can click the button to quit at any time.&amp;lt;br /&amp;gt;\r\n2.Face detection: When the camera detects the player&amp;#039;s fearful expression, it automatically exits the exposure process.&amp;lt;br /&amp;gt;\r\n3. When the player says, &amp;quot;stop it,&amp;quot; the process of being exposed to fear is automatically terminated.&amp;lt;br /&amp;gt;\r\n&amp;mdash;Empathize with uncommon phobias by experiencing the physical discomfort of common fears.&amp;lt;br /&amp;gt;\r\n&amp;mdash;Mutual aid and mutual understanding&amp;lt;br /&amp;gt;\r\nMulti-users experience uncommon fears at the same time, see how other users solve similar problems and give each other advice by typing messages.&amp;lt;br /&amp;gt;\r\n&amp;mdash;A collection of strange phobias&amp;lt;br /&amp;gt;\r\nAs user usage increases, more feedback will be received, followed by more fear modules to help more people ease their rare fears.&amp;lt;br /&amp;gt;\r\n&amp;mdash;Disclaimer&amp;lt;br /&amp;gt;\r\nThis application game is not intended to be a replacement for treatment nor any sort of medical intervention.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nResearch&amp;lt;br /&amp;gt;\r\nMobile therapy for phobia is not new, but the market for my product that builds connections with &amp;quot;common&amp;quot; and &amp;quot;rare&amp;quot; fears and collects &amp;quot;strange&amp;quot; phobias are not saturated.&amp;lt;br /&amp;gt;\r\nQuestionnaire-users&amp;lt;br /&amp;gt;\r\n1. About what kind of situation can phobia attack, people believe that being in a real position where they are afraid of something and associating that with something they are fearful of can lead to that fear occur.&amp;lt;br /&amp;gt;\r\n2. Slightly more than half of the people think their phobia is manageable, and in the way they overcome their fear, they are more likely to seek help from the outside world than to digest it themselves.&amp;lt;br /&amp;gt;\r\n3. Of course, there are still some people who haven&amp;#039;t found practical solutions to phobias. Some of them are helpless, but most of them are actively trying different approaches.",
    "zoom_link": ""
  },
  {
    "project_id": "8641",
    "project_name": "Form2Shape",
    "elevator_pitch": "Form2Shape is a tool that enables communication and web designers to create abstract graphics while learning about the history of design. I extracted abstract 2D shapes from iconic industrial designs of the 20th century that designers can easily customize and use in their own work.",
    "description": "Form2Shape is built for digital designers who want to learn more about 20th century industrial design history. Since all digital designs ultimately extend into real life, I believe learning broader design principles ultimately will make better digital designers. In a world where designers share templates and assets over the internet, new projects rarely have to start from scratch. That led me to think that it might be possible to slip in a piece of design history education to designers during the asset hunting process. So I built a tool where designers can quickly find abstract shapes, customize and use them. The twist is that all the shapes are inspired by iconic furniture and product designs of the 20th century. I hope when they pick an arbitrary shape for the look, they would spend a minute learning about where it came from.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8642",
    "project_name": "Tofu",
    "elevator_pitch": "Tofu is a VR interactive installation that presents the consumption experience of convenience stores and street food in the city in a surreal way. It reflects consumers&amp;rsquo; different relationships with food and the disappearing local marketplace culture behind this confrontation.",
    "description": "Tofu, an affordable ingredient with hundreds of shapes and cooking methods, is a common ingredient in China from ancient times and shows the evolvements in our eating habits. The virtual reality installation Tofu is showing these changes in a surreal way: The first chapter provides a scene of how young workers buy food in a convenience store. Players will find themselves getting off work in a city, entering a convenience store, and choosing different tofu products with appearing packages and marketing strategies. The second chapter is about the decreasing local food marketplace. The convenience store suddenly collapsed into soybeans, exposing players to a street food carnival where chili, fried tofu and other street food are wildly floating in the city. The third chapter shows how tofu is made in rural villages. The player will see villagers making the simplest tofu. In each chapter, players can grab and eat different forms of tofu, unlocking the voice narratives. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe piece is aiming to bring viewers a reflection on the changes in our consumption culture: In today&amp;#039;s rapid urbanization, unified brands reconstruct our local life with their convenience and brand images. The market is promoting the disappearance of our neighborhood culture. City residents are enjoying the consumption of grand stories and values, but have little interest in getting to know the history of the street we live in, which is actually harmful to the diversity of our cities.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://us04web.zoom.us/j/2754416216"
  },
  {
    "project_id": "8643",
    "project_name": "Without a Reflection",
    "elevator_pitch": "Without a Reflection is a series of AI video outputs aimed at addressing the dilution of intent in human communication. Each video is abstracted through various verbal and visual filters to the point of unrecognizability.",
    "description": "Over the course of human history, communication has increasingly become more and more sophisticated. However, an unforeseen byproduct of this technological advancement is the introduction of various layers of abstraction. As our attempts to communicate pass through these layers, the original intent begins to erode.  Transitioning from physical interaction, to voice calls, emails, texting, and eventually video, each layer blurs our total understanding.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThis project attempts to answer the following question: &amp;ldquo;At what point does communication become so abstract that it loses its&amp;rsquo; original meaning?&amp;rdquo; As communication moves mainly online, what do we leave behind as we focus more on our virtual selves?&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nWithout a Reflection is a video project aided by machine learning, that addresses these questions by removing the person and their intent along various stages of the communication process, resulting in an entirely new form of communication.  Each time the video is processed both verbal and visual, a new layer of abstraction is introduced. The only thing left untouched is the original voice, a digital trace tying the viewer to the origin of intent. By showing the progression of abstraction, the audience is invited to interact on an emotional level to this new form of communication.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe structure of the outputs mimics the process of our digital transformation. These layers of abstraction combine to slowly become our projected selves in the digital world.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8644",
    "project_name": "The Peacock Gate",
    "elevator_pitch": "Can I make my memories virtual? How will that process affect my identity that emanated from those memories? When we lose material connections to our memories of the past, can we rebuild that connection by recreating those memories in the virtual space? Do virtual memories precipitate virtual identity? &amp;lt;br /&amp;gt;",
    "description": "The Peacock Gate is an interactive virtual reality dairy, in which I attempt to transform fragments of personal memories and consciousness into virtual sculptures and virtual memories. It is a self-dissection and retrospect of my struggle for a clear cultural and social identity by enacting fragments of my memory, from an estranged hometown to my immigrant experience. In this process of recreating memories in virtual spaces and translating mental experiences to virtual experiences, fluid, intangible memories are solidified and contextualized, abstracted and reshaped. These memories constructed virtual spaces that became a ghost town of my reconstructed identity. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIt&amp;rsquo;s an interactive vr experience where the audience travels to different memory spaces while hearing a voice talking about these memories. Each memory space involves interactions that allow the audience to enact the experience the narrator is recounting. &amp;lt;br /&amp;gt;\r\nThe experience of leaving my hometown and home country to live in different cultures and societies in my formative years, had a strong impact on my identity. It&amp;rsquo;s a loss of definition for &amp;ldquo;home&amp;rdquo;. It&amp;rsquo;s a rupture between my perception and action. It&amp;rsquo;s a compulsive desire to return to my origins. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nI held on to these memories of my childhood and hometown, referring to them as the origin of my identity. But rapid urban development replaced all my old memories with new constructions, and I lost all material connections to my memories. These memories, objects, and spaces now only exist in my consciousness in a fluid, obscured form, and so is my identity. I try to recreate these objects, spaces and memories and put them in a virtual space. I used virtual reality as a form of embodiment of my consciousness. Having these memories dwelling in virtual spaces, lost connections to my origins are restored in a different form. These memories are immaterial, but tangible. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIn this process of &amp;ldquo;migrating&amp;rdquo; my memories, I recreated, reinterpreted, and reconstructed my memories. Making virtual memories is both an experiment and a metaphor. They can never be an accurate representation of my original experience, but memory is constantly evolving, and these virtual spaces and sculptures are abstracted remains of that evolution. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThese memories construct me. Do virtual memories precipitate my virtual existence (or at least partially)? Is there a virtual identity emanated from these virtual memories?  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8645",
    "project_name": "The revolt of replicas",
    "elevator_pitch": "An interactive installation about the mediatization of the Chilean uprising of October 2019 and its effects on space/time perception.",
    "description": "The revolt of replicas is an installation that explores how spatiality and temporality are affected when real life events are mediated by digital platforms such as Instagram. Smartphones, the social media support, become a window where the world we have accepted to be true gets rendered infinitely and repetitively. Through the device&amp;rsquo;s screen we are able to scroll down an endless concatenation of events that are taking place anywhere and at any given time, but when represented in front of us, they compose a new version of reality, one that is conveniently at our fingertips.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe installation consists in a dark room with one phone in the center that displays an Instagram feed showing the events that occurred in Chile between October 18th, 2019 to January 1st, 2020. At each side of the room, big scale replicas of two monuments that have played a symbolic role during the revolt are projected. Using the scrolling feed as an interface, these historic monuments &amp;ndash;depicted by photogrammetric 3D models&amp;ndash; become simulations of reality that bend as light rays would when pulled by a massive gravity force.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8646",
    "project_name": "Composition in Confinement",
    "elevator_pitch": "Composition in confinement is a new media performance where the world outside is re-interpreted is search of a personal physical voice for our current beauty.",
    "description": "I find that I&amp;rsquo;m really interested in the untold story of the two procedures of artistic and technical aspects of a project growing together and learning from each other; being in constant dialogue. &amp;lt;br /&amp;gt;\r\nWhat does this growth look like in my work? Can I depict this in a performance? Can I turn this dialogue into an underlying structure that I can keep using?&amp;lt;br /&amp;gt;\r\nHow can I build an immersive environment, a choreographed world or a performance within my home to bring my body and my mind together? How can I depict this world through light and movement?",
    "zoom_link": "https://"
  },
  {
    "project_id": "8647",
    "project_name": "Digital Dance Hall",
    "elevator_pitch": "Digital Dance Hall is a social video platform for internet dance parties. It recreates the festive energies, kinesthetic effects, and social interactions of my favorite nightlife environments in an effort to foster spaces for ecstatic communal experiences and the creation of new performative versions of oneself.",
    "description": "Experience design for nightclubs and dance parties has always been propelled by new technologies and mediums, but it is only in the wake of a global pandemic and its associated social practices for outbreak mitigation that earnest efforts are being made to create meaningful party experiences online. Digital Dance Hall is a timely solution to an urgent need in nightlife; it is a platform for an underground dance music community which is underserved by existing products and tools. Its design takes into consideration the needs and roles of DJs, lighting designers, promoters, and party-goers; its features adapt some of the rituals and behaviors from physical spaces which I encountered and developed in my research into digital UX patterns. It is my hope that parties facilitated by Digital Dance Hall can serve some of the functions of their physical counterparts, namely as places for community building, presentation of forward-thinking music culture, and the creation of new performative versions of our self identities.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8648",
    "project_name": "Thesis2020",
    "elevator_pitch": "Create well documented resources for citizen scientists to better understand their own power consumptions",
    "description": "Create well documented resources for citizen scientists to better understand their own power consumptions",
    "zoom_link": "https://itp.nyu.edu/thesis/journal2020/kathleen/author/chc686/"
  },
  {
    "project_id": "8649",
    "project_name": "loser.io",
    "elevator_pitch": "The origin of all technologies is the maintenance of compromises needed to sustain it.",
    "description": "loser.io is a service that provides remote access to player pianos through a REST APi interface. loser.io is aimed at businesses interested in optimizing their operational costs by reducing resources dedicated towards directly interfacing with piano players, tuners, movers, and technicians. To use loser.io, one simply directs a software engineer to integrate web requests to the service into the client&amp;#039;s existing business logic. Each request effectively uploads a new &amp;quot;opus&amp;quot; to the processing queue, which is then recorded by a set of internally managed player pianos in as little as 24 hours. The client&amp;#039;s system is then notified of the location of the recording through an automated mechanism.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8650",
    "project_name": "Urban Dream: City Fl&amp;acirc;neur",
    "elevator_pitch": "Urban Dream: City Fl&amp;acirc;neur is a location-based traveling Augmented Reality(AR) experience that depicts the three different derivatives of Chinese and American culture. This AR journey will go through an immersive world filled with a series of story-based digital sights occurring in Chinatown, Manhattan. &amp;lt;br /&amp;gt;",
    "description": "&amp;quot;Fl&amp;acirc;neur is a cultural observer. He writes books and poetry and takes photographs, with the cultural aim of understanding the city, yet he never just looks at it from the surface. Instead, he experiences some things in depth.&amp;quot; Leo Ou-fan Lee, a Chinese commentator and author, describes city Fl&amp;acirc;neur in the book The Fl&amp;acirc;neur in the City: Cultural Observations.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe best way to get to know a city is to learn the stories of the people in that city. The artist tends to be more objective by observing and understanding the story behind it, which has always been his creating premise. Augmented Reality as an emerging new media art tool allows people to understand narrative better. The artist took this medium to create a portable museum where people have almost unlimited access to the culture and stories of the city. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIn creating this project, the artist wandered around Chinatown as Fl&amp;acirc;neur to explore stories about race, immigration, and assimilation. He talked with the people who live there, observed the business that makes money there, and researched the history that happened there. Based on those urban data he gleaned during the process, He designed three digital AR contents. The three main elements he chose to focus on are food, residents&amp;#039; stories, and language.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThrough bridging digital reality and physical relevance, this project offers a new approach to understanding the city and an alternative way for the tourist to explore the city. This project offers a new approach to understanding the city. The artist recreates the cultural complexity in digital sculpture as an urban landscape, and Augmented Reality (AR) is utilized to make virtual spots for the public to join the virtual travel of Chinatown.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8651",
    "project_name": "Magical Musical Wand",
    "elevator_pitch": "A magical, musical wand that plays music with the flick of the wrist!",
    "description": "This project is an extension of a previous design.  Now the wand allows you to pick the notes you&amp;#039;d like to play as well as adds a number of new gestures and sounds.  The device can be used as an instrument for musical performance or for interactive projects of all kinds.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8652",
    "project_name": "Enigma",
    "elevator_pitch": "Enigma is a series of sculptures, poems, and a workshop that explores the enigma of electricity within everyday technical objects.",
    "description": "Enigma explores the concealed, ephemeral, and everyday aspects of electricity and electronics through a series of poetry, sculpture, and workshops. While in some ways Enigma appears to be a manifesto to rethinking electronics and physical computing pedagogy, it was made with the intention to open a dialogue between people who do not have experience building and designing electronics. &amp;lt;br /&amp;gt;\r\nThe first part of Enigma is a set of poems written within schematic diagrams of electronic circuits. I see the schematic poems as interventions within the practice of diagramming, investigating the textual elements at play within electronics and their representations. The second part is a series of sculptures that contain conductive materials. The sculptures take on figural forms that appear not-quite-human, maybe ghostly or machinic, and could serve as whole circuits themselves or as discrete components. The last part of Enigma is the Pulse-Width modulation workshop, which explores pulse-width modulation as a unique place where the boundary between analog and digital loosens, asks people without experience in electronics to construct an interface by using a mix of household materials that vary in conductivity. &amp;lt;br /&amp;gt;\r\nThe three parts inform and interrogate each other, and at times it may not be clear where one piece ends and the other begins. The project fixates on language and bodily forms&amp;mdash;which at times confuse and create the other&amp;ndash;that are embedded and hidden in electronics. Enigma is interested in precisely this language and these bodies that can be found in the shapes of discrete electronic components, the over-determined infrastructures of pcb fabrication and schematic diagramming, liminal signals that can be both digital and analogic, and the looming presence and enigma of electricity itself.&amp;lt;br /&amp;gt;",
    "zoom_link": "http://www.hannahtardie.com/"
  },
  {
    "project_id": "8653",
    "project_name": "MySight VR",
    "elevator_pitch": "See through the eyes of people with vision disabilities.",
    "description": "MySight provides audiences the ability to experience the perspectives of individuals with different forms of vision disabilities through a narrative-driven VR experience, bringing understanding into how they see, perceive, and experience the world.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThere are 250 million people across the globe living with vision disabilities, of which nearly 200 million fall into the spectrum of low vision, which entails possessing some usable vision. Because many of these conditions cannot be assisted by aids such as glasses, etc., there is often not an obvious tell externally for what is constantly being experienced internally. My goal with MySight is to help bridge awareness and understanding of these perspectives through embodying them in the virtual reality experience. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nAnd as a technologist with a vision disability myself, my hope is that with more awareness, this community will have an influence and not be an afterthought during the design phase itself for products and services in the future.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8654",
    "project_name": "(Non-)Human",
    "elevator_pitch": "What is human, what is not human, what is in-between? (Non-)Human is an art installation that conjures the hidden human-ness in objects and imagines a speculative world where a human exists in non-human forms.",
    "description": "We live a life surrounded by objects we build to serve us - curtains, lamps, and many others.  We use our body to interact with these objects - rubbing our face against warm towels, or sinking into a fluffy bed. We, as humans, rarely consider them to be part of us. We tend to think of ourselves as different - we&amp;rsquo;re the ones with spirituality, reason, intelligence, while they&amp;rsquo;re not.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nYet, objects keep our traces, like dents in our shoes, or the erased keys on our laptop. Objects carry our memories, like an inherited music box, or a bowl with the smell of mom&amp;rsquo;s favorite recipe. Objects also shape us either physically or behaviorally: it a scar from a knife cut; or a spontaneous &amp;ldquo;sorry&amp;rdquo; when we bump into a table. All of these suggest a possible deeper connection between humans and objects, which we don&amp;rsquo;t notice on a daily basis.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe advancements in modern physics have pointed out the similarity between humans and objects in terms of materiality. Emerging technology such as ML / AI has shown the promise of non-human intelligence through computation. More than ever, the borderline between human and object has become blurred. My question is if there is a spectrum that measures the level of Human-ness vs. Object-ness, what lies in the middle ground? How close might an object endowed with a certain level of intelligence or consciousness be to a human? As a response, my thesis project (Non-)Human is a series of art installations &amp;mdash; a bedsheet, a mask, and a camera &amp;mdash; that explore the semi-human, semi-object territory by creating humans in non-human forms. In light of the pandemic, I created the initial piece of this series which is a bedsheet that tweaks and bends in the form of its owner, now up and out for the day.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8655",
    "project_name": "TUI: Tender User Interface",
    "elevator_pitch": "TUI is an intuitive voice companion that mimics the nature of human intimacy.",
    "description": "Imagine your very beginning &amp;ndash; the narrative you were given; the memory you have no recollection of: born inside your mother&amp;rsquo;s womb; you existed in the world together &amp;ndash; you belonged. The connection between your beginning to your present reality, in quarantine for COVID-19, is a familiar feeling to your past, a gentle reminder for the emotion that you have felt many times before, and will continue to feel, this innate yearning &amp;ndash; to want nurture, to want care is fundamental to the genetic makeup of who you are, each feeling is awaiting to get back to the beginning, where you had a familiar sense of belonging &amp;ndash; you were not alone. I created a voice companion that explores intimacy through tender conversations between me and Alexa, the voice AI of Amazon Echo.",
    "zoom_link": "https://N/A"
  },
  {
    "project_id": "8656",
    "project_name": "Experiments in Expressive EEG",
    "elevator_pitch": "In what ways can EEG be incorporated into generative visual art? My Thesis consists of a series of experiments that attempt to explore how deeper experiences can be understood, expressed and augmented by driving a generative visual art system with the artist&amp;rsquo;s real time EEG data.",
    "description": "I&amp;rsquo;m an experimental visual artist. I create abstract art both to look deeper into myself and also to represent the depths of my self with the hope that this representation serves as an invitation for others to look into themselves as well. In this regard EEG held the potential to be a means for dialogue in a new language between me and the artwork. How this dialogue can be used for deeper, more intuitive emotional expression and how it can be made to create and sustain a feedback loop, were the two main questions I wanted to answer. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nAlthough data is one of the fundamental aspects of the process, this isn&amp;rsquo;t a data visualization project. The understanding of the data, along with the understanding of myself, serve to inform possibilities of emotional expression and the systems in which the expression occurs. This project is thus an attempt at reflecting myself off of a medium. The clarity of the reflection depends on my understanding of the medium, as well as my understanding of myself.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nWith so many EEG based art projects around and the lack of data or explanation that could help verify the claims of these projects, I&amp;rsquo;ve had to devise my own experimental method in order to explore ways of creating visual art based on my realtime EEG data. I&amp;rsquo;ve analyzed my own EEG data, recorded during various activities including different types of meditation. I&amp;rsquo;ve also researched neuroscience papers to find ways of making sense of EEG data and executive EEG control, as well as papers dealing with various EEG driven artworks and art installations. I&amp;rsquo;ve combined my findings and observations to create a number of visual programs that output visual artwork based on my real time EEG data coming in. I experimented with different rules and conditions to drive the final visual output. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nI&amp;rsquo;ve created visual art with open eyes, eyes closed and a mixture of both. I&amp;rsquo;ve relied on memories, positive and negative emotions, contemplative practices, curiosity and surprises. The resulting images tell a story over an arch of many months, as well as mini stories of discoveries among groups of two or three images.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8657",
    "project_name": "Glitch Please!",
    "elevator_pitch": "A social game that uses friendly competition to encourage subversion of norms and disinhibited displays of diversion.",
    "description": "Glitch Please! is a social, mobile game that promotes lowering inhibitions by encouraging players to subvert norms and make mischief. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe experience is simple; player 1 poses a challenge to either an individual or a group, and the other player(s) attempt to complete the challenge with a photo. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nChallenges are sorted into 5 different categories to fit a variety of scenarios and contexts; indoor, outdoor, social, prank, and custom (where players can write their own prompts). &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIn the 1-on-1 gameplay, player 2 either succeeds or fails to complete the challenge based on player 1&amp;rsquo;s judgement. If they succeed, player 2 is rewarded with a visually glitched version of their challenge photo and +1 filter points. If they fail, they can try again.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIn the group gameplay, player 1 chooses the photo that best completes the challenge. The winning player is rewarded with a visually glitched version of their challenge photo, +1 filter points, and gets to select and judge the next round&amp;rsquo;s challenge. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nFilter points are accumulated to eventually unlock glitch filters at different levels. Once a player accumulates enough points to unlock a certain filter, they are able to use the filters to take glitched photos anytime in app. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nSuccessful (1-on-1) and winning (group) photos are saved in a photo library in app. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe key nuance of the game is the subjective and mutable nature of success. The challenge prompts are abstract and open to interpretation; in order to succeed it is necessary appeal to the tastes of player judging the round. The flavor of the game is entirely defined by the people playing.",
    "zoom_link": ""
  },
  {
    "project_id": "8658",
    "project_name": "Jackie&amp;#039;s OS",
    "elevator_pitch": "Jackie&amp;rsquo;s OS is a speculatively reimagined operating system designed for (and with) my childhood self. A web-based experience simulating the childhood computing experience I wish I could&amp;rsquo;ve had, Jackie&amp;rsquo;s OS nostalgically longs for a timeline that never was - asking how things could have played out differently - both in how I grew up, and in the world of technology.",
    "description": "Over my life, I&amp;rsquo;ve transitioned from a starry-eyed child fascinated by technology, to an adult disillusioned by her experiences in it. I&amp;rsquo;ve also begun to notice the dominant values that echo my social and technical worlds: I must be rational and productive, work to prove my value, quieten my emotions. Adulthood forces me to unpack some of these beliefs, but as I navigate a career in technology, how can I reconcile with ideologies still so ingrained in computing culture? What can it look like to refigure my relationship with computing, by going back to its roots?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nMy response is Jackie&amp;rsquo;s OS: a speculative reimagining of my childhood computer that dreams about an alternate timeline of my formative, (twee)n years in the mid-2000s. Drawing from research of computing systems as echoing patriarchal, hegemonic values about intelligence, productivity, and control, I ask: what if my computer could embody values I wish I could&amp;rsquo;ve seen? That I have value the way I am, deserve to have space for emotions, and have agency on my own terms?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThese values are the core design principles in Jackie&amp;rsquo;s OS and its reimagined graphical user interface, file system, user authentication, and applications. In a simulated, web-based operating system, visitors can encounter the alternate-reality world of my past self by clicking around the interface, exploring my things, and playing with applications - all designed in my whimsical, childhood imaginary.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nA playfully critical exploration specific to my personal experiences in technology, Jackie&amp;rsquo;s OS is my starting point to explore what it could mean for others (especially those in technology, and those younger than me) to reflect on how emotional needs could be better met, to dream of how things could be, and to develop new relationships with technology through modes of reconciliation, healing, and care.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8659",
    "project_name": "The Digital Sublime",
    "elevator_pitch": "The Digital Sublime is an installation that audio-visually overwhelms the viewer with computational complexity, in an attempt to create the feeling of the Sublime.",
    "description": "I am exploring the idea of the Sublime, defined as awe that makes you feel small in the face of something powerful and out of your control, and what it looks like in a digital context. Can technology fill in the gaps left by religion and living apart from nature?",
    "zoom_link": "https://"
  },
  {
    "project_id": "8660",
    "project_name": "What Can A Library Do?",
    "elevator_pitch": "This project is an examination of the histories and futures of libraries at the edges.",
    "description": "&amp;quot;What Can A Library Do?&amp;quot; seeks to answer the question it poses through a set of speculative interfaces for engaging with an existing collection of texts. The interfaces are based on research that examines the worldmaking capacity of libraries by delving into the work of a few renegade librarians. This set of experiments seeks to expand the possible answers to another question:  How can the librarian and the reader conspire to make new worlds possible?",
    "zoom_link": "https://"
  },
  {
    "project_id": "8661",
    "project_name": "Interlogue",
    "elevator_pitch": "A collection of text-based interactive narratives adapted from real stories that reflects social issues, aimed to explore the lean essence of interactive storytelling",
    "description": "A collection of text-based interactive narratives adapted from real stories that reflects social issues, aimed to explore the lean essence of interactive storytelling",
    "zoom_link": "https://"
  },
  {
    "project_id": "8662",
    "project_name": "The Shape of Refractive Memory",
    "elevator_pitch": "Imagine a collection of stacked paper cutouts forming a dimensional snapshot that can be interacted with through senses beyond just sight alone.",
    "description": "As humans, our views of the world are as unique as we are. Each one of us experiences life and develops our own personal understanding of our perceived reality, sometimes only distinct to our own developed perceptions of existence. What&amp;rsquo;s most fascinating to me, is that when we look at an object or a series of objects grouped together, we don&amp;rsquo;t necessarily collectively see them in the same way.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nTake the night&amp;rsquo;s sky as an example &amp;mdash; we all see stars when we look up at the interstellar space; however, what we perceive may be totally and completely different from one another. Some of us perceive movements or patterns and can connect the points of light into constellations; others see the interstices, and the dark spaces between the stars. Some see the stars in two dimensions, arrayed like glowing bright dots of light of various sizes on the what seems to be infinite ceiling; others perceive more of a multi-dimension of depth in the varying magnitudes within the interstellar systems.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThis concept is also true when turning our focus to our own past events, and as time passes, our perceptual capture of memory begins to fade just like a tattered photograph.  When looking back at a particular moment, the details have softened and the lines have blurred into a single collection of flashes, equating to a momentary feeling that ignites similar feelings into a seemingly never-ending well, rather than that of simply a full-sensory recollection of a singular event.  &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe concept of charged memory and how we as humans have this incredible ability to encapsulate and preserve our emotions and feelings into a multi-dimensional experience that often can only be retrieved in fragments at times.  It is only when optimal and keenly timed, that we can access and assemble these remnants into a complete remembrance to see through the sea of haze and hold the moment fully and separate from any other.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nTaking into account that Art or more formidable, the latin meaning of Art&amp;eacute;s, which is more ontological in nature, is a paradigm in itself.  It is a way of being and a sentient existence that encompasses the formulation and interpretation within five known senses and beyond. I have found that during my time at ITP, I have been able to synthesize these concepts and it is my aim is to share these notions and how my own personal story aligns to these findings through sculptural art and the undertaking of expressing these ideas.",
    "zoom_link": "http://www.madshutterphoto.com/refractivememory"
  },
  {
    "project_id": "8663",
    "project_name": "The Unseen",
    "elevator_pitch": "An immersive experience with light installations and moving images, to open up conversations around depression in a poetic way, and raise the awareness of the unseen stories about depression that could resonate with the public and the people experiencing it.",
    "description": "Grown up in a typical Chinese family with deep-rooted Asian cultural background, I learned first-hand how stigmatized mental health issues are there. Usually, these problems are perceived in a very black and white way with nothing in between: either you are only all good, or a psychopath; the same applies to if you are depressed, people would assume you should cry and think about suicide all day, if not, then you are just being melodramatic. &amp;lt;br /&amp;gt;\r\nPeople are afraid or ashamed to talk about it, then the bias and stigmas grow bigger and intenser &amp;mdash; the lack of understanding is catalyzing the vicious cycle towards depression. &amp;lt;br /&amp;gt;\r\nPersonally, after having witnessed and even to some degree experienced a lot of negative things started from these stigmas, I began to think about using art as the language to resonate with people, both the public and the patients, as well as raise awareness towards this social issue.&amp;lt;br /&amp;gt;\r\nSo in this project, I&amp;rsquo;m building an immersive experience with interactive light installations and moving images, trying to recreate the experience some parts of the life of being depressed: their visions and perceptions, the invisible barriers in social life, the sense of isolation and incapability&amp;hellip; By showcasing these different aspects with pleasing aesthetics, I wish I could poetically open up conversations around this topic.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8664",
    "project_name": "Lisa and The Cloud",
    "elevator_pitch": "Are you interested in learning about the cloud in a fun and engaging way? Lisa and The Cloud is a digital storybook iOS application that allows you to do just that.  Download &amp;lsquo;Little Stories: Lisa and The Cloud&amp;rsquo; on the App Store today and start learning!",
    "description": "As a developer I have always been interested in learning about the cloud. I have tried to use it at various points and decided not to because it is such a dense subject to be knowledgeable about. When I was asked what I wanted to spend 14 weeks learning about for my thesis project, the cloud was the first thing that came to mind. I thought this would be the perfect opportunity to really take my time and do some research. In doing my research I truly did learn a lot about the cloud. So much so that I wanted to teach other people what I had learned. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nI decided I was going to teach young adults about the cloud because they are the next generation of cloud users. They are growing up in a world where the cloud is extremely essential to the workflow and productivity of humans. When I first approached this project I was going to build an online ebook. A PDF for both kids and adults to download and read. I wanted to make the online version fun, with pictures, audio, games, diagrams, etc. Then COVID-19 happened. Being displaced and having to stay inside gave me a new perspective. All I wanted to do was make fun, small iOS applications for me to stay busy. I realized that people like myself are probably trying to do the same. I decided to pivot my original idea and instead make an iOS application where I explain the cloud in a fun and intriguing way.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8665",
    "project_name": "ONE",
    "elevator_pitch": "ONE is a collection of digital kinetic sculptures I created to explore alternative modes of expression other than written languages. It attempts to capture the poetic nuances and complex layers that sometimes get lost in everyday language.",
    "description": "Language, like other semiotic systems, consists of signifiers &amp;mdash; the written forms or the sounds of words and characters, and signified &amp;mdash; the emotions and intentions we are actually trying to express. According to Ferdinand de Saussure, there is no intrinsic relationship between the signifier and signified. In other words, the link that connects those two is arbitrary. This arbitrariness reminds us that there is a gap between the signifier and the signified and I believe it is through this gap that our more complicated emotions, feelings and definitions get flattened. The digital sculptures I made in ONE are my attempts to bridge this gap. By combining real world data with geometric forms and motions, I created three dimensional symbols to translate meanings that can only be understood through experience rather than abstract visual or phonemes. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nFor the past month, my life has been totally interrupted by Covid-19. While being trapped in my apartment is not a pleasant experience, I still find what I went through and what I witnessed worth documenting.Therefore, I created three digital sculptures that collectively define my Covid-19 experience within the framework of ONE, the alternative representation system I created to communicate meanings. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nNUMBER is a sculpture representing the death toll of Covid-19. I created NUMBER to make sense of the magnitude of the number while reconciling with the fact that each number was once a living human being. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nPERCEPTION is a data sculpture that captures how my perspective of the world has changed during quarantine, when most of the information I consumed came from internet news, and how that changed my relationship with my mom who is currently in China. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nUNITY is a moon-shaped sculpture created from my friends&amp;rsquo; text messages sent to their family and loved ones around the world. By invoking the universality of the moon as a symbol, I created a representation of global solidarity during this time when it is most needed as our relationships with our loved ones are significantly affected/altered by Covid-19.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://www.frankshammer42.me/one"
  },
  {
    "project_id": "8666",
    "project_name": "Bobst: A Bridge to Information",
    "elevator_pitch": "How can the library experience be better?",
    "description": "&amp;ldquo;School libraries exist throughout the world as learning environments that provide space (physical and digital), access to resources, and access to activities and services to encourage and support student, teacher, and community learning.&amp;rdquo;&amp;lt;br /&amp;gt;\r\n- IFLA School Library Guidelines, 2015 &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe Elmer Holmes Bobst Library is the main library at New York University, the core place where research takes place. Students and faculty visit the Bobst Library for their study and to interact with library functions as listed by the IFLA guidelines.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nWhen I visited Bobst Library last semester, I had an unpleasant experience, where I spent a long time wandering around the library trying to find the right room and right bookshelf. There was no clear physical or digital way-finding indicator. This experience made me wonder if there are ways to help students and faculty navigate the library more efficiently. This marks the beginning of the project, Bobst.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nBobst focuses on the core function of the library, which is searching and finding a book.&amp;lt;br /&amp;gt;\r\nThe app shows you where to go and where to check, you can also keep and manage a record of the books you want. Furthermore, you can check the seat availability in the library to study. The original website asks users to open a new page to find book information, while the app&amp;rsquo;s intuitive user interface design reduces the steps it takes to find a book.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8667",
    "project_name": "The Bureau of Push notifications",
    "elevator_pitch": "Picture this, looking busy or unreachable for the sake of it, picking up your phone without any explanation when talking to your friends, shifting your body uncomfortably as if undoubtedly what&amp;rsquo;s playing out on your phone is more important than the moment, mindlessly reacting to every prompt. &amp;lsquo;The bureau of push notifications&amp;rsquo; is a Satirical reflection to our relationship with push notifications.",
    "description": "&amp;lsquo;The Bureau of Push Notifications&amp;rsquo;, a web-based interactive performance coupled with digital inquiries of the personal relationships between push notifications and people. The project attempts to re-think our infatuation with push notifications by humanizing them, showing how society conforms and builds them into our social cues. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIn the performance side of the experience, Dana, sole employee of the Bureau of push notifications, attempts to embody the &amp;ldquo;soul&amp;rdquo; of a push notification. The performance can last up to 6 minutes. It begins by Dana asking the audience to imagine that she is a push notification. Sitting the audience down to talk about the past and future of the relationship they&amp;rsquo;ve had for over 18 years. Revealing the moments of happiness, frustrations and some accusations that were never aired. True to form, Dana (the push) communicates simultaneously with real-time push notifications. Allowing the audience to interact with the video content. This work tries to emulate the ever-present tension of people wanting to be both connected and disconnected, pushing the phone away while longing for a new push.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIn the digital inquiries, &amp;lsquo;the bureau of push notifications&amp;rsquo; presents a series of three observations: (1) A visual study of physical responses to push notifications. (2) A &amp;ldquo;Push language&amp;rdquo; translation proposal to the deterministic &amp;ldquo;aggressive&amp;rdquo; system-level vocabulary that exists today and (3) Exposure therapy in audio form that provides introspection on ourselves and allows us to break free of the conditioning. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nIn reality we choose our media hubs and the it&amp;rsquo;s access to us, we can curate our own world, choose what content we want to satisfy our needs and who can communicate with us. Such external media cues like Push notifications have a powerful role stimulating our consumption habits. Increasingly taking the place of in-person communications by filling the void and letting us feel wanted, desired and even understood. Tailored content targeted at us constantly pulling us deeper into this habit Not by choice but by design. Users, left to navigate their &amp;lsquo;operating system settings&amp;rsquo; without a clear hierarchy of relevance, find all push notifications seem to have the same level of importance. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThis world has become &amp;ldquo;safer&amp;rdquo; and even gives us &amp;lsquo;cover&amp;rsquo; to recede into it when feeling threatened, trying to impress or look unapproachable. This crutch is increasingly becoming harder to penetrate as onlookers have little chance of knowing what is happening in our personal world. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nBy creating &amp;lsquo;the bureau of push notifications&amp;rsquo;, I am attempting to question the rise and minting of the social norm surrounding push notifications. Concluding a reflection on the state of the push notification cultural habits that are forming in our &amp;ldquo;always-on&amp;rdquo; society. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8669",
    "project_name": "Beneath the words",
    "elevator_pitch": "Beneath the words is about investigating ways to aesthetically interpret traditional wisdom inherent in Japanese philosophical sayings.",
    "description": "Japanese philosophy has always been fascinating and somehow mysterious from my perspective. But every time I read about those concepts and words, I somehow feel a bit more anxious and confused though I try to calm down and read about Japanese wisdom. This bothers me from time to time. And I know it will be beneficial if I understand them, but most of the time, the words are explained in a vague way. That&amp;rsquo;s how I start to wonder if I can find a certain narrative that can vividly tell more about the words, and make people feel comfortable and at ease when trying to probe into Japanese words and concepts as an outsider. The goal is to let people who are not previously interested in Japanese philosophy to get a sense of it and intrigue further interests if possible.&amp;lt;br /&amp;gt;\r\n &amp;lt;br /&amp;gt;\r\nIn recent years, Augmented Reality has been widely used as an engaging storytelling medium in a variety of industries. With high&amp;shy; speed connectivity, data collection, and machine learning, we are moving towards an era where the real world can be organically combined with virtual elements as a unique way of storytelling. And with this platform, I see the possibility of interpreting my thoughts visually with a scene or two for viewers to understand more.&amp;lt;br /&amp;gt;\r\nA hand bind book with some patterns and words on a few pages but mostly blank serve the role as a base medium. Viewers will get to experience the feeling of the words and interact with different scenes upon scanning the patterns/words and learn more behind certain Japanese concept in AR. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8670",
    "project_name": "I was here before",
    "elevator_pitch": "A VR music videoclip that explores the recurrence of love &amp;amp; heartbreak, as well as build and collapse in societies.",
    "description": "A series of Unity engine scripts developed to link audio and 3D geometry are the basis of the project. Then, 3D scans are used to serve as dynamic sculptures that morph with sound and interaction.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8671",
    "project_name": "The Archive of The GUIDE",
    "elevator_pitch": "This project is the reimagining the space of an archive through using black and feminist studies and virtual reality.",
    "description": "The Archive of The GUIDE VR is an inquiry into the role the archive, inscription, historicity play in contemporary Western society. This inquiry is coupled with attempts at refiguring the inherently inclusive and hegemonic nature of the content of that is considered archivable by disrupting the space through using black and feminist critical theory to activate and foreground the content in the archive.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8677",
    "project_name": "Hyper Engagement",
    "elevator_pitch": "&amp;lt;br /&amp;gt;\r\nHyper Engagement is a collection of artistic interventions that aim to uncover hidden materiality in how communications technologies mediate our interpersonal relationships.  Each of these projects aim to make tangible a hidden emotional choreography which tools like texting, video chats, and social media engage us in.  I do this by taking traditional design affordances of these technologies and taking them to an absurd extreme. &amp;lt;br /&amp;gt;",
    "description": "In order to take these mediums to their extremes, I decided to pull out the facets of these tools that cause myself the most anxiety.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nFirst with texting, it has always confused me to whether this exists as a synchronous or asynchronous workflow.  Texting exists in the fine line because it is instantaneous, but doesn&amp;rsquo;t require the traditional acknowledgements that come with synchronous communication.  This fine line leads to common texting tropes like being left on read, double texting, and ghosting.  To me there exists a confusing etiquette and choreography that texting brings us to.  In order to address this I decided to build two projects that focus respectively on responding to texts, and waiting for texts. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe Notifier is a wearable that forces me to respond immediately to my text messages.  Every time I get a text message a motor activates that applies suggestive force to my ear by tugging it down.  By applying force to myself whenever I get a text message, I am forced to respond to all of my text messages as soon as they come, making sure I never forget them again.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nRead Receipts is an intervention that reframes your notifications.  The app monitors your text conversations and every 30 seconds a computer synthesized voice tells you how long it&amp;rsquo;s been since another person has responded to you.  This app aims to experiment with the strange line that texting exists in the space between synchronous and asynchronous communication.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nNext, I wanted to investigate the medium of VideoChats as they have begun to dominate daily life in the wake of the COVID19 Pandemic.  I was really interested in the underlying machine learning technologies companies like Zoom and Google are using to monitor our conversations, and the lines between the explicit rules that services make us sign to use them, and implicit rules that we abide by culturally.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nFilter Bubble is an experimental Videochat app that uses optimization algorithms to make sure people in the chats are talking about interesting subjects.  Each day the app scrapes the most popular trending topics on Twitter and uses those words to build a corpus of what is considered interesting.  Users of the Chat App will be required to keep their conversation on topic with what Filter Bubble is asking of them, otherwise they will get muted.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nFinally Give and Take Chat is a Video Conferencing app that changes the dynamics of how our conversations operate.  The App allows each participant to speak for 40 seconds each.  When one users time is up, their microphone will shut off and the other users mic will turn on.  This cycle continues for the duration of the chat.  &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8678",
    "project_name": "The Neo Couture",
    "elevator_pitch": "The Neo couture is a platform for fashion designers to generate AR experiences for retail environments in order to share their studio practice/process with customers in a new and engaging way.",
    "description": "The Neo Couture was born out of love for conceptual fashion design and the designers behind the creations. I am a fashion designer, a professor and soon an itp graduate. I wanted to design a tool that would benefit my fellow designers but also to encourage my students to consider tech in their practice. Designers often associate technology with the less than optimal changes our industry has gone through. I wanted to show how tech can be used in positive ways to promote our discipline.&amp;lt;br /&amp;gt;\r\nInspired by the huge success fashion design exhibits have been enjoying in museums, The Neo Couture aims to bring the rich content and culture that is embedded in designer creations to the customers awareness in a museum like, content curated atmosphere, essentially inviting customers into the designer studios. &amp;lt;br /&amp;gt;\r\nA web platform/template that allows fashion designers to curate their own AR experiences for their customers. Launched in retail space but later enjoyed as long as the customer owns the garment.&amp;lt;br /&amp;gt;\r\nThe project bridges the gap between craft and tech by using a hand crafted physical piece of jewelry to launch the AR experience. Both AR marker/Jewelry  and AR template/gallery have customizable features in order to generate a unique experience.&amp;lt;br /&amp;gt;\r\nAfter looking at works like the David Bowie Is AR app I designed and Curated a case study in collaboration with NYC based fashion designer Kobi Halperin to tell the story of the creation of his SS2020 collection. Users can explore inspirations, design process and even the music Kobi was listening to while working on the collection.&amp;lt;br /&amp;gt;\r\nIn a world saturated with  polluting, unoriginal clothing, The Neo Couture will help reestablish the connection of designer - process - product in the minds of a new generation of mindful, transparency seeking customers.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nContent is the new luxury in fashion.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8679",
    "project_name": "1 Inch is 2 Inches is 3 Seconds is 4 Centuries",
    "elevator_pitch": "Studies of the spectrum of emotions that lie between patterns and noise, sense and senselessness. The studies take the most rigid patterns, such as time measurement and numeric systems, and stretch and contract the linear nature of our cognitive perception through the forms of installations, performances, objects and prints.",
    "description": "Creating patterns is how we make sense of the world. We invent measurements to define those patterns. However, those measurements are optimised for sameness, preventing us from experiencing what lies in between. Patterns and noise exist together all at once in different scales; if only we look close enough or far enough, we can experience the patterns or rhythms that are around us where the interplay between each pattern is what creates an emotion and builds the arc of our experiences, much like a continual performance.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lsquo;1 Inch is 2 Inches is 3 Seconds is 4 Centuries&amp;rsquo; is the study of stretching, contracting, layering and looping the standardised measurements in hope that we can then actively synthesise our own patterns and rhythms given the sensorial information we have around us. Each study is designed to stimulate hyper-awareness of the minute changes in the experience and is an exploration of the affordances of each artistic medium.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nSelected studies:&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;ldquo;60 Seconds, Variable Clocks&amp;rdquo;, Live Installation, four clocks move in distorted time and snap back together every minute. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;ldquo;1234, Tuning-In&amp;rdquo;, Interactive Installation, two persons experience of counting together, separately. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;ldquo;1234, Movement Structure&amp;rdquo;, Live Performance Score, algorithmic movement structure as building blocks for choreography.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;ldquo;An Inch, Stretchy Ruler&amp;rdquo;, Interactive Object, an elastic ruler with stretchable marks.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;ldquo;Weaving Rulers&amp;rdquo;, Print Installation, interlaced rulers forming senseless numerical patterns.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8681",
    "project_name": "Resonate Frequency",
    "elevator_pitch": "A musical installation that reacts to the rhythm and proximity of movement through suspended resonant structures.",
    "description": "Resonant frequency was built around the idea that every day is a performance.  The goal was to create a musical installation that takes advantage of easy and intuitive movements that have been programmed into our subconsciousness through daily ritual.  When a person enters the space, the sound of each footstep is captured and amplified into the body. A second layer is added with arm gestures to resonate the objects decorated throughout the space.  The careful consideration of construction brings musicality.   The change in tones encourages movement.  Depending on the order of how a person swipes, holds, or places their arm, new compositions can be made.  Everything is connected physically in a &amp;ldquo;feedback loop&amp;rdquo;.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8682",
    "project_name": "Supportive Web: working around digital barriers",
    "elevator_pitch": "Artists rely heavily on social media to support their work. Yet the most used platforms were not designed for us. Profit-driven distribution, limitations on organic reach, and content moderation make that very clear. How can professionals of the arts and audience members collaborate to work around these issues, challenging the power dynamics imposed by these companies?",
    "description": "This research started from the desire to comprehend how artists use the internet in 2020. Which solutions have web platforms given us? Which problems have not yet been addressed? Which issues emerge from our online interactions? The goal of this project is to bring together artists and audience members to think about how these dynamics affect them, and most importantly, to share hands-on information on how to navigate the existing tools in order to challenge their structures.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe current dominant platforms are based on posting and consuming media. Once a post is submitted, there are a series of algorithmic processes to decide if that content is suitable, who is going to see it, and how relevant it is for each user. Each platform has its own calculations on those matters, but there is one common logic to them: profit. In a space where the currency is engagement, these companies do all they can to privilege whoever can pay more.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThis is only one of the issues regarding the online dynamics of the art market. How can all people interested in supporting the arts collaborate in order to work around these limitations? This study relies on a survey and a set of interviews encompassing experiences from 158 Brazilian artists to understand these workflows, aiming at analyzing these experiences to create a navigation guide informing artists, audiences and technologists on how to use the internet to support this community.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nDuring the process of this research, the Corona virus outbreak took place. Artists of all fields came up with interesting initiatives for dealing with the disruption of the art industry. These actions may indicate interesting paths for the future, and therefore this project also serves as an archive of how artists responded to the beginning of the pandemic in Brazil.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8683",
    "project_name": "180",
    "elevator_pitch": "How do we define creativity and how do we evaluate the creativity of others? We often put these decisions in the hands of judges, but who judges the judges? And how do we &amp;lt;br /&amp;gt;\r\njudge ourselves? 180 is a web-based interactive experiment built to address these questions.",
    "description": "In 180, participants are guided through a 3-part experience facilitated through a website. They are first asked to perform a creative thinking exercise, then evaluate the creativity of those who participated before them, and finally take a moment of introspection to explain their evaluations. The user is asked to constantly perform 180&amp;deg; flips on their point of view, in order to gain a broader outlook of creativity. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nMy hypothesis is that all individuals have implicit models of creativity, meaning an internal definition of creativity and its criteria. The way a person evaluates creativity in others will always be compared against this model. With 180, I was interested in exploring how these models are created. What influences, biases, and subconscious perspectives form our intrinsic representations of creativity?&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nUsing machine learning natural language processing algorithms, 180 takes user-input in the form of text and analyzes it to find links to scientific literature about creativity. It then presents back a symbolic DNA breakdown of the user&amp;rsquo;s implicit models of creativity to not only teach users about existing creativity research, but hopefully also teach them a little more about themselves.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8685",
    "project_name": "Museum Reader",
    "elevator_pitch": "Museum Reader gives more freedom to blind visitors by making audio descriptions more readily available. It allows museums to create verbal descriptions, and enables visitors to play them back by scanning a tag and listening to prerecorded audio.&amp;lt;br /&amp;gt;",
    "description": "The museum experience for blind visitors is often limited to personalized, scheduled tours, or monthly events. These prepared tours may include verbal descriptions, touch tours, conversations, or a combination thereof. Much effort and many tools have been employed at museums to bring accessibility to the blind, but despite these efforts, blind visitors are missing out on a fuller experience that allows them to enjoy any part of a museum collection of their choosing.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nMuseum Reader is a device that enables a blind patron to scan a tag placed at the artifact site, then hear an audio description associated with that artifact. When implemented, the Museum Reader enables museums to make prerecorded audio descriptions they make available to patrons via the device, thus eliminating the need to train staff and docents for each visit by a blind person. Instead, these museum educators can focus on creating audio descriptions for a wide number of artifacts in a museum, and interact with patrons as they explore a wider range of items.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nFrom a blind visitor&amp;#039;s perspective, a museum visit would not need to be prescheduled, or limited to what pieces can be touched. They could pair up with a sighted guide who can assist in locating the artifacts, and their correspoinding tags, and listen to prerecorded messages and descriptions. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8686",
    "project_name": "Let It Out: Spacial Journaling",
    "elevator_pitch": "A spacial journaling experience that allows one to explore and arrange their thoughts and feelings to get pass their blue and dysfunctional phase by fully immersing one in their thoughts virtually in a 3D space with the least amount of energy required while able to track one&amp;rsquo;s emotional progress without being reminded of the bad place one was in.",
    "description": "Let It Out is a spacial journaling experience exploring the possibilities of connecting one with their own thoughts and feelings in an unprecedented way. It allows me to have a conversation with myself, saying my thoughts out loud just like talking with my friends, to explore and arrange my thoughts and feelings to get pass my blue and low energy phase in between the states of being clinically depressed and feeling completely fine by, instead of dividing me from my thoughts with a piece of paper, fully immersing me in the visualization of my thoughts in a 3D space around me with the least amount of energy required. At the end of the spacial journaling experience, those thoughts in the form of text would become a blurred blob that would be color-coded based on its sentiment tone, so I would not be reminded of the bad places I was in but still able to track my emotional progress. For example, the blurred blobs would be dark blue for depressed thoughts, indigo for frustrated feelings, and etc.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8687",
    "project_name": "Unstructured Search - A Machine Learning Photobook",
    "elevator_pitch": "For my thesis project, I created an ML(machine learning)-generated photobook in collaboration with Professor Editha Mesina, undergraduate students from her studio portraiture class at NYU Tisch Photography and Imaging, and other emerging photographers. The book was designed in partnership with graphic designer An Vo.",
    "description": "&amp;lt;br /&amp;gt;\r\nI want this project to be a physical memory. A way to collect portraits and images that were made by people and made by machines in 2020.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe ML-generated photobook I created for my thesis project combines traditional portraiture photography and machine learning images. The work is titled Unstructured Search because it is the unpredictable nature of early photography and the unpredictable nature of machine learning that intrigues me.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nCreating a photo book was important I wanted to take the digital and make it analog again. I wanted to take a closer look at these unpredictable machine learning images. Machine learning images can easily be produced in great quantities but can also be lost in digital space and digital storage. And although we&amp;#039;re creating so many of these images, we often don&amp;#039;t take the time to look at them closely, individually.",
    "zoom_link": "https://www.abimunoz.com"
  },
  {
    "project_id": "8688",
    "project_name": "Uniformed Meditation",
    "elevator_pitch": "Uniformed Meditation is a one of a kind experience methodically curated by experts to provide mindfulness sound meditation for first responders directly impacted by COVID-19. By dialing a simple toll-free telephone number, first responders have access to several customized sound meditations that focus particularly on the most common stressors experienced during the Coronavirus pandemic.",
    "description": "First responders are people with specialized training who typically respond to the scene of an emergency or accident first. In the midst of the COVID-19 outbreak, they&amp;rsquo;ve become front-line heroes, oftentimes risking their own lives daily in the name of public service. The overwhelming emergency calls and deaths have taken a toll on their mental health. The need for an easy to use, unobtrusive system where first responders have the space to decompress and release emotions are critical. Uniformed meditation provides that space.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nUM is a meditation hotline for first responders. By dialing a toll-free number, professionals have access to six different guided meditation sessions. The meditations were created and customized to address specific responses based on an anonymous questionnaire completed by 49 first responders. I asked the following key questions in the anonymous survey:&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nHave you ever meditated before?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nOn a scale of 1-5, how comfortable are you with meditation?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nAre you able to take a short break to meditate at work or at home?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nDuring this time of high intensity and stress, which time increments are you willing to commit to for meditation? (shortest to longest)&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nWhat is something you are currently struggling with as a First Responder? &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nWhat work/life balance issue do you want to improve the most?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nI focused specifically on questions 4 and 5 to create an overall theme of each meditation and assigned each session a number key:&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nKey ❶ 3 mins &amp;ndash; Breathwork  &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nKey ❷ 5 mins &amp;ndash; Mindfulness &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nKey ❸ 7 mins &amp;ndash; Stress &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nKey ❹ 11 mins &amp;ndash; Fear &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nKey ❺ 15 mins &amp;ndash; Anxiety / Depression &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nKey ❻ 20 mins &amp;ndash; Grievance / Regret  &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe caller is prompted to listen to a meditation of their choice with an option to replay the recording, go back to the main menu, or end the call. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nAdditionally, sound healing techniques were used and specific instruments were hand-selected and played in conjunction with the meditation. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nLive instruments used: Zephyr Chimes, Himalayan Singing Bowls, Tongue Drum, Various(Flower of Life &amp;amp; Chinese) Gongs, Ocean Drum, Swinging Earth Chime&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe value of mindfulness meditation and sound therapy &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;ldquo;Everything in Life is Vibration&amp;rdquo; &amp;ndash; Albert Einstein&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nResearch suggests that meditation and sound healing may help manage stress, depression, high blood pressure, overall moods, emotions, anxiety etc. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8695",
    "project_name": "XX",
    "elevator_pitch": "ZZZZZZ",
    "description": "DDDDDD",
    "zoom_link": ""
  },
  {
    "project_id": "8746",
    "project_name": "Late Night Island",
    "elevator_pitch": "Late Night Island is a VR meditation experience that attempts to recall the warm, quiet but lonely feelings.",
    "description": "Late Night Island is a VR meditation experience that attempts to recall the warm, quiet but lonely feelings. Following the light hint, visitors will find the mysterious coffee shop hiding behind rocks and forest, and enjoy the music I chose. This piece is aimed to help people relieve the pressure and embrace the loneliness during quarantine by creating an imaginary resort.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThis work is inspired by my personal experience of staying at a coffee shop until midnight. I used to visit cozy and dim light coffee shops when I didn&amp;#039;t feel like going home alone. Coffee shop for me is an escape from the boring and limited space. Currently, many people like me are restricted to our own rooms, which results in the feeling of ultimate isolation and despair. Through creating a nonexistent island in Virtual Reality, I would like to invite people to take a break and get away from the limit of reality. &amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8767",
    "project_name": "Design Life Well",
    "elevator_pitch": "Design a business and life you&amp;#039;re wildly proud of.",
    "description": "DLW provides digital tools for successful living. Includes workshops for self-reflection to enhance your potential + manifest the life you desire!",
    "zoom_link": "https://us04web.zoom.us/j/4542807790"
  },
  {
    "project_id": "8771",
    "project_name": "Staring Stars",
    "elevator_pitch": "The staring stars in your life journey.",
    "description": "Inspired by the sentence that &amp;ldquo;aim at the stars, and you will end up in the sky,&amp;rdquo; I corresponded it to the situation that most teenagers like me are facing.  Based on my researches on Teamlab, I realized a successful project should be meaningful instead of being designed for fun. So, I want to make this project to show the progress of teenagers&amp;rsquo; life journey.  I hope everyone who does not know what they are fighting for could get across something via this &amp;ldquo;Staring stars.&amp;rdquo; &amp;lt;br /&amp;gt;\r\nFor this project, I want to create a totally dark space for users to walk into. There will be a sound from the end to lead users. As users are walking into it.  Some clouds over the users&amp;rsquo; heads will start to shine bit by bit. Also, the end of this space will be filled with stars.",
    "zoom_link": "https://https://nyu.zoom.com.cn/j/9013597645"
  },
  {
    "project_id": "8818",
    "project_name": "Hogwarts April Report",
    "elevator_pitch": "Hogwarts April Report is a data story about Harry Potter Fanfictions during April 2020.",
    "description": "Hogwarts April Report is a data story about Harry Potter Fanfictions during April 2020. The subject of my final project is &amp;ldquo;Harry Potter Fanfictions&amp;rdquo;. In the era of the internet, the fanfictions community demonstrates great growth potential. In this interactive data visualization project, based on the most recent month HP fanfictions, I will demonstrate some aspects of HP fanfictions such as relationships, parings, fandoms, and imaginations. I design the website as an online monthly newspaper, it might be more interesting than the pure data analysis.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8845",
    "project_name": "Lashi Conservation Park",
    "elevator_pitch": "Lashi Conservation Park is a photo book project that reflects on the social media induced tourism and its impact on the landscape of Lashi, Lijiang, China.",
    "description": "Lashi Conservation Park is a photo book project that walks on the popular horseback riding trips which take tourists up to the source of the Lashi Lake (拉市海) in the mountains. Lashi Lake is located in Lijiang, Yunnan, China. It was a pathway in the ancient Tea Horse Road before the twentieth century, the trading route between Tibet and China. However, the designation of Lijiang as World Culture Heritage in 1997 gradually turned the whole town to a tourist destination, which drastically reformed its landscape and demographics. Lashi Lake now operates more around tourism and its infrastructure than it used to be. Similar to many other famous sites for sightseeing in China, it also has been decorated with &amp;ldquo;scenic spots&amp;rdquo; for tourists to take photos for social media posting, which are the sculptures, props, and advertising billboards. To an extent, social media-induced tourism dominates the landscape, rendering the landscape secondary as the backdrop for tourist photography. Therefore, the local and historical context of Lashi is silenced and alienated. The further recontextualization of the tourist imaging on social media forces the landscape to acquire new meanings as embellished souvenirs. Collectively, the online circulation and repopulation of such maintain and reproduce the imagination of a tourist attraction.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe book aims to explore the visual language of the vernacular forms of tourism architecture, investigating the social media tourist&amp;rsquo;s experience through the photographic delineation of a foreign land. The linguistics of such can be shared and implemented to different places, forming a bizarre visual unity, a sense of &amp;ldquo;touristy.&amp;rdquo; Contrasted with more everyday visual encounters in the same region, together, they constitute the hyperreality of Lashi Lake, a sense of deracination from the typology of the land. By taking a camera with me everywhere I go, in a sense, I am also a tourist, eager to take photos when I feel conflicted or don&amp;rsquo;t know what to respond to what I see. As someone who has family ties to this village, who can&amp;rsquo;t speak her native Nakhi language, is the action of photo-making and photo documentation of this politicized landscape a form of reconciliation with my identity? Or does the intrusive camera further deepen the gap between me and my people, distancing myself from the water and soil of Lashi.",
    "zoom_link": "https://nyu.zoom.us/j/95950394007?pwd=dTVVVHdBWjY0cy9BbUhwOXhEV3BtQT09"
  }
];
let projects = [];
projects = testProjects;

//
// main() -- our execution entry point
//

async function main() {
  // start mediasoup
  console.log('starting mediasoup');
  ({ worker, router, audioLevelObserver } = await startMediasoup());

  // start https server, falling back to http if https fails
  console.log('starting express');
  try {


    const tls = {
      cert: fs.readFileSync(config.sslCrt),
      key: fs.readFileSync(config.sslKey),
    };
    httpsServer = https.createServer(tls, expressApp);
    httpsServer.on('error', (e) => {
      console.error('https server error,', e.message);
    });

    await new Promise((resolve) => {
      httpsServer.listen(config.httpPort, config.httpIp, () => {
        console.log(`server is running and listening on ` +
          `https://${config.httpIp}:${config.httpPort}`);
        resolve();
      });
    });
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('no certificates found (check config.js)');
      console.error('  could not start https server ... trying http');
    } else {
      err('could not start https server', e);
    }
    expressApp.listen(config.httpPort, config.httpIp, () => {
      console.log(`http server listening on port ${config.httpPort}`);
    });
  }

  runSocketServer();

  // periodically clean up peers that disconnected without sending us
  // a final "beacon"
  setInterval(() => {
    let now = Date.now();
    Object.entries(roomState.peers).forEach(([id, p]) => {
      if ((now - p.lastSeenTs) > config.httpPeerStale) {
        warn(`removing stale peer ${id}`);
        closePeer(id);
      }
    });
  }, 1000);

  // periodically update video stats we're sending to peers
  setInterval(updatePeerStats, 3000);

  // updateProjects();
  // setInterval(updateProjects, 300000); // update projects every five minutes
}

main();

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

async function updateProjects() {
  let url = process.env.PROJECT_DATABASE_URL;
  https.get(url, (res) => {
    var body = '';

    res.on('data', function (chunk) {
      body += chunk;
    });

    res.on('end', function () {
      // TODO parse JSON so we render HTML text correctly?  i.e. so we don't end up with '</br>' or '&amp;' ...
      var json = JSON.parse(body);
      projects = json;
      console.log("Updated projects from database.");
      // console.log(projects);
      io.sockets.emit('projects', projects);
    });
  }).on('error', function (e) {
    console.log("Got an error: ", e);
  });
}


//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//


async function runSocketServer() {

  io = socketIO(httpsServer);

  // update all sockets at regular intervals
  setInterval(() => {
    io.sockets.emit('userPositions', clients);
  }, 200);


  io.on('connection', (socket) => {

    console.log('User ' + socket.id + ' connected, there are ' + io.engine.clientsCount + ' clients connected');

    //Add a new client indexed by his id
    clients[socket.id] = {
      position: [0, 0.5, 0],
      // rotation: [0, 0, 0, 1] // stored as XYZW values of Quaternion
      rotation: [0, 0, 0]
    }

    socket.emit('introduction', socket.id, Object.keys(clients));
    // also give the client all existing clients positions:
    socket.emit('userPositions', clients);

    // Give new socket the projects database
    socket.emit('projects', projects);

    //Update everyone that the number of users has changed
    io.sockets.emit('newUserConnected', io.engine.clientsCount, socket.id, Object.keys(clients));



    socket.on('move', (data) => {
      if (clients[socket.id]) {
        clients[socket.id].position = data[0];
        clients[socket.id].rotation = data[1];
      }
      // io.sockets.emit('userPositions', clients);
    });

    // Handle the disconnection
    socket.on('disconnect', () => {
      //Delete this client from the object
      delete clients[socket.id];
      io.sockets.emit('userDisconnected', socket.id, Object.keys(clients));
      console.log('User ' + socket.id + ' diconnected, there are ' + io.engine.clientsCount + ' clients connected');
    });

    //*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//
    //*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//
    // Mediasoup Signaling:

    //
    // -- our minimal signaling is just http polling --
    //

    // parse every request body for json, no matter the content-type. this
    // lets us use sendBeacon or fetch interchangeably to POST to
    // signaling endpoints. (sendBeacon can't set the Content-Type header)
    //
    // expressApp.use(express.json({ type: '*/*' }));

    // --> /signaling/sync
    //
    // client polling endpoint. send back our 'peers' data structure and
    // 'activeSpeaker' info
    //
    // socket.on('sync', async (req, res) => {
    socket.on('sync', async (data, callback) => {
      // let { peerId } = req.body;
      let peerId = socket.id;

      try {
        // make sure this peer is connected. if we've disconnected the
        // peer because of a network outage we want the peer to know that
        // happened, when/if it returns
        if (!roomState.peers[peerId]) {
          throw new Error('not connected');
        }

        // update our most-recently-seem timestamp -- we're not stale!
        roomState.peers[peerId].lastSeenTs = Date.now();

        callback({
          peers: roomState.peers,
          activeSpeaker: roomState.activeSpeaker
        });
      } catch (e) {
        console.error(e.message);
        callback({ error: e.message });
      }
    });


    // --> /signaling/join-as-new-peer
    //
    // adds the peer to the roomState data structure and creates a
    // transport that the peer will use for receiving media. returns
    // router rtpCapabilities for mediasoup-client device initialization
    //
    // expressApp.post('/signaling/join-as-new-peer', async (req, res) => {
    socket.on('join-as-new-peer', async (data, callback) => {

      try {
        // let { peerId } = req.body;
        let peerId = socket.id;
        let now = Date.now();
        log('join-as-new-peer', peerId);

        roomState.peers[peerId] = {
          joinTs: now,
          lastSeenTs: now,
          media: {}, consumerLayers: {}, stats: {}
        };

        callback({ routerRtpCapabilities: router.rtpCapabilities });
      } catch (e) {
        console.error('error in /signaling/join-as-new-peer', e);
        callback({ error: e });
      }
    });





    // --> /signaling/leave
    //
    // removes the peer from the roomState data structure and and closes
    // all associated mediasoup objects
    //
    socket.on('leave', async (data, callback) => {
      try {
        // let { peerId } = req.body;
        let peerId = socket.id;
        log('leave', peerId);

        await closePeer(peerId);
        callback({ left: true });
      } catch (e) {
        console.error('error in /signaling/leave', e);
        callback({ error: e });
      }
    });


    // --> /signaling/create-transport
    //
    // create a mediasoup transport object and send back info needed
    // to create a transport object on the client side
    //
    socket.on('create-transport', async (data, callback) => {
      try {
        let peerId = socket.id;
        // let { peerId, direction } = req.body;
        let { direction } = data;
        log('create-transport', peerId, direction);

        let transport = await createWebRtcTransport({ peerId, direction });
        roomState.transports[transport.id] = transport;

        let { id, iceParameters, iceCandidates, dtlsParameters } = transport;
        callback({
          transportOptions: { id, iceParameters, iceCandidates, dtlsParameters }
        });
      } catch (e) {
        console.error('error in /signaling/create-transport', e);
        callback({ error: e });
      }
    });


    // --> /signaling/connect-transport
    //
    // called from inside a client's `transport.on('connect')` event
    // handler.
    //
    socket.on('connect-transport', async (data, callback) => {
      try {
        let peerId = socket.id;
        // let { peerId, transportId, dtlsParameters } = req.body,
        let { transportId, dtlsParameters } = data,
          transport = roomState.transports[transportId];

        if (!transport) {
          err(`connect-transport: server-side transport ${transportId} not found`);
          callback({ error: `server-side transport ${transportId} not found` });
          return;
        }

        log('connect-transport', peerId, transport.appData);

        await transport.connect({ dtlsParameters });
        callback({ connected: true });
      } catch (e) {
        console.error('error in /signaling/connect-transport', e);
        callback({ error: e });
      }
    });


    // --> /signaling/close-transport
    //
    // called by a client that wants to close a single transport (for
    // example, a client that is no longer sending any media).
    //
    socket.on('close-transport', async (data, callback) => {
      try {
        let peerId = socket.id;
        // let { peerId, transportId } = req.body,
        let { transportId } = data
        transport = roomState.transports[transportId];

        if (!transport) {
          err(`close-transport: server-side transport ${transportId} not found`);
          callback({ error: `server-side transport ${transportId} not found` });
          return;
        }

        log('close-transport', peerId, transport.appData);

        await closeTransport(transport);
        callback({ closed: true });
      } catch (e) {
        console.error('error in /signaling/close-transport', e);
        callback({ error: e.message });
      }
    });

    // --> /signaling/close-producer
    //
    // called by a client that is no longer sending a specific track
    //
    socket.on('close-producer', async (data, callback) => {
      try {
        let peerId = socket.id;
        // let { peerId, producerId } = req.body,
        let { producerId } = data,
          producer = roomState.producers.find((p) => p.id === producerId);

        if (!producer) {
          err(`close-producer: server-side producer ${producerId} not found`);
          callback({ error: `server-side producer ${producerId} not found` });
          return;
        }

        log('close-producer', peerId, producer.appData);

        await closeProducer(producer);
        callback({ closed: true });
      } catch (e) {
        console.error(e);
        callback({ error: e.message });
      }
    });


    // --> /signaling/send-track
    //
    // called from inside a client's `transport.on('produce')` event handler.
    //
    socket.on('send-track', async (data, callback) => {
      try {
        let peerId = socket.id;
        // let { peerId, transportId, kind, rtpParameters,
        let { transportId, kind, rtpParameters,
          paused = false, appData } = data,
          transport = roomState.transports[transportId];

        if (!transport) {
          err(`send-track: server-side transport ${transportId} not found`);
          callback({ error: `server-side transport ${transportId} not found` });
          return;
        }

        let producer = await transport.produce({
          kind,
          rtpParameters,
          paused,
          appData: { ...appData, peerId, transportId }
        });

        // if our associated transport closes, close ourself, too
        producer.on('transportclose', () => {
          log('producer\'s transport closed', producer.id);
          closeProducer(producer);
        });

        // monitor audio level of this producer. we call addProducer() here,
        // but we don't ever need to call removeProducer() because the core
        // AudioLevelObserver code automatically removes closed producers
        if (producer.kind === 'audio') {
          audioLevelObserver.addProducer({ producerId: producer.id });
        }

        roomState.producers.push(producer);
        roomState.peers[peerId].media[appData.mediaTag] = {
          paused,
          encodings: rtpParameters.encodings
        };

        callback({ id: producer.id });
      } catch (e) {
      }
    });

    // --> /signaling/recv-track
    //
    // create a mediasoup consumer object, hook it up to a producer here
    // on the server side, and send back info needed to create a consumer
    // object on the client side. always start consumers paused. client
    // will request media to resume when the connection completes
    //
    socket.on('recv-track', async (data, callback) => {
      try {
        let peerId = socket.id;
        let { mediaPeerId, mediaTag, rtpCapabilities } = data;

        let producer = roomState.producers.find(
          (p) => p.appData.mediaTag === mediaTag &&
            p.appData.peerId === mediaPeerId
        );

        if (!producer) {
          let msg = 'server-side producer for ' +
            `${mediaPeerId}:${mediaTag} not found`;
          err('recv-track: ' + msg);
          callback({ error: msg });
          return;
        }

        if (!router.canConsume({
          producerId: producer.id,
          rtpCapabilities
        })) {
          let msg = `client cannot consume ${mediaPeerId}:${mediaTag}`;
          err(`recv-track: ${peerId} ${msg}`);
          callback({ error: msg });
          return;
        }

        let transport = Object.values(roomState.transports).find((t) =>
          t.appData.peerId === peerId && t.appData.clientDirection === 'recv'
        );

        if (!transport) {
          let msg = `server-side recv transport for ${peerId} not found`;
          err('recv-track: ' + msg);
          callback({ error: msg });
          return;
        }

        let consumer = await transport.consume({
          producerId: producer.id,
          rtpCapabilities,
          paused: true, // see note above about always starting paused
          appData: { peerId, mediaPeerId, mediaTag }
        });

        // need both 'transportclose' and 'producerclose' event handlers,
        // to make sure we close and clean up consumers in all
        // circumstances
        consumer.on('transportclose', () => {
          log(`consumer's transport closed`, consumer.id);
          closeConsumer(consumer);
        });
        consumer.on('producerclose', () => {
          log(`consumer's producer closed`, consumer.id);
          closeConsumer(consumer);
        });

        // stick this consumer in our list of consumers to keep track of,
        // and create a data structure to track the client-relevant state
        // of this consumer
        roomState.consumers.push(consumer);
        roomState.peers[peerId].consumerLayers[consumer.id] = {
          currentLayer: null,
          clientSelectedLayer: null
        };

        // update above data structure when layer changes.
        consumer.on('layerschange', (layers) => {
          log(`consumer layerschange ${mediaPeerId}->${peerId}`, mediaTag, layers);
          if (roomState.peers[peerId] &&
            roomState.peers[peerId].consumerLayers[consumer.id]) {
            roomState.peers[peerId].consumerLayers[consumer.id]
              .currentLayer = layers && layers.spatialLayer;
          }
        });

        callback({
          producerId: producer.id,
          id: consumer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
          producerPaused: consumer.producerPaused
        });
      } catch (e) {
        console.error('error in /signaling/recv-track', e);
        callback({ error: e });
      }
    });

    // --> /signaling/pause-consumer
    //
    // called to pause receiving a track for a specific client
    //
    socket.on('pause-consumer', async (data, callback) => {
      try {
        let peerId = socket.id;
        let { consumerId } = data,
          consumer = roomState.consumers.find((c) => c.id === consumerId);

        if (!consumer) {
          err(`pause-consumer: server-side consumer ${consumerId} not found`);
          callback({ error: `server-side producer ${consumerId} not found` });
          return;
        }

        log('pause-consumer', consumer.appData);

        await consumer.pause();

        callback({ paused: true });
      } catch (e) {
        console.error('error in /signaling/pause-consumer', e);
        callback({ error: e });
      }
    });

    // --> /signaling/resume-consumer
    //
    // called to resume receiving a track for a specific client
    //
    socket.on('resume-consumer', async (data, callback) => {
      try {
        let peerId = socket.id;
        let { consumerId } = data,
          consumer = roomState.consumers.find((c) => c.id === consumerId);

        if (!consumer) {
          err(`pause-consumer: server-side consumer ${consumerId} not found`);
          callback({ error: `server-side consumer ${consumerId} not found` });
          return;
        }

        log('resume-consumer', consumer.appData);

        await consumer.resume();

        callback({ resumed: true });
      } catch (e) {
        console.error('error in /signaling/resume-consumer', e);
        callback({ error: e });
      }
    });

    // --> /signalign/close-consumer
    //
    // called to stop receiving a track for a specific client. close and
    // clean up consumer object
    //
    socket.on('close-consumer', async (data, callback) => {
      try {
        let peerId = socket.id;
        let { consumerId } = data,
          consumer = roomState.consumers.find((c) => c.id === consumerId);

        if (!consumer) {
          err(`close-consumer: server-side consumer ${consumerId} not found`);
          callback({ error: `server-side consumer ${consumerId} not found` });
          return;
        }

        await closeConsumer(consumer);

        callback({ closed: true });
      } catch (e) {
        console.error('error in /signaling/close-consumer', e);
        callback({ error: e });
      }
    });

    // --> /signaling/consumer-set-layers
    //
    // called to set the largest spatial layer that a specific client
    // wants to receive
    //
    socket.on('consumer-set-layers', async (data, callback) => {
      try {
        let peerId = socket.id;
        let { consumerId, spatialLayer } = data,
          consumer = roomState.consumers.find((c) => c.id === consumerId);

        if (!consumer) {
          err(`consumer-set-layers: server-side consumer ${consumerId} not found`);
          callback({ error: `server-side consumer ${consumerId} not found` });
          return;
        }

        log('consumer-set-layers', spatialLayer, consumer.appData);

        await consumer.setPreferredLayers({ spatialLayer });

        callback({ layersSet: true });
      } catch (e) {
        console.error('error in /signaling/consumer-set-layers', e);
        callback({ error: e });
      }
    });

    // --> /signaling/pause-producer
    //
    // called to stop sending a track from a specific client
    //
    socket.on('pause-producer', async (data, callback) => {
      try {
        let peerId = socket.id;
        let { producerId } = data,
          producer = roomState.producers.find((p) => p.id === producerId);

        if (!producer) {
          err(`pause-producer: server-side producer ${producerId} not found`);
          callback({ error: `server-side producer ${producerId} not found` });
          return;
        }

        log('pause-producer', producer.appData);

        await producer.pause();

        roomState.peers[peerId].media[producer.appData.mediaTag].paused = true;

        callback({ paused: true });
      } catch (e) {
        console.error('error in /signaling/pause-producer', e);
        callback({ error: e });
      }
    });

    // --> /signaling/resume-producer
    //
    // called to resume sending a track from a specific client
    //
    socket.on('resume-producer', async (data, callback) => {
      try {
        let peerId = socket.id;
        let { producerId } = data,
          producer = roomState.producers.find((p) => p.id === producerId);

        if (!producer) {
          err(`resume-producer: server-side producer ${producerId} not found`);
          callback({ error: `server-side producer ${producerId} not found` });
          return;
        }

        log('resume-producer', producer.appData);

        await producer.resume();

        roomState.peers[peerId].media[producer.appData.mediaTag].paused = false;

        callback({ resumed: true });
      } catch (e) {
        console.error('error in /signaling/resume-producer', e);
        callback({ error: e });
      }
    });

    //*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//
    //*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//
  });
}





















//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

//
// start mediasoup with a single worker and router
//

async function startMediasoup() {
  let worker = await mediasoup.createWorker({
    logLevel: config.mediasoup.worker.logLevel,
    logTags: config.mediasoup.worker.logTags,
    rtcMinPort: config.mediasoup.worker.rtcMinPort,
    rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
  });

  worker.on('died', () => {
    console.error('mediasoup worker died (this should never happen)');
    process.exit(1);
  });

  const mediaCodecs = config.mediasoup.router.mediaCodecs;
  const router = await worker.createRouter({ mediaCodecs });

  // audioLevelObserver for signaling active speaker
  //
  const audioLevelObserver = await router.createAudioLevelObserver({
    interval: 800
  });
  audioLevelObserver.on('volumes', (volumes) => {
    const { producer, volume } = volumes[0];
    log('audio-level volumes event', producer.appData.peerId, volume);
    roomState.activeSpeaker.producerId = producer.id;
    roomState.activeSpeaker.volume = volume;
    roomState.activeSpeaker.peerId = producer.appData.peerId;
  });
  audioLevelObserver.on('silence', () => {
    log('audio-level silence event');
    roomState.activeSpeaker.producerId = null;
    roomState.activeSpeaker.volume = null;
    roomState.activeSpeaker.peerId = null;
  });

  return { worker, router, audioLevelObserver };
}

function closePeer(peerId) {
  log('closing peer', peerId);
  for (let [id, transport] of Object.entries(roomState.transports)) {
    if (transport.appData.peerId === peerId) {
      closeTransport(transport);
    }
  }
  delete roomState.peers[peerId];
}

async function closeTransport(transport) {
  try {
    log('closing transport', transport.id, transport.appData);

    // our producer and consumer event handlers will take care of
    // calling closeProducer() and closeConsumer() on all the producers
    // and consumers associated with this transport
    await transport.close();

    // so all we need to do, after we call transport.close(), is update
    // our roomState data structure
    delete roomState.transports[transport.id];
  } catch (e) {
    err(e);
  }
}

async function closeProducer(producer) {
  log('closing producer', producer.id, producer.appData);
  try {
    await producer.close();

    // remove this producer from our roomState.producers list
    roomState.producers = roomState.producers
      .filter((p) => p.id !== producer.id);

    // remove this track's info from our roomState...mediaTag bookkeeping
    if (roomState.peers[producer.appData.peerId]) {
      delete (roomState.peers[producer.appData.peerId]
        .media[producer.appData.mediaTag]);
    }
  } catch (e) {
    err(e);
  }
}

async function closeConsumer(consumer) {
  log('closing consumer', consumer.id, consumer.appData);
  await consumer.close();

  // remove this consumer from our roomState.consumers list
  roomState.consumers = roomState.consumers.filter((c) => c.id !== consumer.id);

  // remove layer info from from our roomState...consumerLayers bookkeeping
  if (roomState.peers[consumer.appData.peerId]) {
    delete roomState.peers[consumer.appData.peerId].consumerLayers[consumer.id];
  }
}




async function createWebRtcTransport({ peerId, direction }) {
  const {
    listenIps,
    initialAvailableOutgoingBitrate
  } = config.mediasoup.webRtcTransport;

  const transport = await router.createWebRtcTransport({
    listenIps: listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: initialAvailableOutgoingBitrate,
    appData: { peerId, clientDirection: direction }
  });

  return transport;
}

//
// stats
//

async function updatePeerStats() {
  for (let producer of roomState.producers) {
    if (producer.kind !== 'video') {
      continue;
    }
    try {
      let stats = await producer.getStats(),
        peerId = producer.appData.peerId;
      roomState.peers[peerId].stats[producer.id] = stats.map((s) => ({
        bitrate: s.bitrate,
        fractionLost: s.fractionLost,
        jitter: s.jitter,
        score: s.score,
        rid: s.rid
      }));
    } catch (e) {
      warn('error while updating producer stats', e);
    }
  }

  for (let consumer of roomState.consumers) {
    try {
      let stats = (await consumer.getStats())
        .find((s) => s.type === 'outbound-rtp'),
        peerId = consumer.appData.peerId;
      if (!stats || !roomState.peers[peerId]) {
        continue;
      }
      roomState.peers[peerId].stats[consumer.id] = {
        bitrate: stats.bitrate,
        fractionLost: stats.fractionLost,
        score: stats.score
      }
    } catch (e) {
      warn('error while updating consumer stats', e);
    }
  }
}
