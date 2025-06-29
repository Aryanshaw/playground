import express from 'express';
import { router } from './routes';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ['*'], // Add your frontend URLs
    credentials: false, // This allows cookies and credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

const server = createServer(app);
const io = new Server(server);
app.set('io', io);

io.on('connection', socket => {
  console.log('a user connected');

  //a custom evenet
  socket.on('message', data => {
    console.log(`Message recieved: `, data);
    socket.emit('message', `Server recived: ${data}`);
  });

  //handel disconnection
  socket.on('disconnect', () => {
    console.log(`A user disconnected: `, socket.id);
  });
});

app.use('/v1', router);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
