const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory storage
let tutors = [];

/**
 * POST /addTutor
 * Adds a tutor or updates their active status
 */
app.post("/addTutor", (req, res) => {
  const { tutor } = req.body;

  if (!tutor || !tutor.name) {
    return res.status(400).json({
      error: "Tutor must include name (string) and other fields i guess"
    });
  }

  // Check if tutor already exists
  const existingTutor = tutors.find(
    (t) => t.name.toLowerCase() === tutor.name.toLowerCase()
  );

  if (existingTutor) {
    // Update active status
    existingTutor.active = tutor.active;

    console.log("Updated tutor:", existingTutor);

    return res.status(200).json({
      message: "Tutor updated",
      tutor: existingTutor,
    });
  }

  // Add new tutor
  const newTutor = {
    name: tutor.name,
    active: tutor.active,
    subjects: tutor.subjects,
    hourlyRate: tutor.hourlyRate,
    phone: tutor.phone,
    paypal: tutor.paypal
  };

  tutors.push(newTutor);

  console.log("Added tutor:", newTutor);

  res.status(201).json({
    message: "Tutor added",
    tutor: newTutor,
  });
});

/**
 * GET /tutors
 * Returns all tutors
 */
app.get("/tutors", (req, res) => {
  res.json(tutors);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});