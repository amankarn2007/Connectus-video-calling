import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client"; // main imports
import TextField from '@mui/material/TextField';
import Button from "@mui/material/Button";
import styles from "../styles/VideoMeet.module.css";
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { IconButton } from '@mui/material';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import Badge from '@mui/material/Badge';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import { useNavigate } from "react-router-dom";
import server from "../environment";
//import styles from "../styles/testingUI.module.css";

const server_url = server;

var connections = {}; // store every room and their connected socketId
const peerConfigConnections = { // make p2p connections between public IP's. it connect through p2p link
    "iceServers": [
        {"urls": "stun:stun.l.google.com:19302"}
    ]
}

export default function VideoMeetComponent(){

    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoRef = useRef();
    const videoRef = useRef([]);

    let [videoAvailable, setVideoAvailable] = useState(true); //camera ON/OFF
    let [audioAvailable, setAudioAvailable] = useState(true); //mic ON/OFF

    let [video, setVideo] = useState([]); //remote video streams
    let [audio, setAudio] = useState(); //local microphone stream

    let [screen, setScreen] = useState(); //screen share stream
    let [screenAvailable, setScreenAvailable] = useState(); //screen sharing active ?

    let [showModel, setModel] = useState(false); //Kuch popup/modal show karna (e.g username input)

    let [messages, setMessages] = useState([]); //all chat messages
    let [message, setMessage] = useState(""); //current input message
    let [newMessages, setNewMessages] = useState(0); // unread message count

    let [askForUsername, setAskForUsername] = useState(true); //show username input ?
    let [username, setUsername] = useState(""); //current username

    let [videos, setVideos] = useState([]); //remote videos elms/streams


    let routeTo = useNavigate();

    //(1). Pre-fetching media access
    const getPermisions = async() => {
        try{
            // Video
            const videoPermision = await navigator.mediaDevices.getUserMedia({ video: true});
            if(videoPermision){
                setVideoAvailable(true);
                console.log("Video permission granted");
            } else{
                setVideoAvailable(false);
                console.log("Video permission denied")
            }

            //Audio
            const audioPermision = await navigator.mediaDevices.getUserMedia({ audio: true });
            if(audioPermision){
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else{
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            // Screen sharing
            const ScreenSharing = await navigator.mediaDevices.getDisplayMedia;
            if(ScreenSharing){
                setScreenAvailable(true)
            }
            else{
                setScreenAvailable(false);
            }

            if(videoAvailable || audioAvailable){ //safe check of video || audio avalibilty
                // store in userMediaStream
                const userMediaStream = await navigator.mediaDevices.getUserMedia({video: videoAvailable, audio: audioAvailable});

                if(userMediaStream){
                    window.localStream = userMediaStream; // store globally to access in WebRTC peer connection
                    if(localVideoRef.current){
                        localVideoRef.current.srcObject = userMediaStream; // show live video to users
                    }
                }
            }

        } catch(err){
            console.log(err);
        }
    }

    //(2). Stops using the resources when the component leaves the screen
    useEffect(() => { // run just after clicking connect
        getPermisions();
        return() => {
            if(localVideoRef.current?.srcObject){
                localVideoRef.current.srcObject.getTracks().forEach(track => track.stop()); // memory cleanup
                localVideoRef.current.srcObject = null; //video elm clear
            }
            setVideos([]);
            if(socketRef.current) socketRef.current.disconnect(); // remote video state reset
        }
    }, []);

    let silence = () => { // this is called in blackSilence,for getUserMedia Succ. (This func give muted mic)
        let ctx = new AudioContext()
        let oscillater = ctx.createOscillator();
        let dst =oscillater.connect(ctx.createMediaStreamDestination());

        oscillater.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], {enabled: false});
    }

    //(this funcn will give black screen, to blackSilence for getUserMediaSuccess)
    let black = ({width = 640, height = 480} = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), {width, height});

        canvas.getContext('2d').fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], {enabled: false});
    }

    let getUserMediaSuccess = (stream) => { //this is called by getUserMedia();
        try{ // getTracks() = MediaStream ke sabhi track  //tracks[videoTrack, audioTrack]
            window.localStream.getTracks().forEach(track => track.stop()); // stop track(call end/cleanup/privacy)
        } catch(e){
            console.log(e);
        }

        window.localStream = stream; //for globally access
        localVideoRef.current.srcObject = stream; // for live preview

        for(let id in connections){
            if(socketIdRef.current === id) continue; // skip own socket.id(bcs apne-aap se connection nahi banana hai)

            window.localStream.getTracks() //WebRTC me apna mediaStream attach
            .forEach(track => {
                connections[id].addTrack(track, window.localStream);
            })

            //connections[id].addStream(window.localStream); // second method

            connections[id].createOffer().then((description) => { //peer ko batana(which media we send)
                connections[id].setLocalDescription(description)
                .then(() => {
                    socketRef.current.emit("signal", id, JSON.stringify({ //To send 'offer' to peer
                        "sdp": connections[id].localDescription,
                    }));
                })
                .catch(e => console.log(e));
            })
        }

        stream.getTracks()
        .forEach(track => track.onended = () => { //when video or audioTrack end's, this callback will run
            setVideo(false);
            setAudio(false);

            try{
                let tracks = localVideoRef.current.srcObject.getTracks()
                tracks.forEach(track => track.stop()); //camera/mic hardware release

            } catch(e){
                console.log(e);
            }

            let blackSilence = (...args) => new MediaStream( // fake video and audio to stable stream
                [black(...args), silence()] //this is using silence() and black()
            )

            window.localStream = blackSilence(); //now localStream becomes black
            localVideoRef.current.srcObject = window.localStream;

            for(let id in connections){ //Re-offer to streams
                connections[id].addStream(window.localStream);

                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit("signal", id, JSON.stringify({
                            "sdp": connections[id].localDescription
                        }))
                    })
                    .catch(e => console.log(e));
                })
            }
        })
    }

    let getUserMedia = () => { //based on camera/mic on/off it's update the stream
        if((video && videoAvailable) || (audio && audioAvailable)){
            navigator.mediaDevices.getUserMedia({video: video, audio: audio})
            .then(getUserMediaSuccess)
            .then((stream) => {})
            .catch((e) => console.log(e));
        } else {
            try{
                let tracks = localVideoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop())

            } catch(err) {
                console.log(err);
            }
        }
    }

    useEffect(() => { //Runs when audio and video change
        if(video != undefined && audio != undefined){
            getUserMedia(); //when user setting changed, we want new mediaStream
        }
    }, [audio, video])


    const pendingCandidates = {}; // store ICE candidates temporarily

    //called by socket.io to add connection btw two users
    let gotMessageFromServer = (fromId, message) => { //when we get message from WebRTC
        var signal = JSON.parse(message)

        if(fromId !== socketIdRef.current){ //ignore message from yourself
            if(signal.sdp){ //if msg containes sdp
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(() => { //adding other user's offer/answer in our RTCPeerConec
                    if (pendingCandidates[fromId]) {
                        pendingCandidates[fromId].forEach((candidate) => {
                            connections[fromId].addIceCandidate(candidate).catch(console.error);
                        });
                        delete pendingCandidates[fromId];
                    }
                    // If this is an offer, create & send an answer
                    if (signal.sdp.type === "offer") {
                        connections[fromId].createAnswer()
                            .then(description => connections[fromId].setLocalDescription(description))
                            .then(() => {
                                socketRef.current.emit(
                                    "signal",
                                    fromId,
                                    JSON.stringify({ "sdp": connections[fromId].localDescription })
                                );
                            })
                            .catch(console.error);
                    }
                })
            }
            else if (signal.ice) {
                const candidate = new RTCIceCandidate(signal.ice); //new Candidate created

                //if remoteDescription is not set, we can't add Candidate
                if (!connections[fromId].remoteDescription || !connections[fromId].remoteDescription.type) {
                    if (!pendingCandidates[fromId]) pendingCandidates[fromId] = [];
                    pendingCandidates[fromId].push(candidate); //push candidate
                } else { //if already set, then add directly
                    connections[fromId].addIceCandidate(candidate).catch(console.error);
                }
            }

        }
    }

    let addMessage = (data, sender, socketIdSender) => { //called by socket.io

        setMessages((prevMessasges) => [ //appends sender and data to msg
            ...prevMessasges,
            {sender: sender, data: data},
        ]);

        if(socketIdSender !== socketIdRef.current){ // if msg is from someone else, increase newMessage
            setNewMessages((prevMessasges) => prevMessasges + 1)
        }
    }

    //(5). join room, send offers/answer, send/receive ICE, displays videos
    let connectToSocketServer = () => { //connect with the backend
        socketRef.current = io.connect(server_url, { secure: false }); //connect to signalling server

        socketRef.current.on("connect", () => { //when socket is connected

            socketIdRef.current = socketRef.current.id; //save unique socket.id
            console.log("✅ Connected with ID:", socketIdRef.current);

            //window.location.href = URL as room id
            socketRef.current.emit("join-call", window.location.href); //tell server, joined the room,

            socketRef.current.on("chat-message", addMessage); // for chat system, call addMessage()

            socketRef.current.on("user-left", (id) => { // user-left
                console.log("FRONTENT: user left", id);

                setVideos((videos) => { // Remove from react state
                    const updated = videos.filter((video) => video.socketId !== id)
                    videoRef.current = updated;
                    return [...updated];
                })
            })

            socketRef.current.on("signal", gotMessageFromServer); // handle WebRTC signalling data

            // Handle new user
            socketRef.current.on("user-joined", (id, clients) => {
                console.log("👥 user-joined:", id, " clients:", clients);
                
                clients.forEach((socketListId) => { //for every client already in room, make connection

                    if (socketListId === socketRef.current.id) return; //skip self
                    if (connections[socketListId]) return; // Skip already existing connections

                    const pc = new RTCPeerConnection(peerConfigConnections); //create RTCP connection
                    connections[socketListId] = pc;

                    pc.onicecandidate = (event) => { //send ice candidate(IP, port) to peer
                        if(event.candidate != null){
                            socketRef.current.emit(
                                "signal",
                                socketListId,
                                JSON.stringify({'ice': event.candidate})
                            )
                        }
                    }

                    pc.ontrack = (event) => { //when remote user sends audio/video tracks

                        let videoExists = videoRef.current.find(video => 
                            video.socketId === socketListId
                        );

                        if(videoExists){
                            console.log("FOUND EXISTING");

                            // Update the stream of the existing video
                            setVideos(videos => {
                                const updatedVideos = videos.map(video => {
                                    return video.socketId === socketListId 
                                        ? {...video, stream: event.streams[0]} : video;
                                })

                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            })

                        } else {
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.streams[0],
                                autoPlay: true,
                                playsinline: true,
                            }
                            
                            setVideos(currVideo => {

                                const filteredVideos = currVideo.filter(video => {
                                    return video.socketId !== socketListId
                                });

                                const updatedVideos = [...filteredVideos, newVideo];
                                videoRef.current = updatedVideos;

                                return updatedVideos;
                            });
                        }
                    };

                    if (window.localStream && window.localStream.getTracks) { //add your own tracks
                        window.localStream.getTracks().forEach((track) => { //if have webcame, mic
                            pc.addTrack(track, window.localStream);
                        });
                    } else { //if (camera blocked/off) create fake track
                        let blackSilence = (...args) => new MediaStream(
                            [black(...args), silence()]
                        )

                        window.localStream = blackSilence();

                        window.localStream.getTracks().forEach((track) => {
                            pc.addTrack(track, window.localStream);
                        });
                    }

                    const shouldCreateOffer = socketRef.current.id < socketListId; //who creates offer, (Lower socket.id user)

                    if(shouldCreateOffer){
                        pc.createOffer() //create and send ofer
                            .then((description) => {
                                pc.setLocalDescription(description)
                            })
                            .then(() => {
                                socketRef.current.emit(
                                    "signal",
                                    socketListId,
                                    JSON.stringify({"sdp": pc.localDescription})
                                )
                            })
                            .catch((err) => {
                                console.log("Error in creatin offer" ,err)
                            })
                    }

                })
            })
        });
    }

    let getMedia = () => { //(4). fetch camera/mic permission
        setVideo(videoAvailable);
        setAudio(audioAvailable);

        connectToSocketServer();
    }

    let connect = () => { //(3). used in lobby
        if(!username.trim()){ // validation
            alert("please enter your username");
            return;
        }
        setAskForUsername(false); //hide the username screen
        getMedia(); //prepare camera/mic , join signalling server
    }

    let handleVideo = () => { //used in videoCamIcon
        setVideo(!video);
    }

    let handleAudio = () => { //used in mic on/off icon
        setAudio(!audio);
    }

    //this is called by getDisplayMedia to update old tracks
    let getDisplayMediaSuccess = (stream) => {
        try{
            window.localStream.getTracks().forEach((track) => track.stop()); //stop old tracks

        } catch(error){
            console.log(error);
        }

        window.localStream = stream; //now current media is screen stream
        localVideoRef.current.srcObject = stream; //update new stream

        for(let id in connections){ //send updated screen to evryone
            if(id===socketRef.current) continue; //skip 'self'

            connections[id].addStream(window.localStream);

            connections[id].createOffer() //becase media is changed
            .then((description) => [
                connections[id].setLocalDescription(description)
                .then(() => {
                    socketRef.current
                    .emit("signal",
                        id,
                        JSON.stringify({
                            "sdp": connections[id].localDescription
                        })
                    )
                })
                .catch(err => console.log(err))
            ])
        }

        stream.getTracks() //if screenSharing stopped
        .forEach(track => track.onended = () => {
            setScreen(false); //disable screen
            console.log("Screen sharing stopped");

            try{
                let tracks = localVideoRef.current.srcObject.getTracks() //stop tracks for lefted user
                tracks.forEach(track => track.stop() )

            } catch(e){
                console.log(e);
            }

            let blackSilence = (...args) => new MediaStream(  //set temp black & silent
                [black(...args), silence()]
            )

            window.localStream = blackSilence(); //update stream to blackSilence
            localVideoRef.current.srcObject = window.localStream;

            getUserMedia(); //req min and camera again

        })
    }

    let getDisplayMedia = () => { //this ask browser to capture screen
        if(screen){ //is screen sharing on
            if(navigator.mediaDevices.getDisplayMedia){ //if browser allow
                navigator.mediaDevices.getDisplayMedia({video: true, audio: true}) //request screen sharinng
                .then(getDisplayMediaSuccess) //handle screen
                .then((stream) => {})
                .catch((e) => console.log(e));
            }
        }
    }

    useEffect(() => { //this ensures, not start screenShare in initial render
        if(screen!==undefined){ //initial render
            getDisplayMedia();
        }
    }, [screen]); //when change in screen state(ex. handleScreen), this useState will run

    let handleScreen = () => { // screen sharing handle
        const newScreen = !screen;
        setScreen(newScreen);

        if(!newScreen){
            getUserMedia();
        }
    }

    let sendMessage = () => { //handle message send
        socketRef.current.emit("chat-message", message, username); //emits to socket.io server
        setMessage("");
    }

    let handleEndCall = () => { // handle end call button
        try{
            const tracks = localVideoRef.current?.srcObject?.getTracks();
            if(tracks){
                tracks.forEach(track => track.stop());
            }
            localVideoRef.current.srcObject = null;

        } catch(e){
            console.log(e);
        }

        setVideo([]);
        routeTo("/dashboard");
    }

    return(
        <div>
            {askForUsername === true ?
                //Lobby
                <div className={"fullPageContainer"}>
                    <h2 style={{textAlign: "center", marginTop: "1.5rem"}}>
                        Enter the Lobby
                    </h2>
                    <div className={styles.connect}>
                        <TextField
                            id="outlined-basic"
                            label="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            variant="outlined"
                        />
                        <Button variant="contained" onClick={connect}>Connect</Button>
                    </div>

                    <div className={styles.localVideo}>
                        <video ref={localVideoRef} autoPlay muted></video>
                    </div>
                    
                </div> : 
                
                //video calling full page
                <div className={styles.meetVideoContainer}>

                    { showModel ? // Chat Message in right side
                    <div className={styles.chatRoom}>

                        <div className={styles.chatContainer}>
                            <h1>Chat</h1>

                            {/* This will show evry messages in room */}
                            <div className={styles.chatingDisplay}>
                                {
                                    messages.length !== 0 ? messages.map((item, index) => {
                                        return(
                                            <div style={{marginBottom: "20px"}} key={index}>
                                                {/*user name*/}
                                                <p style={{fontWeight: "bold"}}>
                                                    {item.sender}
                                                </p>
                                                {/*user message*/}
                                                <p>
                                                    {item.data}
                                                </p>
                                            </div>
                                        )
                                    }) : <p>No Messages Yet</p>
                                }
                            </div>

                            {/* input and send button in chatBox */}
                            <div className={styles.chatingArea}>

                                <TextField id="outlined-basic" value={message} onChange={e => setMessage(e.target.value)} label="Message" variant="outlined" />

                                <Button variant="contained" endIcon={<SendIcon/>} onClick={sendMessage}>
                                    Send
                                </Button>

                            </div>
                        </div>


                    </div>
                    : <></> }
                    
                    {/*Bottom Div(localVideo & Icons)*/}
                    <div className={styles.buttonContainer}>

                        {/*Local Video in left bottom*/}
                        <div className={styles.localVideoBox}>
                            <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted></video>
                        </div>

                        {/*Icons*/}
                        <div className={styles.icons}>
                            <IconButton style={{color: "white"}} onClick={handleVideo}>
                                {(video===true) ? <VideocamIcon/> : <VideocamOffIcon/>}
                            </IconButton>
                            <IconButton style={{color: "red"}} onClick={handleEndCall}>
                                <CallEndIcon/>
                            </IconButton>
                            <IconButton style={{color: "white"}} onClick={handleAudio}>
                                {(audio===true) ? <MicIcon/> : <MicOffIcon/>}
                            </IconButton>
                            {screenAvailable===true ?
                            <IconButton style={{color:"white"}} onClick={handleScreen}>
                                {screen===true ? <ScreenShareIcon/>:<StopScreenShareIcon/>}
                            </IconButton> : <></>}
                            <Badge badgeContent={newMessages} max={999} color="secondary">
                                <IconButton style={{color: "white"}} onClick={() => setModel(!showModel)}>
                                    <ChatIcon/>
                                </IconButton>
                            </Badge>
                        </div>
                    </div>

                    {/* users video (synamic styling for best layout) */}
                    <div className={styles.conferenceView + " " +
                        (videos.length === 1 ? styles.oneVideo :
                        videos.length === 2 ? styles.twoVideo :
                        videos.length === 3 ? styles.threeVideo :
                        videos.length === 4 ? styles.fourVideo : "")
                    }>

                        {/* mapping each remote user's video */}
                        {videos.map((video) => (
                            <div key={video.socketId} className={styles.remoteVideoBox}>
                                <video //attach stream in <video> elem
                                    data-socket={video.socketId}
                                    ref={ref => {
                                        if(ref && video.stream){
                                            ref.srcObject = video.stream;
                                        }
                                    }}
                                    autoPlay
                                >
                                </video>
                            </div>
                        ))}

                    </div>

                </div>
            }

        </div>
    )
}