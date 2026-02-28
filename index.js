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
 * Adds a tutor or updates their active status and activeUntil time
 */
app.post("/addTutor", (req, res) => {
  const { tutor } = req.body;

  if (!tutor || !tutor.name) {
    return res.status(400).json({
      error: "Tutor must include name (string) and other fields"
    });
  }

  // Validate activeUntil if provided
  if (tutor.active && tutor.activeUntil) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(tutor.activeUntil)) {
      return res.status(400).json({
        error: "activeUntil must be in HH:MM 24-hour format"
      });
    }
  }

  // Check if tutor already exists
  const existingTutor = tutors.find(
    (t) => t.name.toLowerCase() === tutor.name.toLowerCase()
  );

  if (existingTutor) {
    // Update fields
    existingTutor.active = tutor.active;
    existingTutor.activeUntil = tutor.activeUntil || null;
    existingTutor.subjects = tutor.subjects || existingTutor.subjects;
    existingTutor.hourlyRate = tutor.hourlyRate || existingTutor.hourlyRate;
    existingTutor.phone = tutor.phone || existingTutor.phone;
    existingTutor.paypal = tutor.paypal || existingTutor.paypal;

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
    activeUntil: tutor.activeUntil || null,
    subjects: tutor.subjects || [],
    hourlyRate: tutor.hourlyRate || 0,
    phone: tutor.phone || "",
    paypal: tutor.paypal || "",
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