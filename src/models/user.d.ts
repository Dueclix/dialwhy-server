import { ObjectId } from "mongodb";

interface User {
    _id: ObjectId;
    name: string;
    email: string;
    pwd: string;
    hashed: string
}

export default User;