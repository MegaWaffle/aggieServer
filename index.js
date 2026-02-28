const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

// Use Render's dynamic port
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Socket.IO server with CORS for any origin (adjust in production)
const io = new Server(server, {
  cors: { origin: "*" },
});

// In-memory storage
let tutors = [];
let tutorSockets = {}; // map tutorName -> socket.id
let sessions = []; // store session requests

// ---------------------- Socket.IO Logic ----------------------

// Tutor connects and registers
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("registerTutor", (tutorName) => {
    tutorSockets[tutorName.toLowerCase()] = socket.id;
    console.log(`Tutor registered: ${tutorName} -> ${socket.id}`);
  });

  socket.on("disconnect", () => {
    for (const [name, id] of Object.entries(tutorSockets)) {
      if (id === socket.id) {
        console.log(`Tutor disconnected: ${name}`);
        delete tutorSockets[name];
        break;
      }
    }
  });
});

// ---------------------- Helper: deactivate expired tutors ----------------------
function deactivateExpiredTutors() {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  tutors.forEach((tutor) => {
    if (tutor.active && tutor.activeUntil && currentTime >= tutor.activeUntil) {
      tutor.active = false;
      console.log(`Tutor ${tutor.name} deactivated (past activeUntil)`);
    }
  });
}

// Run every minute
setInterval(deactivateExpiredTutors, 60 * 1000);

// ---------------------- REST API ----------------------

// Add or update tutor
app.post("/addTutor", (req, res) => {
  const { tutor } = req.body;
  if (!tutor || !tutor.name)
    return res.status(400).json({ error: "Tutor must include name" });

  if (tutor.active && tutor.activeUntil) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(tutor.activeUntil)) {
      return res.status(400).json({ error: "activeUntil must be HH:MM 24-hour format" });
    }
  }

  const existingTutor = tutors.find(
    (t) => t.name.toLowerCase() === tutor.name.toLowerCase()
  );

  if (existingTutor) {
    Object.assign(existingTutor, tutor);
    return res.status(200).json({ message: "Tutor updated", tutor: existingTutor });
  }

  tutors.push(tutor);
  return res.status(201).json({ message: "Tutor added", tutor });
});

// Get all tutors
app.get("/tutors", (req, res) => {
  deactivateExpiredTutors();
  res.json(tutors);
});

// Receive student session request and relay to tutor app
app.post("/requestSession", (req, res) => {
  const { studentName, tutorName, course, requestedMinutes, location } = req.body;

  if (!studentName || !tutorName || !course || !requestedMinutes) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  deactivateExpiredTutors();

  const tutor = tutors.find((t) => t.name.toLowerCase() === tutorName.toLowerCase());
  if (!tutor) return res.status(404).json({ error: "Tutor not found" });
  if (!tutor.active) return res.status(400).json({ error: "Tutor is currently inactive" });
  if (!tutor.subjects.includes(course)) return res.status(400).json({ error: "Tutor does not teach this course" });

  // Check if tutor has enough time left
  if (tutor.activeUntil) {
    const [hour, minute] = tutor.activeUntil.split(":").map(Number);
    const now = new Date();
    const activeUntilDate = new Date();
    activeUntilDate.setHours(hour, minute, 0, 0);

    const remainingMinutes = Math.floor((activeUntilDate - now) / (1000 * 60));
    if (remainingMinutes < requestedMinutes) {
      return res.status(400).json({ error: "Tutor does not have enough active time left" });
    }
  }

  const session = { studentName, tutorName, course, requestedMinutes, location, timestamp: new Date() };
  sessions.push(session);

  // Relay to tutor if connected
  const tutorSocketId = tutorSockets[tutorName.toLowerCase()];
  if (tutorSocketId) {
    io.to(tutorSocketId).emit("newSessionRequest", session);
    console.log(`Relayed session request to ${tutorName}`);
  } else {
    console.log(`Tutor ${tutorName} not connected, request queued`);
  }

  res.status(201).json({ message: "Session requested successfully", session });
});

// Get all sessions
app.get("/sessions", (req, res) => {
  res.json(sessions);
});

// ---------------------- Start Server ----------------------
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});