import {Route, Routes} from "react-router-dom";
import LandingPage from './pages/landing' //Home page
import Authentication from "./pages/authentication"; // Authentication page* UI
import VideoMeetComponent from "./pages/VideoMeet"; // Video Calling page
import { AuthProvider } from "./contexts/AuthContext"; // Authentication logic
import History from "./pages/history"; // for chat history
import Dashboard from "./pages/dashboard"; // for dashboard.jsx

function App(){
    return(
        <div className="App">

            <AuthProvider>
                <Routes>
                    <Route path="/" element={<LandingPage />} />

                    <Route path="/auth" element={<Authentication/>} />

                    <Route path="/dashboard" element={<Dashboard/>} />

                    <Route path="/history" element={<History/>} />

                    <Route path="/:url" element={<VideoMeetComponent/>} />
                </Routes>
            </AuthProvider>
            
        </div>
    )
}

export default App;
//Router ke bina Routes kaam nahi karte hai, lekin hame Router main.jsx me lagana chahiye