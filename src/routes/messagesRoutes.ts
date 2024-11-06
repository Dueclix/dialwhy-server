import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/db";

const messagesRouter = Router();

const getDatabase = async () => {
  try {
    return await getDb();
  } catch (error) {
    throw new Error("Failed to connect to database");
  }
};

messagesRouter.post(
  "/v1/message/one-to-one/send",
  async (req: Request, res: Response) => {
    try {
      const {
        senderId,
        receiverId,
        message,
        seen,
      }: {
        senderId: string;
        receiverId: string;
        message: string;
        seen: boolean;
      } = req.body;

      const db = await getDatabase();

      const currentDate = new Date();
      const data = await db.collection("one-to-one-messages").insertOne({
        _id: new ObjectId(),
        senderId: new ObjectId(senderId),
        receiverId: new ObjectId(receiverId),
        message,
        timeStamp: currentDate.toISOString(),
        seen,
        type: "message",
      });

      res.status(200).json(data.insertedId);
    } catch (error) {
      console.log(error);
      res.status(500).send("Error Occurred!");
    }
  }
);

messagesRouter.get(
  "/v1/message/one-to-one/change-status/:messageId",
  async (req: Request, res: Response) => {
    try {
      const messageId: string = req.params.messageId;
      const db = await getDatabase();

      await db
        .collection("one-to-one-messages")
        .updateOne({ _id: new ObjectId(messageId) }, { $set: { seen: true } });

      res.status(200).send("status updated successfully.");
    } catch (error) {
      console.log(error);
      res.status(500).send("Error Occurred!");
    }
  }
);

messagesRouter.get(
  "/v1/messages/one-to-one/:userId",
  async (req: Request, res: Response) => {
    try {
      const userId: string = req.params.userId;

      const db = await getDatabase();
      const messages = await db
        .collection("one-to-one-messages")
        .find({
          $or: [
            { senderId: new ObjectId(userId) },
            { receiverId: new ObjectId(userId) },
          ],
        })
        .toArray();

      res.status(200).json(messages);
    } catch (error) {
      console.log(error);
      res.status(500).send("Error Occurred!");
    }
  }
);

messagesRouter.post(
  "/v1/message/one-to-one/edit",
  async (req: Request, res: Response) => {
    try {
      const messageId: string = req.body.messageId;
      const updatedMessage: string = req.body.updatedMessage;

      const db = await getDatabase();
      const result = await db
        .collection("one-to-one-messages")
        .updateOne(
          { _id: new ObjectId(messageId) },
          { $set: { message: updatedMessage } }
        );

      res.status(200).json("Message deleted successfully.");
    } catch (error) {
      console.log(error);
      res.status(500).send("Error Occurred!");
    }
  }
);

messagesRouter.post(
  "/v1/message/one-to-one/delete",
  async (req: Request, res: Response) => {
    try {
      const messageId: string = req.body.messageId;

      const db = await getDatabase();
      const result = await db
        .collection("one-to-one-messages")
        .deleteOne({ _id: new ObjectId(messageId) });

      res.status(200).json("Message deleted successfully.");
    } catch (error) {
      console.log(error);
      res.status(500).send("Error Occurred!");
    }
  }
);

export default messagesRouter;
