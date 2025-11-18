import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { useNavigate } from 'react-router-dom';

const defaultTheme = createTheme();

export default function Authentication() {

    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState("");
    
    const [error, setError] = React.useState();
    const [message, setMessage] = React.useState();

    const [formState, setFormState] = React.useState(0);

    const [open, setOpen] = React.useState(false);

    const {handleRegister, handleLogin} = React.useContext(AuthContext);

    let handleAuth = async() => {
        try{
            if(formState === 0){
                let result = await handleLogin(username, password);
                console.log(result);
            }

            if(formState === 1){
                let result = await handleRegister(name, username, password);
                console.log(result);
                setUsername("");
                setMessage(result);
                setOpen(true);
                setError("");
                setFormState(0);
                setPassword("");
            }

        } catch(err){
            console.log(err);
            let message = err?.response?.data?.message || err?.response?.data || "Something went wrong";
            setError(message);
        }
    }

    let navigate = useNavigate();

    const handleGoHome = () => {
        //console.log("Navigating to Home...");
        navigate("/")
    };


    return (
        <ThemeProvider theme={defaultTheme}>
            <Grid container component="main" sx={{ height: '100vh' }}>
                <CssBaseline />

                {/*Left side Grid*/}
                <Grid size={{ sm: 4, md: 8 }}
                    sx={{
                        backgroundImage: 'url(https://minimalistic-wallpaper.demolab.com/?random)',
                        //backgroundImage: 'url(https://picsum.photos/1920/1080)',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: (t) =>
                            t.palette.mode === 'light' ? t.palette.grey[50] : t.palette.grey[900],
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        position: 'relative', // new
                    }}
                >
                    <Box sx={{ position: 'absolute', top: 16, left: 16 }}>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            startIcon={<HomeIcon />} 
                            onClick={handleGoHome}
                        >Home </Button>
                    </Box>
                </Grid>

                {/*Right side Grid*/}
                <Grid size={{ xs: 12, sm: 8, md: 4 }} component={Paper} elevation={6} square>
                    <Box
                        sx={{
                            my: 8,
                            mx: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                            <LockOutlinedIcon />
                        </Avatar>


                        <div>
                            <Button variant={formState === 0 ? "contained" : ""} onClick={() => { setFormState(0) }}>
                                Login
                            </Button>
                            <Button variant={formState === 1 ? "contained" : ""} onClick={() => { setFormState(1) }}>
                                Register
                            </Button>
                        </div>

                        <Box component="form" noValidate sx={{ mt: 1 }}>
                            {/*Full Name*/}
                            {formState === 1 ? 
                                <TextField
                                    margin="normal"
                                    required
                                    fullWidth
                                    id="username"
                                    label="Full Name"
                                    name="username"
                                    value={name}
                                    autoFocus
                                    onChange={(e) => setName(e.target.value)}
                                /> : <></>
                            }

                            {/*Username*/}
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="username"
                                label="Username"
                                name="username"
                                value={username}
                                autoFocus
                                onChange={(e) => setUsername(e.target.value)}

                            />

                            {/*Password*/}
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                value={password}
                                type="password"
                                onChange={(e) => setPassword(e.target.value)}

                                id="password"
                            />

                            <p style={{ color: "red" }}>{error}</p>

                            {/*Buttons*/}
                            <Button
                                type="button"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2 }}
                                onClick={handleAuth}
                            >
                                {formState === 0 ? "Login " : "Register"}
                            </Button>

                        </Box>
                    </Box>
                </Grid>
            </Grid>

            <Snackbar
                open={open}
                autoHideDuration={4000}
                message={message}
            />

        </ThemeProvider>
    );
}