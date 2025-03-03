const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { Dropbox } = require("dropbox");

const app = express();
const PORT = 5001;

// Set up Dropbox client using an environment variable for the access token
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

// Multer storage setup
const storage = multer.memoryStorage(); // Use memory storage for direct upload to Dropbox
const upload = multer({ storage });

// Upload route for cover images and book documents
app.post("/upload", upload.fields([{ name: "bookLink" }, { name: "bookDocument" }]), async (req, res) => {
  if (!req.files) return res.status(400).json({ error: "No files uploaded" });

  const filePromises = [];

  // Upload cover image to Dropbox
  if (req.files.bookLink) {
    const coverFile = req.files.bookLink[0];
    const coverPromise = dbx.filesUpload({
      path: '/' + coverFile.originalname,
      contents: coverFile.buffer,
    });
    filePromises.push(coverPromise);
  }

  // Upload document to Dropbox
  if (req.files.bookDocument) {
    const documentFile = req.files.bookDocument[0];
    const documentPromise = dbx.filesUpload({
      path: '/' + documentFile.originalname,
      contents: documentFile.buffer,
    });
    filePromises.push(documentPromise);
  }

  try {
    const responses = await Promise.all(filePromises);
    const bookLink = responses[0] ? `https://www.dropbox.com/home${responses[0].path_display}` : null;
    const bookDocument = responses[1] ? `https://www.dropbox.com/home${responses[1].path_display}` : null;

    res.json({ bookLink, bookDocument });
  } catch (error) {
    console.error("Error uploading to Dropbox:", error);
    res.status(500).json({
      error: "Failed to upload files",
      details: error.error_summary || error.message,
    });
  }
}); 

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});