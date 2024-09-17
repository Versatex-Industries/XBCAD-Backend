const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
    name: String,
    role: {type: String, enum: ['Parent', 'Teacher', 'Admin'], required: true},
    email: {type: String, unique: true, required: true},
    password: String,
    registeredDate: {type: Date, default: Date.now},
    donationHistory: [{type: mongoose.Schema.Types.ObjectId, ref: 'Donation'}],
    children: [{type: mongoose.Schema.Types.ObjectId, ref: 'Student'}],
});

// Bus Schema
const busSchema = new mongoose.Schema({
    busId: String,
    location: {
        latitude: Number,
        longitude: Number,
    },
    route: [{pickupPoint: String, dropoffPoint: String}],
    schedule: {
        pickupTimes: [Date],
        dropoffTimes: [Date],
    },
    checkins: [
        {
            studentId: mongoose.Schema.Types.ObjectId,
            checkinTime: Date,
            destinationTime: Date,
        },
    ],
});

// Donation Schema
const donationSchema = new mongoose.Schema({
    campaignId: String,
    school: String,
    category: {type: String, enum: ['Funds', 'Supplies', 'Services']},
    targetAmount: Number,
    amountRaised: {type: Number, default: 0},
    donors: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    createdDate: {type: Date, default: Date.now},
    endDate: Date,
});

// Community Schema
const communitySchema = new mongoose.Schema({
    opportunityId: String,
    description: String,
    date: Date,
    volunteers: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    messages: [
        {
            fromUserId: mongoose.Schema.Types.ObjectId,
            toUserId: mongoose.Schema.Types.ObjectId,
            message: String,
            timestamp: {type: Date, default: Date.now},
        },
    ],
});

// Resources Schema
const resourceSchema = new mongoose.Schema({
    type: {type: String, enum: ['Education', 'Health']},
    title: String,
    content: String,
    downloadable: Boolean,
    students: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
});

// Models
const User = mongoose.model('User', userSchema);
const Bus = mongoose.model('Bus', busSchema);
const Donation = mongoose.model('Donation', donationSchema);
const Community = mongoose.model('Community', communitySchema);
const Resource = mongoose.model('Resource', resourceSchema);

module.exports = {User, Bus, Donation, Community, Resource};
