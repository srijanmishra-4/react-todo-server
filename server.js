const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
// const PORT = 3000;
const MONGO_URI = "mongodb+srv://srijan:srijan@cluster0.ckatk.mongodb.net/TodoApp?retryWrites=true&w=majority";
const JWT_SECRET = 'todo_app_secret'; // Replace with a secure secret

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors()); // Allow cross-origin requests

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB (TodoApp database)'))
    .catch((err) => console.log('MongoDB connection error:', err));

// Define the schema for `todo-user-collection`
const userSchema = new mongoose.Schema({
    uname: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    uid: { type: String, required: true },
    tasks: [
        {
            tid: { type: String, default:"" },  // Unique 5-digit Task ID
            date: { type: String, default: "" },
            taskName: { type: String, default: "" },
            status: { type: String, default: "incomplete" }  // Default status is "pending"
        }
    ]
}, { collection: 'todo-user-collection' });

const User = mongoose.model('todo-user-collection', userSchema);


const generateUniqueUID = async () => {
    let uid;
    let isUnique = false;

    while (!isUnique) {
        uid = Math.floor(1000 + Math.random() * 9000); // Generates a random number between 1000-9999
        const existingUser = await User.findOne({ uid });
        if (!existingUser) {
            isUnique = true;
        }
    }

    return uid;
};
const generateUniqueTID = async () => {
    let tid;
    let isUnique = false;

    while (!isUnique) {
        tid = Math.floor(10000 + Math.random() * 90000); // Generates a random number between 10000-99999
        const existingTask = await User.findOne({ "tasks.tid": tid });
        if (!existingTask) {
            isUnique = true;
        }
    }

    return tid;
};

// /auth endpoint
app.post('/auth', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if user exists
        const user = await User.findOne({ email });
        console.log(user)
        if (!user) {
            return res.status(404).json({ message: 'Email not found' });
        }

        // Validate password (plain text comparison)
        if (password !== user.password) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Generate JWT with uid
        const token = jwt.sign({ uid: user.uid }, JWT_SECRET, { expiresIn: '1h' });

        // Set session cookie (expires when browser is closed)
        res.cookie('session', token, { httpOnly: true, secure: false }); // Use `secure: true` in production

        res.json({ message: 'Authentication successful', token });
    } catch (error) {
        console.error('Error in /auth:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
app.get('/fetchData/:id', async (req, res) => {
    let { id } = req.params;
    console.log("Fetch API");
    console.log(id);
    console.log(typeof id);

    // id = Number(id);  // Ensure it's a number
    // console.log("Converted ID:", id, typeof id);

    // breakpoint
    try {
        // Find user by UID (make sure types match)
        const user = await User.findOne({ uid: id });  // Use findOne instead of find
        // console.log(user);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User data fetched successfully', user });
        // const allUsers = await User.find();
        // console.log("All Users:", allUsers);  // Print full objects
        // console.log("All UIDs:", allUsers.map(user => typeof user.uid)); // Check types
        // Print only UIDs



    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: 'Internal server error' });
    }

});

app.post('/register', async (req, res) => {
    const { email, uname, password } = req.body;

    try {
        // Check if the email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Generate a unique 4-digit UID
        const uid = await generateUniqueUID();

        // Create a new user document with empty task structure
        const newUser = new User({
            email,
            uname,
            password,  
            uid,
            tasks: [{ tid : "" , date: "", taskName: "", status: "" }]  // Ensures an empty task structure is added
        });

        // Save the user to the database
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully', uid });
    } catch (error) {
        console.error('Error in /register:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/addTask', async (req, res) => {
    const { uid, task, date } = req.body;

    try {
        // Check if user exists
        const user = await User.findOne({ uid });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Generate unique TID
        const tid = await generateUniqueTID();

        // Add the task to the user's tasks array
        user.tasks.push({ tid, taskName: task, date, status: "incomplete" });
        await user.save();

        res.status(201).json({ message: 'Task added successfully', tid });
    } catch (error) {
        console.error('Error in /addTask:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
app.put('/editTask', async (req, res) => {
    const { tid, uid, task, date } = req.body;
    console.log("Inside Edit task Route : ")
    console.log(task , date , uid , tid)
    try {
        // Find the user and update the specific task
        const updatedUser = await User.findOneAndUpdate(
            { uid, "tasks.tid": tid },
            { $set: { "tasks.$.taskName": task, "tasks.$.date": date } },
            { new: true }
        );
        console.log(updatedUser)
        if (!updatedUser) return res.status(404).json({ message: 'Task not found' });

        res.status(200).json({ message: 'Task updated successfully' });
    } catch (error) {
        console.error('Error in /editTask:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
app.put('/updateTodo', async (req, res) => {
    const { tid, uid } = req.body;

    try {
        // Find the user and update the task status
        const updatedUser = await User.findOneAndUpdate(
            { uid, "tasks.tid": tid },
            { $set: { "tasks.$.status": "completed" } },
            { new: true }
        );

        if (!updatedUser) return res.status(404).json({ message: 'Task not found' });

        res.status(200).json({ message: 'Task marked as completed' });
    } catch (error) {
        console.error('Error in /updateTodo:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
app.delete('/deleteTask', async (req, res) => {
    const { tid, uid } = req.query;

    try {
        // Find the user and remove the task from the tasks array
        const updatedUser = await User.findOneAndUpdate(
            { uid },
            { $pull: { tasks: { tid: parseInt(tid) } } },
            { new: true }
        );

        if (!updatedUser) return res.status(404).json({ message: 'Task not found' });

        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error in /deleteTask:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


const PORT = process.env.PORT || 3000; // Use Render's assigned port
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

