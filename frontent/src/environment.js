let IS_PROD = true;

const server = IS_PROD ? 
    "https://connectus-videocalling-app.onrender.com" : "http://localhost:8080"

export default server;

//already deployed backend, ham ab backend ko "onrender link" ke through access karenge