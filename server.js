const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {User, Bus, Donation, Community, Resource} = require('./models');

const app = express();
app.use(express.json());

const JWT_SECRET = 'your-secret-key'; // Replace with a more secure key

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/edutrack360', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Failed to connect to MongoDB', err));

// Middleware to verify JWT tokens
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).send('Access denied, token missing.');
    }

    // Extract the token part after "Bearer"
    const bearerToken = token.split(' ')[1];

    jwt.verify(bearerToken, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).send('Invalid token.');
        }
        req.user = user;
        next();
    });
};
// 1. User Authentication Routes
// Register
app.post('/auth/register', async (req, res) => {
    try {
        const { name, role, email, password } = req.body;

        if (!name || !role || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "User with this email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, role, email, password: hashedPassword });
        await user.save();

        const { password: _, ...userWithoutPassword } = user.toObject();
        res.status(201).json(userWithoutPassword);

    } catch (error) {
        console.error("Error during user registration:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Login
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET);
        res.json({ token });

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 2. Dashboard
app.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('donationHistory');
        const buses = await Bus.find();

        res.json({
            user,
            buses,
            notifications: ['Bus running late', 'Event at 3 PM'],
        });
        console.log("Sent Dashboard data")

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 3. Bus Tracking Routes
app.get('/bus-tracking', authMiddleware, async (req, res) => {
    try {
        const buses = await Bus.find();
        res.json(buses);
    } catch (error) {
        console.error("Error fetching bus data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/bus-tracking/schedule/:busId', authMiddleware, async (req, res) => {
    try {
        const bus = await Bus.findById(req.params.busId);
        if (!bus) {
            return res.status(404).json({ error: "Bus not found" });
        }
        res.json(bus.schedule);
    } catch (error) {
        console.error("Error fetching bus schedule:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/bus-tracking/checkin', authMiddleware, async (req, res) => {
    try {
        const { busId, studentId, checkinTime } = req.body;
        if (!busId || !studentId || !checkinTime) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const bus = await Bus.updateOne(
            { _id: busId },
            { $push: { checkins: { studentId, checkinTime } } }
        );

        if (!bus.nModified) {
            return res.status(404).json({ error: "Bus not found" });
        }

        res.json({ message: "Check-in recorded" });

    } catch (error) {
        console.error("Error during bus check-in:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Route to get user ID by email
app.post('/users/getUserIdByEmail', authMiddleware, async (req, res) => {
    const { email } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Return the user ID
        res.json({ userId: user._id });
    } catch (error) {
        console.error("Error fetching user by email:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Add a new child to a parent's account
app.post('/children', authMiddleware, async (req, res) => {
    try {
        const { name, grade, busRoute } = req.body;

        // Validate input
        if (!name || !grade || !busRoute) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Create a new child document
        const child = new Child({
            name,
            grade,
            busRoute,
            parentId: req.user.userId // Use the parent's ID from the JWT
        });

        // Save the new child
        await child.save();

        // Update the parent's 'children' array with the new child's ID
        await User.updateOne(
            { _id: req.user.userId },
            { $push: { children: child._id } }
        );

        res.status(201).json(child);

    } catch (error) {
        console.error("Error adding child:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// 4. Donation Management Routes
app.get('/donations', authMiddleware, async (req, res) => {
    try {
        const donations = await Donation.find();
        res.json(donations);
    } catch (error) {
        console.error("Error fetching donations:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/donations', authMiddleware, async (req, res) => {
    try {
        const donation = new Donation(req.body);
        await donation.save();
        res.status(201).json(donation);
    } catch (error) {
        console.error("Error creating donation:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/donations/history/:userId', authMiddleware, async (req, res) => {
    try {
        const donations = await Donation.find({ donors: req.params.userId });
        res.json(donations);
    } catch (error) {
        console.error("Error fetching donation history:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 5. Community Engagement & Support Routes
app.get('/community/opportunities', authMiddleware, async (req, res) => {
    try {
        const opportunities = await VolunteerOpportunities.find(); // Fetch all opportunities
        res.json(opportunities);
    } catch (error) {
        console.error("Error fetching opportunities:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// API route to create a new opportunity
app.post('/community/opportunity', authMiddleware, async (req, res) => {
    const { title, description, location, date } = req.body;

    try {
        const newOpportunity = new Community({
            title,
            description,
            location,
            date: new Date(date),
            volunteers: []
        });

        await newOpportunity.save();
        res.json({ message: "Opportunity created successfully", opportunity: newOpportunity });
    } catch (error) {
        console.error("Error creating opportunity:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



app.post('/community/sign-up-volunteer', authMiddleware, async (req, res) => {
    try {
        const { opportunityId } = req.body;

        if (!opportunityId) {
            return res.status(400).json({ error: "Opportunity ID is required" });
        }

        const result = await Community.updateOne(
            { _id: opportunityId },
            { $push: { volunteers: req.user.userId } }
        );

        if (!result.nModified) {
            return res.status(404).json({ error: "Opportunity not found" });
        }

        res.json({ message: "Signed up for volunteer opportunity" });

    } catch (error) {
        console.error("Error signing up for volunteer opportunity:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/community/sendMessage', authMiddleware, async (req, res) => {
    const { toEmail, fromEmail, messageContent, opportunityId } = req.body;

    try {
        // Find the recipient and sender by email
        const recipient = await User.findOne({ email: toEmail });
        const sender = await User.findOne({ email: fromEmail });

        if (!recipient || !sender) {
            return res.status(404).json({ error: "Recipient or sender not found" });
        }

        // Find the community opportunity by the opportunityId (which is the _id in the database)
        const community = await Community.findById(opportunityId);

        if (!community) {
            return res.status(404).json({ error: "Community opportunity not found" });
        }

        // Add the message to the community's messages array
        community.messages.push({
            fromUserId: sender._id,
            toUserId: recipient._id,
            message: messageContent,
            timestamp: Date.now(),
        });

        // Save the updated community document
        await community.save();

        res.json({ message: "Message sent successfully" });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



// 6. Resources (Education & Health) Routes
app.get('/resources/education', authMiddleware, async (req, res) => {
    try {
        const resources = await Resource.find({ type: 'Education' });
        res.json(resources);
    } catch (error) {
        console.error("Error fetching education resources:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/resources/health-tracking', authMiddleware, async (req, res) => {
    try {
        const { studentId, data } = req.body;

        if (!studentId || !data) {
            return res.status(400).json({ error: "Student ID and health data are required" });
        }

        await Resource.updateOne(
            { _id: studentId },
            { $push: { healthData: data } }
        );

        res.json({ message: "Health data updated" });

    } catch (error) {
        console.error("Error updating health data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/resources/health-tracking/:studentId', authMiddleware, async (req, res) => {
    try {
        const healthData = await Resource.find({ students: req.params.studentId });
        res.json(healthData);
    } catch (error) {
        console.error("Error fetching health tracking data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
