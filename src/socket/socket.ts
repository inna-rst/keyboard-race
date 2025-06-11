import { type Server } from "socket.io";
import { setupSocketEvents } from "./helpers/socket-events.js";


const socketHandler = (io: Server): void => {
    io.on("connection", (socket) => {
        setupSocketEvents(io, socket);
    });
};

export { socketHandler };
