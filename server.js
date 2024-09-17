const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {User, Bus, Donation, Community, Resource} = require('./models');

const app = express();
app.use(express.json());

const JWT_SECRET = 'your-secret-key'; // Replace with a more secure key

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/edutrack360', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Middleware to verify JWT tokens
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send('Access denied');

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).send('Invalid token');
        req.user = user;
        next();
    });
};

// 1. User Authentication Routes
// Register
app.post('/auth/register', async (req, res) => {
    const {name, role, email, password} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({name, role, email, password: hashedPassword});
    await user.save();
    res.send(user);
});

// Login
app.post('/auth/login', async (req, res) => {
    const {email, password} = req.body;
    const user = await User.findOne({email});
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send('Invalid credentials');
    }
    const token = jwt.sign({userId: user._id, role: user.role}, JWT_SECRET);
    res.json({token});
});

// 2. Dashboard
app.get('/dashboard', authMiddleware, async (req, res) => {
    const user = await User.findById(req.user.userId).populate('donationHistory');
    const buses = await Bus.find();
    res.json({
        user,
        buses,
        notifications: ['Bus running late', 'Event at 3 PM'],
    });
});

// 3. Bus Tracking Routes
app.get('/bus-tracking', authMiddleware, async (req, res) => {
    const buses = await Bus.find();
    res.json(buses);
});

app.get('/bus-tracking/schedule/:busId', authMiddleware, async (req, res) => {
    const bus = await Bus.findById(req.params.busId);
    res.json(bus.schedule);
});

app.post('/bus-tracking/checkin', authMiddleware, async (req, res) => {
    const {busId, studentId, checkinTime} = req.body;
    await Bus.updateOne(
        {_id: busId},
        {$push: {checkins: {studentId, checkinTime}}}
    );
    res.send('Check-in recorded');
});

// 4. Donation Management Routes
app.get('/donations', authMiddleware, async (req, res) => {
    const donations = await Donation.find();
    res.json(donations);
});

app.post('/donations', authMiddleware, async (req, res) => {
    const donation = new Donation(req.body);
    await donation.save();
    res.send(donation);
});

app.get('/donations/history/:userId', authMiddleware, async (req, res) => {
    const donations = await Donation.find({donors: req.params.userId});
    res.json(donations);
});

// 5. Community Engagement & Support Routes
app.get('/community/volunteer-opportunities', authMiddleware, async (req, res) => {
    const opportunities = await Community.find();
    res.json(opportunities);
});

app.post('/community/sign-up-volunteer', authMiddleware, async (req, res) => {
    const {opportunityId} = req.body;
    await Community.updateOne(
        {_id: opportunityId},
        {$push: {volunteers: req.user.userId}}
    );
    res.send('Signed up for volunteer opportunity');
});

app.post('/community/message', authMiddleware, async (req, res) => {
    const {toUserId, message} = req.body;
    const newMessage = {fromUserId: req.user.userId, toUserId, message};
    await Community.updateOne({_id: toUserId}, {$push: {messages: newMessage}});
    res.send('Message sent');
});

// 6. Resources (Education & Health) Routes
app.get('/resources/education', authMiddleware, async (req, res) => {
    const resources = await Resource.find({type: 'Education'});
    res.json(resources);
});

app.post('/resources/health-tracking', authMiddleware, async (req, res) => {
    const {studentId, data} = req.body;
    await Resource.updateOne(
        {_id: studentId},
        {$push: {healthData: data}}
    );
    res.send('Health data updated');
});

app.get('/resources/health-tracking/:studentId', authMiddleware, async (req, res) => {
    const healthData = await Resource.find({students: req.params.studentId});
    res.json(healthData);
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
