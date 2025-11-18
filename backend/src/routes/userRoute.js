const express = require("express");
const router = express.Router();
const {login, register, getUserHistory, addToHistory} = require("../controllers/userController.js");

router.route("/login")
    .post(login)

router.route("/register")
    .post(register)

router.route("/add_to_activity")
    .post(addToHistory)

router.route("/get_all_activity")
    .get(getUserHistory)

module.exports = router;