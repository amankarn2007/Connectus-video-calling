const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const meetingSchema = new Schema({
    user_id: {
        type: String
    },
    meetingCode: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
        required: true,
    }
})

module.exports = mongoose.model("Model",meetingSchema);