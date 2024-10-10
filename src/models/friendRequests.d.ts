import { ObjectId } from "mongodb";

export default interface FriendRequest {
    _id: ObjectId,
    requestUser: ObjectId,
    acceptUser: ObjectId,
    accepted: boolean,
    ignored: boolean
}