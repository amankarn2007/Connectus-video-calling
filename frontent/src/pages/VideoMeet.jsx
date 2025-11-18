import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import TextField from '@mui/material/TextField';
import Button from "@mui/material/Button";
import { color, fontSize, height, style } from "@mui/system";
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
//import styles from "../styles/testingUI.module.css";

const server_url = "http://localhost:8080";

var connections = {};
const peerConfigConnections = {
    "iceServers": [
        {"urls": "stun:stun.l.google.com:19302"}
    ]
}

export default function VideoMeetComponent(){

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoRef = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState([]);
    let [audio, setAudio] = useState();

    let [screen, setScreen] = useState();
    let [showModel, setModel] = useState(false);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(3);

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState("");

    const videoRef = useRef([]);

    let [videos, setVideos] = useState([]);


    let routeTo = useNavigate();


    const getPermisions = async() => {
        try{

            // Video
            const videoPermision = await navigator.mediaDevices.getUserMedia({ video: true});
            if(videoPermision){
                setVideoAvailable(true);
                console.log("Video permission granted");
            } else{
                setVideoAvailable(true);
                console.log("Video permission denied")
            }

            //Audio
            const audioPermision = await navigator.mediaDevices.getUserMedia({
                audio: true
            });
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

            if(videoAvailable || audioAvailable){
                const userMediaStream = await navigator.mediaDevices.getUserMedia({video: videoAvailable, audio: audioAvailable});

                if(userMediaStream){
                    window.localStream = userMediaStream;
                    if(localVideoRef.current){
                        localVideoRef.current.srcObject = userMediaStream;
                    }
                }
            }

        } catch(err){
            console.log(err);
        }
    }

    useEffect(() => {
        getPermisions();
        return() => {
            if(localVideoRef.current?.srcObject){
                localVideoRef.current.srcObject.getTracks().forEach(track => track.stop())
                localVideoRef.current.srcObject = null;
            }
            setVideos([]);
            if(socketRef.current) socketRef.current.disconnect();
        }
    }, []);

    let getUserMediaSuccess = (stream) => {
        try{
            window.localStream.getTracks().forEach(track => track.stop())

        } catch(e){
            console.log(e);
        }

        window.localStream = stream;
        localVideoRef.current.srcObject = stream;

        for(let id in connections){
            if(socketIdRef.current === id) continue;

            connections[id].addStream(window.localStream)

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

        stream.getTracks()
        .forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try{

                let tracks = localVideoRef.current.srcObject.getTracks()
                tracks.forEach(track => track.stop() )

            } catch(e){
                console.log(e);
            }

            let blackSilence = (...args) => new MediaStream(
                [black(...args), silence()]
            )

            window.localStream = blackSilence();
            localVideoRef.current.srcObject = window.localStream;


            for(let id in connections){
                connections[id].addStream(window.localStream)
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

    let silence = () => {
        let ctx = new AudioContext()
        let oscillater = ctx.createOscillator();
        let dst =oscillater.connect(ctx.createMediaStreamDestination());

        oscillater.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], {enabled: false});
    }

    let black = ({width = 640, height = 480} = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), {width, height});

        canvas.getContext('2d').fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], {enabled: false});
    }

    let getUserMedia = () => {
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

    useEffect(() => {
        if(video != undefined && audio != undefined){
            getUserMedia();
        }
    }, [audio, video])


    const pendingCandidates = {}; // store ICE candidates temporarily

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if(fromId !== socketIdRef.current){
            if(signal.sdp){
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(() => {  // new code  👍
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
                const candidate = new RTCIceCandidate(signal.ice);

                if (!connections[fromId].remoteDescription || !connections[fromId].remoteDescription.type) {
                    if (!pendingCandidates[fromId]) pendingCandidates[fromId] = [];
                    pendingCandidates[fromId].push(candidate);
                } else {
                    connections[fromId].addIceCandidate(candidate).catch(console.error);
                }
            }

        }
    }

    let addMessage = (data, sender, socketIdSender) => {

        setMessages((prevMessasges) => [
            ...prevMessasges,
            {sender: sender, data: data},
        ]);

        if(socketIdSender !== socketIdRef.current){
            setNewMessages((prevMessasges) => prevMessasges + 1)
        }

    }

    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false })


        socketRef.current.on("connect", () => {

            socketIdRef.current = socketRef.current.id;
            console.log("✅ Connected with ID:", socketIdRef.current);

            socketRef.current.emit("join-call", window.location.href);

            socketRef.current.on("chat-message", addMessage);

            socketRef.current.on("user-left", (id) => {
                console.log("FRONTENT: user left", id);

                setVideos((videos) => { // Remove from react state
                    const updated = videos.filter((video) => video.socketId !== id)
                    videoRef.current = updated;
                    return [...updated];
                })
            })

            socketRef.current.on("signal", gotMessageFromServer);

            // Handle new user
            socketRef.current.on("user-joined", (id, clients) => {
                console.log("👥 user-joined:", id, " clients:", clients);
                
                clients.forEach((socketListId) => {

                    if (socketListId === socketRef.current.id) return;
                    if (connections[socketListId]) return; // Skip already existing connections

                    const pc = new RTCPeerConnection(peerConfigConnections);
                    connections[socketListId] = pc;

                    pc.onicecandidate = (event) => {
                        if(event.candidate != null){
                            socketRef.current.emit(
                                "signal",
                                socketListId,
                                JSON.stringify({'ice': event.candidate})
                            )
                        }
                    }

                    // onaddstream hata ke ontrack(modern)
                    pc.ontrack = (event) => {

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

                    if (window.localStream && window.localStream.getTracks) {
                        window.localStream.getTracks().forEach((track) => {
                            pc.addTrack(track, window.localStream);
                        });
                    } else {
                        
                        let blackSilence = (...args) => new MediaStream(
                            [black(...args), silence()]
                        )

                        window.localStream = blackSilence(); //

                        window.localStream.getTracks().forEach((track) => {
                            pc.addTrack(track, window.localStream);
                        });
                    }

                    const shouldCreateOffer = socketRef.current.id < socketListId;

                    if(shouldCreateOffer){
                        pc.createOffer()
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


    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);

        connectToSocketServer();
    }

    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }

    let handleVideo = () => {
        setVideo(!video);
    }

    let handleAudio = () => {
        setAudio(!audio);
    }

    let getDisplayMediaSuccess = (stream) => {
        try{
            window.localStream.getTracks().forEach((track) => track.stop())

        } catch(error){
            console.log(error);
        }

        window.localStream = stream;
        localVideoRef.current.srcObject = stream;

        for(let id in connections){
            if(id===socketRef.current) continue;

            connections[id].addStream(window.localStream);

            connections[id].createOffer()
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

        stream.getTracks()
        .forEach(track => track.onended = () => {
            setScreen(false);
            console.log("Screen sharing stopped");

            try{
                let tracks = localVideoRef.current.srcObject.getTracks()
                tracks.forEach(track => track.stop() )

            } catch(e){
                console.log(e);
            }

            let blackSilence = (...args) => new MediaStream(
                [black(...args), silence()]
            )

            window.localStream = blackSilence();
            localVideoRef.current.srcObject = window.localStream;

            getUserMedia();

        })

    }

    let getDisplayMedia = () => {
        if(screen){
            if(navigator.mediaDevices.getDisplayMedia){
                navigator.mediaDevices.getDisplayMedia({video: true, audio: true})
                .then(getDisplayMediaSuccess)
                .then((stream) => {})
                .catch((e) => console.log(e));
            }
        }
    }

    useEffect(() => {
        if(screen!==undefined){
            getDisplayMedia();
        }
    }, [screen])

    let handleScreen = () => { // screen sharing handle
        const newScreen = !screen;
        setScreen(newScreen);

        if(!newScreen){
            getUserMedia();
        }
    }

    let sendMessage = () => {
        socketRef.current.emit("chat-message", message, username);
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
                
                <div className={styles.meetVideoContainer}>

                    { showModel ? // Chat Message
                    <div className={styles.chatRoom}>

                        <div className={styles.chatContainer}>
                            <h1>Chat</h1>

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

                        {/*Local Video*/}
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

                    <div className={styles.conferenceView + " " +
                        (videos.length === 1 ? styles.oneVideo :
                        videos.length === 2 ? styles.twoVideo :
                        videos.length === 3 ? styles.threeVideo :
                        videos.length === 4 ? styles.fourVideo : "")
                    }>

                        {videos.map((video) => (
                            <div key={video.socketId} className={styles.remoteVideoBox}>
                                <video
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