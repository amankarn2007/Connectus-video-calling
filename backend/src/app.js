const express = require("express");
const http = require("http");
const { createServer } = require("node:http");
const mongoose = require("mongoose");
const cors = require("cors");
const {connectToSocket} = require("./controllers/socketManager.js");
const userRoute = require("./routes/userRoute.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/Zoom_clone"; //Local DB URL
async function main(){
    await mongoose.connect(MONGO_URL,{
        auth: {
            username: "amanAdmin",
            password: "Backend@987"
        },
        authSource: "admin"
    });
}

main()
    .then( () =>{
        console.log("connected to DB");
    })
    .catch( (err) =>{
        console.log(err);
    })


const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", (process.env.PORT || 8080))

app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb", extended:true}));


app.use("/api/v1/users", userRoute);

const start = async() => {
    server.listen(app.get("port"), () => {
        console.log("server is listning on port 8080");
    })
}
start();