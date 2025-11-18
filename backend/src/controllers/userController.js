//const { StatusCodes } = require("http-status-codes")
const User = require("../models/userModel.js");
const Meeting = require("../models/meetingModel");
const bcrypt = require("bcrypt");
const {hash} = require("bcrypt");
const { response } = require("express");
const crypto = require("crypto");

const login = async(req, res) => {
    const {username, password} = req.body;
    if(!username || !password){
        return res.status(400).json({message: "Please Provide"})
    }

    try{
        const user = await User.findOne({username});
        if(!user){
            return res.status(404).json({message: "User not found"})
        }

        let isPasswordCorrect = await bcrypt.compare(password, user.password); //compare passw

        if(isPasswordCorrect){
            let token = crypto.randomBytes(20).toString("hex"); // create token after login
            user.token = token;
            await user.save();
            return res.status(200).json({token: token})
        } else{
            return res.status(401).json({message: "Indvalid Username or Password"});
        }

    } catch(error){
        return res.status(500).json({message: "Something went wrong"}, error)
    }
}

const register = async (req, res) => {
    const {name, username, password} = req.body;

    try{
        const existingUser = await User.findOne({username});
        if(existingUser){
            //return res.status(StatusCodes.FOUND).json({message: "user already exists"});
            return res.status(401).json({message: "User already exists"})
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword,
        })
        
        await newUser.save();
        //res.status(StatusCodes.CREATED).json({message: "user registered"});
        res.status(201).json({message: "user registerd"});

    } catch(error) {
        res.json({message: `something went wrong ${error}`});
    }
}

const getUserHistory = async(req, res) => {
    const { token } = req.query;

    //try{
    //    const user = await User.findOne({token: token});
    //    const meetings = await Meeting.find({user_id: user.username});
    //    res.json(meetings);

    //} catch(e) {
    //    res.json(`Something went wrong ${e}`);
    //}

    try {
        const user = await User.findOne({ token });

        if (!user) return res.status(404).json([]);
        const meetings = await Meeting.find({ user_id: user.username });
        return res.status(200).json(meetings);

    } catch (e) {
        return res.status(500).json({ message: "Server error", error: e });
    }
}

const addToHistory = async(req, res) => {
    const { token, meeting_code } = req.body;

    try{
        const user = await User.findOne({token: token});

        const newMeeting = new Meeting({
            user_id: user.username,
            meetingCode: meeting_code,
        })

        await newMeeting.save();

        res.status(201).json({message: "Added code to history"});

    } catch(e) {
        res.json(`something went wrong ${e}`);
    }

}

module.exports = {login, register, getUserHistory, addToHistory};