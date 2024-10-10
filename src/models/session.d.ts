import { ObjectId } from "mongodb";

export default interface Session {
    _id: ObjectId,
    userId: ObjectId,
    sessionId: string,
}