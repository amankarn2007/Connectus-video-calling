if(process.env.NODE_ENV != "production"){
    require('dotenv').config();
}

const express = require("express");
const http = require("http");
const { createServer } = require("node:http");
const mongoose = require("mongoose");
const cors = require("cors");
const {connectToSocket} = require("./controllers/socketManager.js");
const userRoute = require("./routes/userRoute.js");


//const LocalMongo_Url = "mongodb://127.0.0.1:27017/Zoom_clone"; //Local DB URL
//async function main(){
//    await mongoose.connect(LocalMongo_Url,{
//        auth: {
//            username: "amanAdmin",
//            password: "Backend@987"
//        },
//        authSource: "admin"
//    });
//}
//main()
//    .then(() => console.log("connected to DB"))
//    .catch((err) => console.log(err))


const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", (process.env.PORT || 8080))

app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb", extended:true}));


app.use("/api/v1/users", userRoute);

const start = async() => {
    const MONGO_URL = process.env.ATLASDB_URL;

    try {
        const connectionDb = await mongoose.connect(MONGO_URL);
        console.log(`✅ MONGO Connectet To: ${connectionDb.connection.host}`);
        
        server.listen(app.get("port"), () => {
            console.log(`Server is listening on port ${app.get("port")}`);
        });
    }catch (error) {
        console.error("MongoDB connection failed:", error);
    }
}
start();