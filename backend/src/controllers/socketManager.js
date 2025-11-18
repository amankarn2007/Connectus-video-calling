const {Server}  = require("socket.io");

// These objects store data temporarily
let connections = {};
let messages = {};
let timeOnline = {};

module.exports.connectToSocket = (server) => {
    const io = new Server(server, { // Create a new Socket.IO server
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket) => { // Listen for a new user connecting

        console.log("SERVER: NEW socket connected:");

        socket.on("join-call", (path) => { // When a user joins a call

            if(connections[path] === undefined){ // If room doesn't exist, create
                connections[path] = [];
            }

            connections[path].push(socket.id)
            timeOnline[socket.id] = new Date();

            // Notify everyone that a new user joined
            for(let a = 0; a < connections[path].length; a++){
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path]);
            }

            if(messages[path] != undefined){ //previous messages in room, send to new user
                for(let a = 0; a < messages[path].length; ++a){
                    io.to(socket.id).emit("chat-message",
                        messages[path][a]['data'],
                        messages[path][a]['sender'],
                        messages[path][a]['socket-id-sender']
                    )
                }
            }
        });

        socket.on("signal", (toId, message) => { // Handle signaling data
            io.to(toId).emit("signal", socket.id, message);
        });

        // When someone sends a chat message
        socket.on("chat-message", (data, sender) => {
            // Find which room user belongs to
            const [matchingRoom, found] = Object.entries(connections)
                .reduce(([room, isFound], [roomKey, roomValue]) => {

                    if(!isFound && roomValue.includes(socket.id)){ // If not found
                        return [roomKey, true];
                    }
                    return [room, isFound];

                }, ['',false] )
            
            if(found === true){ // If we found user's room
                if(messages[matchingRoom] === undefined){ //Create message arr if not created
                    messages[matchingRoom] = [];
                }

                messages[matchingRoom].push({ // Save new msg in memory
                    'sender': sender,
                    "data": data,
                    "socket-id-sender": socket.id
                });

                console.log("message", matchingRoom, ":", sender, data);

                connections[matchingRoom].forEach((elem) => { //send this msg in same room
                    io.to(elem).emit("chat-message", data, sender, socket.id);
                })
            }

        });

        // When a user disconnects
        socket.on("disconnect", () => {
            var diffTime = Math.abs(timeOnline[socket.id] - new Date());// Calc online time
            var key

            for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {

                for (let a = 0; a < v.length; ++a) {
                    if (v[a] === socket.id) {
                        key = k

                        for (let a = 0; a < connections[key].length; ++a) {
                            io.to(connections[key][a]).emit('user-left', socket.id)
                        }

                        var index = connections[key].indexOf(socket.id)
                        connections[key].splice(index, 1)

                        if (connections[key].length === 0) {
                            delete connections[key]
                        }
                    }
                }
            }
            console.log(`Socket ${socket.id} disconnected after ${diffTime} ms`);
        })

    })

    return io;
}