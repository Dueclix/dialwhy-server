import { Router, Request, Response } from "express";
import CallData from "../models/calls";
const callsRouter = Router();

const callsData: { [key: string]: CallData } = {};

callsRouter.post("/v1/call/register", (req: Request, res: Response) => {
  const callId: string = req.body.callId;
  const callType: string = req.body.callType;
  const creatorId: string = req.body.creatorId;
  const receivers: string | Array<string> = req.body.receivers;

  callsData[callId] = {
    creatorId: creatorId,
    receivers: receivers,
    type: callType,
  };

  res.status(200).send("Call registered successfully.");
});

callsRouter.get("/v1/call/:callId", (req: Request, res: Response) => {
  const callId: string = req.params.callId;

  if (!(callsData[callId])) {
    return res.status(404).send("Call data not found.");
  }

  res.status(200).json(callsData[callId]);
});

export default callsRouter;
