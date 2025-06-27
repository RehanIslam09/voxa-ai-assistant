import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import ImageKit from 'imagekit';
import mongoose from 'mongoose';
import Chat from './models/chat.js';
import UserChats from './models/userChats.js';

const port = process.env.PORT || 3000;
const app = express();

// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS for frontend requests
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

// MongoDB connection
const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
};

// ImageKit setup
const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});

// === ROUTES ===

// Get ImageKit auth parameters
app.get('/api/upload', (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

// Create new chat
app.post('/api/chats', async (req, res) => {
  const { text } = req.body;
  const userId = req.query.userId;
  if (!userId) return res.status(400).send('Missing userId');

  try {
    const newChat = new Chat({
      userId,
      history: [{ role: 'user', parts: [{ text }] }],
    });

    const savedChat = await newChat.save();

    const userChats = await UserChats.findOne({ userId });

    if (!userChats) {
      const newUserChats = new UserChats({
        userId,
        chats: [{ _id: savedChat._id, title: text.substring(0, 40) }],
      });
      await newUserChats.save();
    } else {
      await UserChats.updateOne(
        { userId },
        {
          $push: {
            chats: {
              _id: savedChat._id,
              title: text.substring(0, 40),
            },
          },
        }
      );
    }

    res.status(201).send(savedChat._id);
  } catch (err) {
    console.error('Create chat error:', err);
    res.status(500).send('Error creating chat!');
  }
});

// Get all user chats
app.get('/api/userchats', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).send('Missing userId');

  try {
    const userChats = await UserChats.findOne({ userId });
    res.status(200).send(userChats?.chats || []);
  } catch (err) {
    console.error('Fetch user chats error:', err);
    res.status(500).send('Error fetching userchats!');
  }
});

// Get a specific chat
app.get('/api/chats/:id', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).send('Missing userId');

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    if (!chat) return res.status(404).send('Chat not found');
    res.status(200).send(chat);
  } catch (err) {
    console.error('Fetch chat error:', err);
    res.status(500).send('Error fetching chat!');
  }
});

// Update a chat with new question/answer
app.put('/api/chats/:id', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).send('Missing userId');

  const { question, answer, img } = req.body;

  const newItems = [
    ...(question
      ? [{ role: 'user', parts: [{ text: question }], ...(img && { img }) }]
      : []),
    { role: 'model', parts: [{ text: answer }] },
  ];

  try {
    const updatedChat = await Chat.updateOne(
      { _id: req.params.id, userId },
      { $push: { history: { $each: newItems } } }
    );
    res.status(200).send(updatedChat);
  } catch (err) {
    console.error('Update chat error:', err);
    res.status(500).send('Error adding conversation!');
  }
});

// === Serve frontend (for production builds) ===
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

// === Start server ===
app.listen(port, () => {
  connect();
  console.log(`🚀 Server running on port ${port}`);
});
