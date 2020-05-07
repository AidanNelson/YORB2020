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
    "project_name": "E-cycle: The Making and Discarding of Electronics",
    "elevator_pitch": "A mobile interactive exhibit about the life cycle of electronics seen through the lens of labor, materials and waste. E-Cycle: the Making &amp;amp; Discarding of Electronics visualizes the complex flow of electronic materials in order to reveal the efforts and conflicts involved in the manufacturing and disposing of digital devices.",
    "description": "Electronics require an inordinate amount of material and labor to manufacture. From the mining sites to the clean room, there are thousands of hands, chemicals, and minerals that make a technological product possible. In the process of creating high technology there are significant amounts of waste generated that give rise to health and environmental issues. Waste and wasting happens throughout the manufacturing and supply chain, not just at the point of disposal. In addition, the infrastructure for discarding an electronic item consists of a multitude of processes and machinery. Few of our current disposal methods, including recycling, are optimal &amp;ndash; our options take for granted the high labor, environmental, energy and health impacts required to create the technological products we&amp;#039;ve come to rely on. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe purpose of this project is not to condemn high technology, but rather to show the complicated movement of electronic materials and to empower others to imagine alternatives to this current cycle. &amp;lt;br /&amp;gt;",
    "zoom_link": ""
  },
  {
    "project_id": "8558",
    "project_name": "You are not the only particle in universe",
    "elevator_pitch": "The project explores the use of interactive light as a storytelling device, light as an interactive prop in performance, and interaction between music and light. &amp;lt;br /&amp;gt;",
    "description": "You are not the only particle in universe is a performance that tells a story about finding paths and connections in the world. Through a fictional world made with home lamps, performers will use lamps as instruments to play music and tell stories. The project explores the use of interactive light as a storytelling device, light as an interactive prop in performance, and interaction between music and light.",
    "zoom_link": ""
  },
  {
    "project_id": "8577",
    "project_name": "Depth2Web",
    "elevator_pitch": "Depth2Web is a desktop platform that allows depth feeds to be used in the web space.",
    "description": "Depth2Web is a device agnostic desktop application that sends depth feed to the web. It can be used to stream raw depth feed or analyzed data of the feed; constrained only by threshold and joints detected. The platform currently supports various versions of Intel RealSense and versions of Microsoft Kinect sensors and the platform standardizes data from the different depth cameras. All standardized feed from depth cameras are sent via peer network as stream objects. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe application aims to encourage more people to make web applications for users to interact beyond the mouse and keyboard. Depth2Web provides an opportunity for artists, creators and programmers to use depth and body motion as modes of web interaction by making the use of depth cameras more approachable and by  supporting a large range of devices that can be  used interchangeably.",
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
    "description": "&amp;ldquo;First we eat, then we do everything else.&amp;rdquo; This famous quote by MFK Fisher shows how much people love food. There is even a category called food porn now. However, too much of anything is bad for you. Today there is not only an excessive amount and choices of food, but information as well. How much is too much? We know foods that are too fatty, sweet or salty are bad for you, but what is the cutline? We look at the nutrition facts on the back but how much is 21% fat? Or six grams of sugar? Is six grams too much or too less?&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nTo catch two birds with one stone, I wanted to create an infographic animation that would not only inform users about why we crave sweet and salty foods, but also entertain and raise awareness about how we should be more mindful of what we eat. &amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nFirst, what is an infographic?  According to the Oxford English Dictionary, means a visual representation of information or data. However, there is a more specific definition. A more apt description would be that it is a collection of imagery, charts, and minimal text that gives an easy-to-understand overview of a topic. Today where huge volumes of new information are constantly being created and our consistent exposure to them, infographics play a huge role in compacting all that data and keeping them simple.",
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
    "project_name": "Crazy Little Beliefs: The Cautious, the Visionery, the Rooted",
    "elevator_pitch": "This is a series of objects inspired by the whimsical common beliefs and the people that believe in them. Through interaction, it aims to remind us of a collective past experience in present technology.",
    "description": "When was the last time you wished on a fallen eyelash, or read a horoscope fortune, or said bless you to someone who sneezed. Beliefs are widely known to be irrational, not based on reason or knowledge. People find ways to prove the unexplainable things. As they say, we humans are so afraid of the unknown that we gave everything a name. But remember the times when we still believed in tooth fairy and get excited to make wishes when we see shooting stars? In fact, studies show that magical thinking decreases as we age. &amp;lt;br /&amp;gt;\r\nCrazy Little Belief aims to recreate the whimsical aspect of our beliefs in a world of automation, machine-operated, and algorithmic optimized. When nothing is permanent, how could we achieve the self-identity process? The purpose of this project is not to critique nor dismiss these irrational behaviors, rather to encourage them and remind us of how we used to believe in unexplained things. To understand that it is innate to be scared of the unknown.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8583",
    "project_name": "God Design",
    "elevator_pitch": "Designing new gods in a contemporary context",
    "description": "Human beings create gods or gods create human beings, that is a romantic question. Growing up in a society where I could expose to both polytheism and monotheism, I was thinking, while new gadgets and tools were created to enhance people&amp;rsquo;s lives, gods were not being updated for a long time. To explore the possibility of creating new gods who address problems and issues in human life in a contemporary context, I use the term of &amp;ldquo;god design&amp;rdquo; which means utilizing design thinking in creating new gods, everything in this project starts with the concept of &amp;ldquo;god design&amp;rdquo;. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThe basic layer of god design is to &amp;ldquo;design&amp;rdquo; new gods that work in a modern way, they use familiar objects that we usually see in our everyday life to impose their power just like the traditional gods use their weapons, while the way they use the object is not how it is normally used. To showcase the gods and communicate with the audience, a booth-like interactive installation is implemented as a god search engine, where the audience input their daily concern and being returned with a certain god that relates to their input concern. The installation took the concept of small &amp;ldquo;pop-up&amp;rdquo; shrines in Japan and India, finished in a more hi-tech product aesthetic. A website with a similar function and aesthetic was also developed. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThis project is not aiming at creating a new religion, it is more like look at our lives from another angle, especially the small problems in our everyday life, in a more absurd yet delightful way, but still, with its whimsical nature, I hope it could bring positive attitudes and a delightful moment to the audience.",
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
    "description": "Cyber-bullying can cause real-life consequences, including physical and psychological damage. For instance, social media shaming concerns me a lot as they happen frequently, may be accompanied by vulgar comments, and anyone can be part of it unconsciously. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nOver-shaming behaviors haven&amp;rsquo;t raised enough public attention. Since studies and researches have been largely focusing on the intervention side (e.g. filtering algorithm), I want to tackle this purely digital, social behavior problem in a physical, attractive way. Thus, instead of raising a practical UX solution, I come up with The Everyone Knows Machine, an interactive, performative art installation that stamps a player&amp;rsquo;s random Twitter post on the inner side of the player&amp;rsquo;s arm temporarily. &amp;lt;br /&amp;gt;\r\nThis project is trying to evoke empathy by giving the audience a similar experience as the subjects, those who are judged or critiqued because of unilateral sides of their online behaviors. In other words, I want to replicate the feeling of being &amp;ldquo;mislabeled&amp;rdquo;. It is not meant to solve cyber-bullying problems. Instead, it aims to raise awareness of unjustified online-shaming. &amp;lt;br /&amp;gt;\r\nThe experience emphasizes the reflection moment when the participant starts to worry that they might have posted something bad to be stamped on a visible part of their body. It is questioning, &amp;ldquo;Are you comfortable enough with EVERY POST you make that you&amp;rsquo;d wear them on your skin under any circumstances?&amp;rdquo; The assumption is that most people may hesitate to answer &amp;ldquo;yes&amp;rdquo; because anyone may have posted inappropriate words, or the words could be misinterpreted due to the lack of contexts. &amp;lt;br /&amp;gt;\r\nAdditionally, this project challenges the lack of accountability and responsibility for online commenting. By making posts as stamps on visible body parts, it creates strong accountability and even identity which links online behaviors with real-life social relationships.",
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
    "zoom_link": "https://"
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
    "description": "Birds are everywhere in our cities. We eat chicken as food, keeping parrots as pets, and we see sparrows flying across the streets. Between all the living beings, birds are such a unique group of which that&amp;#039;s so close to urban humans as three distinct roles: food, pets, and neighbors.  &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nThough humans&amp;#039; needs for birds as products might never be gone, I hope one day all birds could just be flapping their wings as they&amp;#039;re born to do. To achieve this wild goal, this interactive website - Chicken, Parrot, and Sparrow - is created to intrigue audiences to review and rethink why and how some birds are objectified as products, compared to the ones living as our neighbors, despite the fact that all of them are all birds born with wings. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nDesigned to target graphic design lovers, the backbone of this interactive website is a series of hand-coded typography animations consisting of the typeface Helvetica to visualize the processes of objectifying birds. In addition to the animations, the interactions and information on the website are designed and curated for audiences to keep thinking about our relationships with the birds after experiencing the website.&amp;lt;br /&amp;gt;",
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
    "description": "A look at looking (through not looking) is an artistic research project that consists of three experiments that defamiliarize users&amp;rsquo; predominant way of perceiving familiar contexts with other animals&amp;rsquo; perceptual mechanisms.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nEpisode I. How does a dog understand a map? &amp;lt;br /&amp;gt;\r\n&amp;ldquo;The map is not territory&amp;rdquo; --- Alfred Korzybski&amp;lt;br /&amp;gt;\r\nA physical map of the ITP floor made from smells. Users sniff around the map to feel the spatial relation. &amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nEpisode II. How does a digital interface feel to a mole?&amp;lt;br /&amp;gt;\r\n&amp;ldquo;Perceptions are a user interface, but not necessarily reality.&amp;rdquo; --- Donald Hoffman&amp;lt;br /&amp;gt;\r\nAn AR application in which users are invited to experience the haptic texture of a digitally rendered blanket from artist&amp;rsquo; childhood.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nEpisode III. What does /Apple Logo.jpg/ mean to a bat?&amp;lt;br /&amp;gt;\r\n&amp;ldquo;The Spectacle is not a collection of images, but a social relation among people, mediated by images.&amp;rdquo; --- Guy Debord&amp;lt;br /&amp;gt;\r\nA VR experience in which users are embodied as a bat wandering in Time Square, trying to understand humans through echolocating.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
  },
  {
    "project_id": "8597",
    "project_name": "EmoCaptcha: Uncovering the Black Box of Emotions",
    "elevator_pitch": "A collection of speculative projects using affect recognition technology that provoke critical considerations on complex black box systems and their capacity for misuse and discrimination.",
    "description": "The origins of this thesis project started from the concept of black boxes&amp;mdash;a system in which the inputs and outputs can be observed, but the inner workings of the system are concealed&amp;mdash;and the shortcomings and discriminatory consequences that can occur when these complex systems are deployed without critical consideration or analysis. EmoCaptcha uses &amp;quot;affect recognition technology&amp;quot; as its black box to invoke critical reflections on black box systems for audiences with casual digital practices and basic understanding of AI and automated decisions systems.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nAffect recognition technology uses a machine learning model trained off of categorized headshots to determine human emotion based off of facial expressions. The problem with relying on affect predictions made by this technology is that studies have shown facial expressions to be an unreliable indicator of emotional state. Categorical universal emotions have been questioned too. Yet businesses and governments have started to integrate emotion detection technologies as black box entities into complex systems that range from determining the employability of a candidate to likelihood of someone being a terrorist.&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;\r\nEmoCaptcha aims to capture the potentially escalating consequences of affect recognition technologies and other black box systems through a series of digital projects in which the determined emotional user state impacts their experience and ending outcome.",
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
    "description": "We live in a crucial moment when the role of stories and how they connect us has taken on an urge and importance. Humans are storytelling animals and story is what helps us to understand the world that we experience around us. Technologies shape how the stories are being delivered and consumed. As these technologies have matured and the art of storytelling has evolved, our ambitions have grown. The underlying question is  &amp;ndash; &amp;ldquo;how do we use these technologies and skills to tell stories that will bring a positive and lasting impact.&amp;rdquo; One of the answers I found in my art practice is magic. Don&amp;rsquo;t think about it as a trickery or a puzzle. It is bigger than that, magic is a philosophy, a narrative and a story, it is understanding how the mind works. Magician has a creative and non traditional mindset, it is a &amp;ldquo;toolbox&amp;rdquo; that can be applied to any art practice.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n Series of projects are done using augmented, virtual and mixed reality mediums as well as voice controlled interfaces with the purpose of crafting magical experiences and entertaining performances. I take on unconventional missions. Missions to inspire wonder and embrace human connection. Missions to build experiences that transport and thrill. Missions that bring people together and evoke emotions of wonder in the audience. I am investigating the relationship between technology, magic and illusions, the role of a magician at a time when technology is making &amp;ldquo;anything&amp;rdquo; possible and we almost lose our sense of wonder. My work is an applied exploration of audiovisual deception and misdirection in digital, aka technomagical experiences.",
    "zoom_link": "https://"
  },
  {
    "project_id": "8602",
    "project_name": "Commas.space",
    "elevator_pitch": "Commas dot space is a web art experiment in ephemeral text",
    "description": "Commas.space is a web app focused on ephemeral text.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nParticipants type messages onto a looping display, one character at a time. The messages scroll and loop over a 12 second interval. Each time a message is shown to another participant, it fades away a bit. Messages eventually fade to nothing, making way for new messages.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nCommas.space grew out of research into the differences between orality vs. text and the history of technologically mediated conversation.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nText has been used for record keeping from its beginning. Its ability to store and transfer information was transformational. As communications technologies have advanced, we&amp;rsquo;ve kept the assumption to record text. For example, chat and email typically take the form of a series of timestamped records, a log.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nCommas.space is a conversational text without permanent records. The messages temporarily exist in the volatile memory of the server and the participants.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nInformation can only persist through the act of retelling. It is up to the participants whether to to respond and navigate other messages to build a shared construction or create a cacophony.&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\n&amp;lt;br /&amp;gt;&amp;lt;br /&amp;gt;\r\nThe looper acts as a retelling mechanism and buffers the communication of messages across windows of time. Participants can leave messages for future participants or weave message threads with themselves.&amp;lt;br /&amp;gt;",
    "zoom_link": "https://"
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
      console.log(projects);
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
