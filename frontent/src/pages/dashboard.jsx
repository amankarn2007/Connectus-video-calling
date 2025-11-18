import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from '../contexts/AuthContext';
import { Button, IconButton, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import "../styles/dashboard.css"

function HomeComponent(){

    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");

    const {addToUserHistory} = useContext(AuthContext);

    let handleJoinVideoCall = async() => {
        await addToUserHistory(meetingCode);
        navigate(`/${meetingCode}`)
    }

    return(
        <>

            <div className="navbar">
                <div style={{display: "flex", alignItems: "center"}}>
                    <IconButton onClick={
                        () => {
                            navigate("/history")
                        }
                    }>
                        <RestoreIcon />
                    </IconButton>
                    <p>History</p>

                    <Button onClick={() => {
                        localStorage.removeItem("token")
                        navigate("/auth")
                    }}>
                        Logout
                    </Button>
                </div>

            </div>


            <div className="meetContainer">

                <div className="leftPanel">
                    <div>
                        <h2>Providing Quality Video Call Just Like Quality Education</h2>

                        <div style={{display: 'flex', gap: "10px", marginTop: "1rem"}}>
                            <TextField onChange={e => setMeetingCode(e.target.value)} id="outlined-basic" label="Meeting Code" variant="outlined" />
                                
                            <Button onClick={handleJoinVideoCall} variant='contained'>Join</Button>
                        </div>

                    </div>
                </div>

                <div className="rightPanel">
                    <img srcSet='/logo3.png' alt="" />
                </div>

            </div>


        </>
    )
}

export default HomeComponent;
//export default withAuth(HomeComponent);