const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { Dropbox } = require("dropbox");

const app = express();
const PORT = 5001;

// Enable CORS for frontend communication
app.use(cors({
  origin: 'https://www.drnimbs.com', // Update to your frontend URL
}));

// Dropbox client setup
const dbx = new Dropbox({ accessToken: 'sl.u.AFmxANGH4hsh20ddVhmpIijm-x_X6gHoNh70L9xsr-Z2Dq78H6hH6L6BNIVdJxRZH1PkFblwWuIfwLcgsQ_9BIc2ebrWFOXWFuM5w-MATBki6V0ngBl7oEFKqBFyIQ359sXLXmIEkMF-1XqL20YUm1hCpZ3WZ0RrR_DGZD1e_v8vD3Ui6R_66XVT4Xda7TTT9I7eKNZYT_bc6e7TdWa3PAZBWtSP4zFJQpgOEWoWCKaerGf80GMvEJY7lGXkEN9PI36iMO2ALQVUhyB6hdMyTMbbqTxys_jgGHHoQ-fahl16ZAwu8X-QgvH4v8ijTwdjsvWhNUrOCtONRnHmmIDPi0ulJnDTLaT5fhLrDq4Zs_x_reIzLdWTuI6v79aoxTcc58_hz7viarUQzTvKjX7UmTIkS4L-sFALjqn6cn4NC6hmZfT8qHa4tqxOJ7uRWVFLGl9OKja4aax5x_GyO1q8acvIPtwBi19e3-ZrPFKbwaLdO0RBhI86AO31qLU2Zd8ylz8D0o4ec-gwxsj7moH1kFmWTfa35VbFdcXl0MnnuQ2W2RPRkLdJj3u_0cT3DDQ1-4e6iVPxS8FjB1ZE9sRpni7E5TbJdMt8eWNJSFd5WVuVEHdqn1ZV2b-VYgpQH7j23uECeeHIRagpL5BMOll4ZPiwuVs-G_ph3ClgSBYXeKIXDqP-d88lWePBV8XmZGh7GQi1QssFIL78ByMDbM59YaFeDnN0bZzCsPGhiVsY-A90ZPXUPSB9yp4Io1sGpwad1Ftdh55ZgKfzLKk1ZuaScVBrgdvDs5woas0E3iv1YsO0DRAZQZxb4eqyI60GnjR8aZ4wWGsSpSRaifoHyonRAJhu2e1NQgzoAEt1xFn-_mWdlPbkmJETXO_1ZKNoO18kSLRo85jr5hbtnb9ErQon3NEZrEBJWfTobVDTUOpiWjIT8kMamIgB0nUUrxEZMq5GqCmmKU_ewF3ZuRMzNx1oGMNmTe0zZeMy1JgcygriqRT_bHgkK3XWa91t50yPjh8xehZNkZw0DQplTKyezu4DOavm4iYbXcZLij49nKiiSRU2XAo1nWl-S5j4iNb36Ko4pKASkp8Shs55Hi0A57h9mtihZBVzVClDyCxV_xVmfSX0-rGUscspWGUVJ6j1lEkg52xDo5KeDIPBtzU0kWnUeCw81bwHpv_vjMgVBg5FJo4Bv162oXnUX4MTu2qkI5mzvBE5pNgVcPDhyUseWlQ7kdXvqwU64FBBI_btgnUCOPkyF_vmN-dV70PQgFkAc1OxZ2HkUyqH1V8cDVUKP41A95A6-_32b-Mb1gBM-nV3Qgei4Q' });

// Multer: Memory storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to upload a file and get a shareable link
const uploadFileToDropbox = async (file) => {
  try {
    // Upload file to Dropbox
    const uploadResponse = await dbx.filesUpload({
      path: `/${file.originalname}`,
      contents: file.buffer,
    });

    // Generate a temporary downloadable link
    const linkResponse = await dbx.filesGetTemporaryLink({
      path: uploadResponse.result.path_display,
    });

    return linkResponse.result.link;
  } catch (error) {
    console.error("Dropbox upload error:", error);
    throw new Error("Failed to upload file to Dropbox");
  }
};

// Upload route for cover images and book documents
app.post("/upload", upload.fields([{ name: "bookLink" }, { name: "bookDocument" }]), async (req, res) => {
  try {
    if (!req.files) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Upload files to Dropbox
    const uploadPromises = [];
    if (req.files.bookLink) uploadPromises.push(uploadFileToDropbox(req.files.bookLink[0]));
    if (req.files.bookDocument) uploadPromises.push(uploadFileToDropbox(req.files.bookDocument[0]));

    // Wait for all uploads and retrieve URLs
    const [bookLink, bookDocument] = await Promise.all(uploadPromises);

    res.json({ bookLink, bookDocument });
  } catch (error) {
    console.error("Error during upload process:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
