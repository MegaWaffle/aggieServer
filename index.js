// server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// ---------------- WebSocket Server ----------------
const wss = new WebSocket.Server({ server });

// In-memory storage
let tutors = [];
let tutorSockets = {};   // tutorName (lowercase) -> ws
let studentSockets = {}; // studentName (lowercase) -> ws
let sessions = [];

// ---------------- WebSocket Logic ----------------
wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received WS message:", data);

      // Register tutor
      if (data.type === "registerTutor" && data.tutorName) {
        const nameKey = data.tutorName.toLowerCase();
        tutorSockets[nameKey] = ws;
        ws.tutorName = nameKey;
        console.log(`Tutor registered: ${data.tutorName}`);
      }

      // Register student
      if (data.type === "registerStudent" && data.studentName) {
        const nameKey = data.studentName.toLowerCase();
        studentSockets[nameKey] = ws;
        ws.studentName = nameKey;
        console.log(`Student registered: ${data.studentName}`);
      }

      // Tutor response: accept or reject session
      if (data.type === "tutorResponse" && data.sessionId && data.status) {
        const session = sessions.find((s) => s.id === data.sessionId);
        if (!session) {
          console.log("Session not found:", data.sessionId);
          return;
        }

        // Relay response to student if connected
        const studentWs = studentSockets[session.studentName.toLowerCase()];
        if (studentWs && studentWs.readyState === WebSocket.OPEN) {
          studentWs.send(JSON.stringify({
            type: "tutorResponse",
            status: data.status, // "accepted" or "rejected"
            sessionId: session.id,
            tutorName: session.tutorName,
            course: session.course,
            sessionCode: data.sessionCode || null,
          }));
          console.log(`Relayed tutor response (${data.status}) to ${session.studentName}`);
        } else {
          console.log(`Student ${session.studentName} not connected, response queued`);
        }
      }

      // Optional: ping/pong to keep WS alive
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }

    } catch (err) {
      console.log("Invalid WS message:", message, err);
    }
  });

  ws.on("close", () => {
    if (ws.tutorName && tutorSockets[ws.tutorName] === ws) {
      console.log(`Tutor disconnected: ${ws.tutorName}`);
      delete tutorSockets[ws.tutorName];
    }
    if (ws.studentName && studentSockets[ws.studentName] === ws) {
      console.log(`Student disconnected: ${ws.studentName}`);
      delete studentSockets[ws.studentName];
    }
  });
});

// ---------------- REST API ----------------

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
  res.json(tutors);
});

// Request a session (student -> tutor)
app.post("/requestSession", (req, res) => {
  const { studentName, tutorName, course, requestedMinutes, location } = req.body;

  if (!studentName || !tutorName || !course || !requestedMinutes) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const tutor = tutors.find((t) => t.name.toLowerCase() === tutorName.toLowerCase());
  if (!tutor) return res.status(404).json({ error: "Tutor not found" });
  if (!tutor.active) return res.status(400).json({ error: "Tutor is currently inactive" });
  if (!tutor.subjects.includes(course)) return res.status(400).json({ error: "Tutor does not teach this course" });

  // Create session with unique ID
  const session = {
    id: Date.now().toString(),
    studentName,
    tutorName,
    course,
    requestedMinutes,
    location,
    timestamp: new Date(),
  };
  sessions.push(session);

  // Relay to tutor if connected
  const tutorWs = tutorSockets[tutorName.toLowerCase()];
  if (tutorWs && tutorWs.readyState === WebSocket.OPEN) {
    tutorWs.send(JSON.stringify({ type: "newSessionRequest", session }));
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

// ---------------- Start Server ----------------
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});