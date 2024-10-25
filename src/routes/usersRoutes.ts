import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/db";
import multer from "multer";

const userRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

const getDatabase = async () => {
  try {
    return await getDb();
  } catch (error) {
    throw new Error("Failed to connect to database");
  }
};

userRouter.get(
  "/v1/users/",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const db = await getDatabase();
      const users = await db.collection("users").find({}).toArray();
      res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error retrieving users" });
    }
  }
);

userRouter.post(
  "/v1/user/userId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id: string = req.body.userId;
      const db = await getDatabase();
      const user = await db
        .collection("users")
        .findOne({ _id: new ObjectId(id) });
      const sendData = {
        _id: user?._id,
        name: user?.name,
        role: user?.role,
        email: user?.email,
        image: user?.image?.url,
      };
      res.json(sendData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error retrieving user" });
    }
  }
);

userRouter.post(
  "/v1/user/email",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const email = req.body.email;
      const userId = req.body.userId;
      const db = await getDatabase();
      const user = await db
        .collection("users")
        .findOne({ _id: { $ne: userId }, email: email });
      const sendData = {
        _id: user?._id,
        name: user?.name,
        role: user?.role,
        email: user?.email,
        image: user?.image?.url,
      };
      res.json(sendData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error retrieving user" });
    }
  }
);

export default userRouter;
