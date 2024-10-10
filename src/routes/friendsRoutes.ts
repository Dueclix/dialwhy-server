import FriendRequest from "../models/friendRequests";
import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/db";

const friendsRouter = Router();

const getDatabase = async () => {
  try {
    return await getDb();
  } catch (error) {
    throw new Error("Failed to connect to database");
  }
};

friendsRouter.get(
  "/v1/friends/:userId",
  async (req: Request, res: Response) => {
    try {
      const userId: string = req.params.userId;

      const db = await getDatabase();
      const friendRequests = await db
        .collection("friendRequests")
        .find({
          $or: [
            { requestUser: new ObjectId(userId) },
            { acceptUser: new ObjectId(userId) },
          ],
          accepted: true,
        })
        .toArray();

      if (friendRequests.length === 0) {
        return res.status(200).send("No friend found.");
      }

      const friendsPromises = friendRequests.map(async (friendRequest) => {
        let userIdToFind: ObjectId;

        if (friendRequest.requestUser.toString() === userId) {
          userIdToFind = new ObjectId(friendRequest.acceptUser as string);
        } else {
          userIdToFind = new ObjectId(friendRequest.requestUser as string);
        }

        const user = await db
          .collection("users")
          .findOne({ _id: userIdToFind });

        if (user) {
          return {
            _id: user._id,
            name: user.name,
            role: user.role,
            email: user.email,
            image: user?.image?.url,
            connectionId: friendRequest._id,
          };
        } else {
          console.log(`User with id ${userIdToFind} not found.`);
          return null;
        }
      });

      const friends = await Promise.all(friendsPromises);

      const validFriends = friends.filter((friend) => friend !== null);

      res.status(200).json(validFriends);
    } catch (error) {
      console.log(error);
      res.status(500).send("Error Occurred!");
    }
  }
);

friendsRouter.post(
  "/v1/friend/requested/",
  async (req: Request, res: Response) => {
    try {
      const requestUser: string = req.body.requestUser;
      const acceptUser: string = req.body.acceptUser;

      const db = await getDatabase();
      const result = await db.collection("friendRequests").findOne({
        $or: [
          {
            requestUser: new ObjectId(requestUser),
            acceptUser: new ObjectId(acceptUser),
          },
          {
            requestUser: new ObjectId(acceptUser),
            acceptUser: new ObjectId(requestUser),
          },
        ],
      });

      if (!result) {
        res.status(200).json({ exist: false });
        return;
      }

      res.status(200).json({ exist: true });
    } catch (error) {
      console.error(error);
      res.status(500).send("Error in send request");
    }
  }
);

friendsRouter.post(
  "/v1/friends/request",
  async (req: Request, res: Response) => {
    try {
      const requestUser = new ObjectId(req.body.requestUser as string);
      const acceptUser = new ObjectId(req.body.acceptUser as string);

      const db = await getDatabase();
      const friendRequests = await db.collection("friendRequests").findOne({
        $or: [
          { requestUser: requestUser, acceptUser: acceptUser },
          { acceptUser: requestUser, requestUser: acceptUser },
        ],
      });

      if(friendRequests) {
        res.status(409).send("Request already exist.");
        return;
      }

      const insertData: FriendRequest = {
        _id: new ObjectId(),
        requestUser: requestUser,
        acceptUser: acceptUser,
        accepted: false,
        ignored: false,
      };

      const result = await db
        .collection("friendRequests")
        .insertOne(insertData);

      if (!result.acknowledged) {
        res.status(403).send("Error occurred!");
        return;
      }

      res.status(200).send("Request send successfully.");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error in send request");
    }
  }
);

friendsRouter.post(
  "/v1/friends/response",
  async (req: Request, res: Response) => {
    try {
      const requestId: string = req.body.requestId;
      const status: boolean = req.body.status;

      const updatedReq = {
        accepted: false,
        ignored: false,
      };

      status === true
        ? (updatedReq.accepted = true)
        : (updatedReq.ignored = true);

      const db = await getDatabase();
      const result = await db.collection("friendRequests").updateOne(
        { _id: new ObjectId(requestId) },
        {
          $set: {
            ...updatedReq,
          },
        }
      );

      if (!result.acknowledged) {
        res.status(403).send("Error occurred!");
        return;
      }

      res.status(200).send("Request updated successfully.");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error in updating request.");
    }
  }
);

friendsRouter.get(
  "/v1/friends/requests/:userId",
  async (req: Request, res: Response) => {
    try {
      const acceptUser: string = req.params.userId;

      const db = await getDatabase();
      const requests = await db
        .collection("friendRequests")
        .find({
          acceptUser: new ObjectId(acceptUser),
          accepted: false,
          ignored: false,
        })
        .toArray();

      if (requests.length === 0) {
        return res.send("No request got.");
      }

      const userPromises = requests.map(async (request) => {
        const user = await db.collection("users").findOne({
          _id: new ObjectId(request?.requestUser as string),
        });

        return {
          requestId: request._id,
          _id: user?._id,
          name: user?.name,
          role: user?.role,
          email: user?.email,
          image: user?.image?.url,
        };
      });

      const requestUsers = await Promise.all(userPromises);

      res.status(200).json(requestUsers);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error retrieving data.");
    }
  }
);

friendsRouter.get(
  "/v1/friends/remove/:connectionId",
  async (req: Request, res: Response) => {
    try {
      const connectionId: string = req.params.connectionId;

      const db = await getDatabase();
      const requests = await db
        .collection("friendRequests")
        .deleteOne({ _id: new ObjectId(connectionId) });

      res.status(200).json("Friend removed successfully.");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error retrieving data.");
    }
  }
);

export default friendsRouter;
