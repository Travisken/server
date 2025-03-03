const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { Dropbox } = require("dropbox");

const app = express();
const PORT = 5001;

app.use(cors({
  origin: 'http://localhost:3000', // Replace with your frontend URL if it's different
}));


// Set up Dropbox client using an environment variable for the access token
const dbx = new Dropbox({ accessToken: 'sl.u.AFmxANGH4hsh20ddVhmpIijm-x_X6gHoNh70L9xsr-Z2Dq78H6hH6L6BNIVdJxRZH1PkFblwWuIfwLcgsQ_9BIc2ebrWFOXWFuM5w-MATBki6V0ngBl7oEFKqBFyIQ359sXLXmIEkMF-1XqL20YUm1hCpZ3WZ0RrR_DGZD1e_v8vD3Ui6R_66XVT4Xda7TTT9I7eKNZYT_bc6e7TdWa3PAZBWtSP4zFJQpgOEWoWCKaerGf80GMvEJY7lGXkEN9PI36iMO2ALQVUhyB6hdMyTMbbqTxys_jgGHHoQ-fahl16ZAwu8X-QgvH4v8ijTwdjsvWhNUrOCtONRnHmmIDPi0ulJnDTLaT5fhLrDq4Zs_x_reIzLdWTuI6v79aoxTcc58_hz7viarUQzTvKjX7UmTIkS4L-sFALjqn6cn4NC6hmZfT8qHa4tqxOJ7uRWVFLGl9OKja4aax5x_GyO1q8acvIPtwBi19e3-ZrPFKbwaLdO0RBhI86AO31qLU2Zd8ylz8D0o4ec-gwxsj7moH1kFmWTfa35VbFdcXl0MnnuQ2W2RPRkLdJj3u_0cT3DDQ1-4e6iVPxS8FjB1ZE9sRpni7E5TbJdMt8eWNJSFd5WVuVEHdqn1ZV2b-VYgpQH7j23uECeeHIRagpL5BMOll4ZPiwuVs-G_ph3ClgSBYXeKIXDqP-d88lWePBV8XmZGh7GQi1QssFIL78ByMDbM59YaFeDnN0bZzCsPGhiVsY-A90ZPXUPSB9yp4Io1sGpwad1Ftdh55ZgKfzLKk1ZuaScVBrgdvDs5woas0E3iv1YsO0DRAZQZxb4eqyI60GnjR8aZ4wWGsSpSRaifoHyonRAJhu2e1NQgzoAEt1xFn-_mWdlPbkmJETXO_1ZKNoO18kSLRo85jr5hbtnb9ErQon3NEZrEBJWfTobVDTUOpiWjIT8kMamIgB0nUUrxEZMq5GqCmmKU_ewF3ZuRMzNx1oGMNmTe0zZeMy1JgcygriqRT_bHgkK3XWa91t50yPjh8xehZNkZw0DQplTKyezu4DOavm4iYbXcZLij49nKiiSRU2XAo1nWl-S5j4iNb36Ko4pKASkp8Shs55Hi0A57h9mtihZBVzVClDyCxV_xVmfSX0-rGUscspWGUVJ6j1lEkg52xDo5KeDIPBtzU0kWnUeCw81bwHpv_vjMgVBg5FJo4Bv162oXnUX4MTu2qkI5mzvBE5pNgVcPDhyUseWlQ7kdXvqwU64FBBI_btgnUCOPkyF_vmN-dV70PQgFkAc1OxZ2HkUyqH1V8cDVUKP41A95A6-_32b-Mb1gBM-nV3Qgei4Q' });

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