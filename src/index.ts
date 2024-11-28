import express, { Application, NextFunction, Request, Response } from "express";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer, Server as HTTPServer } from "http";
import ffmpegPath from "ffmpeg-static";
import { exec } from "child_process";
import routes from "./routes/routes";
import { randomBytes } from "crypto";
import Ffmpeg from "fluent-ffmpeg";
import { ObjectId } from "mongodb";
import { getDb } from "./db/db";
import webPush from "web-push";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";

if (ffmpegPath) {
  Ffmpeg.setFfmpegPath(ffmpegPath);
}

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const tutorialsDir = path.join(__dirname, "tutorials");
if (!fs.existsSync(tutorialsDir)) {
  fs.mkdirSync(tutorialsDir);
}

const thumbnailsDir = path.join(__dirname, "thumbnails");
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (req.url.includes("upload-tutorial")) {
      cb(null, tutorialsDir);
    } else if (req.url.includes("uploads")) {
      cb(null, uploadsDir);
    }
  },
  filename: (req, file, cb) => {
    if (req.url.includes("upload-tutorial")) {
      cb(null, "tutorial-recording.webm");
    } else if (req.url.includes("uploads")) {
      cb(null, file.originalname);
    }
  },
});

const upload = multer({ storage: storage });
dotenv.config();

const getDatabase = async () => {
  try {
    return await getDb();
  } catch (error) {
    throw new Error("Failed to connect to database");
  }
};

getDatabase();

const app: Application = express();
const vapidkeys = webPush.generateVAPIDKeys();
let subscriptions: any[] = [];

webPush.setVapidDetails(
  "mailto:m.ferozmirza2005@gmail.com",
  vapidkeys.publicKey,
  vapidkeys.privateKey
);

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  })
);

const server: HTTPServer = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req: Request, res: Response): void => {
  res.send("Hello World! from server.");
});

app.get("/vapidkeys", (req: Request, res: Response) => {
  res.status(200).json({ keys: vapidkeys });
});

app.post("/api/subscribe", (req: Request, res: Response) => {
  const subscriptionData = req.body;
  let exist = false;
  subscriptions.map((subscribData) => {
    if (subscriptionData.userId === subscribData.userId) {
      subscribData.subscription = subscriptionData.subscription;
      exist = true;
    }
  });
  if (exist === false) {
    subscriptions.push(subscriptionData);
  }
  res.status(200).json({ message: "Subscription received" });
});

app.post("/api/sendNotification", (req, res) => {
  const { _id, title, body, type, icon, badge } = req.body;

  const notificationPayload = {
    title,
    body,
    type,
    icon,
    badge,
  };

  Promise.all(
    subscriptions.map((subscriptionData) => {
      if (_id === subscriptionData.userId) {
        return webPush.sendNotification(
          subscriptionData.subscription,
          JSON.stringify(notificationPayload)
        );
      }
    })
  )
    .then(() => {
      res.status(200).json({ message: "Notification sent successfully" });
    })
    .catch((error) => {
      console.error("Error sending notification:", error);
      res.status(500).json({ error: "Error sending notification" });
    });
});

app.use("/api", routes);

async function mergeAudioFiles(audioFilePaths: string[]) {
  const outputFilePaths: string[] = [];

  try {
    for (const [index, filePath] of audioFilePaths.entries()) {
      const outputFilePath = path.join(uploadsDir, `output_${index}.mp3`);

      await new Promise<void>((resolve, reject) => {
        Ffmpeg(filePath)
          .audioCodec("libmp3lame")
          .toFormat("mp3")
          .save(outputFilePath)
          .on("end", () => {
            outputFilePaths.push(outputFilePath);
            resolve();
          })
          .on("error", (err) => {
            reject(err);
          });
      });
    }

    const fileListPath = path.join(uploadsDir, "audioslist.txt");
    const fileListContent = outputFilePaths
      .map((file) => path.resolve(file))
      .join("\n");
    fs.writeFileSync(fileListPath, fileListContent);

    const python = os.type() === "Linux" ? "python3" : "python";
    const command = `${python} ./src/merge.py`;
    await new Promise<void>((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(`Error: ${stderr || stdout}`);
          return;
        }
        resolve();
      });
    });

    fs.unlinkSync(fileListPath);
    audioFilePaths.forEach((audioFilePath) => fs.unlinkSync(audioFilePath));
    outputFilePaths.forEach((outputFilePath) => fs.unlinkSync(outputFilePath));
  } catch (error) {
    console.error("Error in merging audio files:", error);
  }
}

async function generateThumbnail(thumbnailPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const videoPath = path.join(tutorialsDir, "tutorial-recording.webm");

    Ffmpeg(videoPath)
      .on("end", () => {
        resolve(thumbnailPath);
      })
      .on("error", (err) => {
        reject(err);
      })
      .screenshots({
        count: 1,
        folder: thumbnailsDir,
        filename: thumbnailPath,
        size: "320x240",
        timemarks: ["00:00:01.000"],
      });
  });
}

async function convertWebmToMp4(outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const videoPath = path.join(tutorialsDir, "tutorial-recording.webm");

    Ffmpeg(videoPath)
      .output(outputPath)
      // .output(path.join(tutorialsDir, "output.mp4"))
      .videoCodec("libx264")
      .audioCodec("aac")
      .on("end", () => {
        fs.unlink(videoPath, (err) => {
          if (err) console.error(`Error deleting file: ${videoPath}`, err);
        });
        resolve(outputPath);
        // resolve(path.join(tutorialsDir, "output.mp4"));
      })
      .on("error", (err) => {
        reject(err);
      })
      .run();
  });
}

// async function EnhanceVideoQuality(outputPath: string): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const videoPath = path.join(tutorialsDir, "output.mp4");

//     Ffmpeg(videoPath)
//       .output(outputPath)
//       .videoBitrate("5000k")
//       .size("1920x1080")
//       .outputOptions(["-preset fast", "-crf 18", "-vf unsharp=5:5:0.7:5:5:0.0"])
//       .on("end", async () => {
//         try {
//           await fs.promises.unlink(videoPath);
//           resolve(outputPath);
//         } catch (err) {
//           console.error(`Error deleting file: ${videoPath}`, err);
//           reject(`Error deleting temporary file: ${videoPath}`);
//         }
//       })
//       .on("error", (err: Error) => {
//         reject(`Error during video conversion/enhancement: ${err.message}`);
//       })
//       .run();
//   });
// }

app.post(
  "/upload-tutorial/",
  upload.fields([{ name: "video" }]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.body.userId;
      const tutName: string = req.body.tutName;

      const randomId = randomBytes(12).toString("hex");
      const currentDate = new Date();

      const outputPath = path.join(tutorialsDir, `${randomId}.mp4`);
      const thumbnailPath = `${randomId}.jpg`;

      await generateThumbnail(thumbnailPath);

      const db = await getDatabase();

      await db.collection("tutorial-recordings").insertOne({
        _id: new ObjectId(),
        tutName: tutName,
        thumbnail: thumbnailPath,
        tutorId: new ObjectId(userId),
        filePath: path.basename(outputPath),
        timeStamp: currentDate.toISOString(),
      });

      await convertWebmToMp4(outputPath);
      // await EnhanceVideoQuality(outputPath);

      res.status(200).send("Tutorial saved successfully.");
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
);

app.get("/tutorial-recordings/:userId", async (req, res) => {
  const userId: ObjectId = new ObjectId(req.params.userId as string);

  try {
    const db = await getDatabase();

    const results = await db
      .collection("tutorial-recordings")
      .find({ tutorId: userId })
      .toArray();

    res.json(results);
  } catch (error) {
    console.error("Error fetching tutorial recordings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/tutorial-recordings/download/:filename", (req, res) => {
  const { filename } = req.params;
  const videoPath = path.join(tutorialsDir, filename);
  res.sendFile(videoPath, (err) => {
    if (err) {
      res.status(500).end();
    }
  });
});

app.post("/tutorial-recordings/edit/", async (req, res) => {
  const { tutId, updatedName }: { tutId: string; updatedName: string } =
    req.body;

  const db = await getDatabase();

  try {
    db.collection("tutorial-recordings").updateOne(
      {
        _id: new ObjectId(tutId),
      },
      { $set: { tutName: updatedName } }
    );
    res.status(200).send("TutName updated successfully!");
  } catch (err) {
    console.log(tutId, updatedName);
  }
});

app.post("/tutorial-recordings/delete/", async (req, res) => {
  const { filename } = req.body;

  fs.unlink(path.join(tutorialsDir, filename), (err) => {
    if (err) console.error(`Error deleting file: ${filename}`, err);
  });

  fs.unlink(
    path.join(thumbnailsDir, filename.replace(".mp4", ".jpg")),
    (err) => {
      if (err) console.error(`Error deleting file: ${filename}`, err);
    }
  );

  const db = await getDatabase();

  db.collection("tutorial-recordings").deleteOne({ filePath: filename });

  res.status(200).send("Recording Deleted successfully!");
});

app.post("/uploads/", upload.any(), async (req, res) => {
  if (!req.files) {
    return res.status(400).send("No file uploaded.");
  }

  const {
    senderId,
    receiverId,
    timeStamp,
  }: {
    senderId: string;
    receiverId: string;
    timeStamp: string;
  } = req.body;

  const files = req.files as Express.Multer.File[];

  const videoFile = files.find((file) => file.fieldname === "videoFile");
  if (!videoFile) {
    return res.status(400).send("Missing required video file.");
  }

  const videoFilePath = path.join(uploadsDir, videoFile.originalname);

  const audioFilePaths: string[] = [];

  files.map((file) => {
    if (file.fieldname.startsWith("audioFile-")) {
      audioFilePaths.push(path.join(uploadsDir, file.originalname));
    }
  });

  const cleanedFilePath = path.join(uploadsDir, "output.mp3");

  await mergeAudioFiles(audioFilePaths);

  try {
    const outputVideoFilePath = path.join(
      uploadsDir,
      `${videoFile.originalname.replace("video-", "")}`
    );

    await new Promise<void>((resolve, reject) => {
      Ffmpeg(videoFilePath)
        .addInput(cleanedFilePath)
        .outputOptions("-c:v copy")
        .save(outputVideoFilePath)
        .on("end", async () => {
          fs.unlink(videoFilePath, (err) => {
            if (err)
              console.error(`Error deleting file: ${videoFilePath}`, err);
          });
          fs.unlink(cleanedFilePath, (err) => {
            if (err)
              console.error(`Error deleting file: ${cleanedFilePath}`, err);
          });

          const db = await getDatabase();
          const videoPath = videoFile.originalname.replace("video-", "");

          const result = await db.collection("one-to-one-messages").insertOne({
            _id: new ObjectId(),
            senderId: new ObjectId(senderId),
            receiverId: new ObjectId(receiverId),
            filePath: videoPath,
            timeStamp,
            seen: false,
            type: "recording",
          });

          res.status(200).send({
            message: "Recording uploaded successfully.",
            recordingId: result.insertedId,
          });

          resolve();
        })
        .on("error", (err) => {
          console.error("Error processing video:", err);
          reject(err);
        });
    });
  } catch (error) {
    console.error("Processing error:", error);
    res.status(500).send("Error processing files.");
  }
});

app.get("/thumbnail/:filename", (req, res) => {
  const { filename } = req.params;
  const imgPath = path.join(thumbnailsDir, filename);
  res.sendFile(imgPath, (err) => {
    if (err) {
      res.status(500).end();
    }
  });
});

app.get("/recording/:filename", (req, res) => {
  const { filename } = req.params;
  const videoPath = path.join(uploadsDir, filename);
  res.sendFile(videoPath, (err) => {
    if (err) {
      res.status(500).end();
    }
  });
});

app.post("/recording/delete/", async (req, res) => {
  const { filename } = req.body;

  fs.unlink(path.join(uploadsDir, filename), (err) => {
    if (err) console.error(`Error deleting file: ${filename}`, err);
  });
  const db = await getDatabase();

  db.collection("one-to-one-messages").deleteOne({ filePath: filename });

  res.status(200).send("Recording Deleted successfully!");
});

const PORT: string | number = process.env.PORT || 5000;

server.setTimeout(0);
server.timeout = 0;
server.listen(PORT, (): void => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

io.on("connection", (socket: Socket) => {
  socket.on("calling", (data) => {
    socket.broadcast.emit("calling", data);
  });

  socket.on("ringing", (data) => {
    socket.broadcast.emit("ringing", data);
  });

  socket.on("accepting", (data) => {
    socket.broadcast.emit("accepting", data);
  });

  socket.on("declined", (data) => {
    socket.broadcast.emit("declined", data);
  });

  socket.on("receiver-busy", (data) => {
    socket.broadcast.emit("receiver-busy", data);
  });

  socket.on("change-event", (data) => {
    socket.broadcast.emit("change-event", data);
  });

  socket.on("recording", (data) => {
    io.emit("recording", data);
  });

  socket.on("recording-save", (data) => {
    io.emit("recording-save", data);
  });

  socket.on("recording-delete", (data) => {
    io.emit("recording-delete", data);
  });

  socket.on("one-to-one-message", (data) => {
    io.emit("one-to-one-message", data);
  });

  socket.on("one-to-one-delete", (data) => {
    io.emit("one-to-one-delete", data);
  });

  socket.on("one-to-one-edited", (data) => {
    io.emit("one-to-one-edited", data);
  });

  socket.on("message-read", (data) => {
    io.emit("message-read", data);
  });

  socket.on("offer", (offer) => {
    console.log("Broadcasting offer.");
    socket.broadcast.emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    console.log("Broadcasting answer.");
    socket.broadcast.emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate) => {
    console.log("Broadcasting ICE candidate.");
    socket.broadcast.emit("ice-candidate", candidate);
  });
});
