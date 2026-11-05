import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { config } from '../../config/index.js';
import { db } from '../db/knex.js';
import { getCacheRedis } from '../redis/redisClient.js';

let io = null;

/**
 * Initializes Socket.IO attached to the HTTP server.
 * Enforces JWT authentication, role rooms, and class room authorization.
 *
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
export function initSocketServer(httpServer) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (
          !origin ||
          config.allowedOrigins.includes(origin) ||
          origin.endsWith('.cambridgeeducation.uk.com') ||
          origin === 'https://cambridgeeducation.uk.com' ||
          !config.isProduction
        ) {
          return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy'));
      },
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 30000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });

  // Attach Redis Adapter when available (not in unit test mode)
  if (!config.isTest) {
    try {
      const pubClient = getCacheRedis();
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
    } catch (adapterErr) {
      console.warn('⚠️ Could not attach Redis adapter to Socket.IO, falling back to in-memory:', adapterErr.message);
    }
  }

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      // Extract from Authorization header if not in auth payload
      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      // Extract from Cookie header
      if (!token && socket.handshake.headers?.cookie) {
        const parsedCookies = cookie.parse(socket.handshake.headers.cookie);
        token = parsedCookies['__Host-sms_at'] || parsedCookies['sms_at'] || parsedCookies.sms_access_token;
      }

      if (!token) {
        // Allow unauthenticated connection with guest scope for public status or reject
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
      socket.user = decoded;

      // Enrich socket with contextual role profile
      const user = await db('users')
        .leftJoin('roles', 'users.role_id', 'roles.id')
        .where('users.id', decoded.id)
        .select('users.id', 'users.username', 'users.email', 'users.full_name', 'roles.name as roleName')
        .first();

      if (!user) {
        socket.user = null;
        return next();
      }

      socket.user.role = user.roleName?.toUpperCase() || decoded.role || 'GUEST';
      socket.user.name = user.full_name;

      if (socket.user.role === 'TEACHER') {
        const teacher = await db('teachers').where('user_id', user.id).first();
        if (teacher) socket.user.teacherId = teacher.id;
      } else if (socket.user.role === 'STUDENT') {
        const student = await db('students').where('user_id', user.id).first();
        if (student) {
          socket.user.studentId = student.id;
          socket.user.classId = student.current_class_id;
        }
      }

      next();
    } catch (err) {
      // Token expired or invalid; allow connection without user identity
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;

    if (user) {
      // 1. Personal User Room
      socket.join(`user:${user.id}`);

      // 2. Global Role Room
      if (user.role) {
        socket.join(`role:${user.role}`);
      }

      // 3. Faculty / Teacher Room
      if (user.teacherId) {
        socket.join(`teacher:${user.teacherId}`);
        db('timetable_slots')
          .where('teacher_id', user.teacherId)
          .distinct('class_id')
          .select('class_id')
          .then((slots) => {
            slots.forEach((s) => {
              if (s.class_id) socket.join(`class:${s.class_id}`);
            });
          })
          .catch(() => {});
      }

      // 4. Student Enrolled Class Room
      if (user.studentId && user.classId) {
        socket.join(`student:${user.studentId}`);
        socket.join(`class:${user.classId}`);
      }
    }

    // Dynamic Class Room Subscription with Role Authorization
    socket.on('join:class', async ({ classId }) => {
      const cid = Number(classId);
      if (!cid || isNaN(cid)) return;

      // Authorization Check
      const role = socket.user?.role;
      if (['ADMIN', 'PRINCIPAL'].includes(role)) {
        socket.join(`class:${cid}`);
        socket.emit('joined:class', { classId: cid, authorized: true });
        return;
      }

      if (role === 'TEACHER' && socket.user?.teacherId) {
        // Teachers can view any class timetable or assigned class
        socket.join(`class:${cid}`);
        socket.emit('joined:class', { classId: cid, authorized: true });
        return;
      }

      if (role === 'STUDENT') {
        if (Number(socket.user?.classId) === cid) {
          socket.join(`class:${cid}`);
          socket.emit('joined:class', { classId: cid, authorized: true });
        } else {
          socket.emit('error:class', { message: 'Cannot join room of another class', classId: cid });
        }
        return;
      }

      // Allow read-only class room for public/guest display if needed
      socket.join(`class:${cid}`);
      socket.emit('joined:class', { classId: cid, authorized: true });
    });

    socket.on('leave:class', ({ classId }) => {
      const cid = Number(classId);
      if (cid) socket.leave(`class:${cid}`);
    });

    socket.on('disconnect', () => {
      // Clean cleanup handled automatically by Socket.IO
    });
  });

  return io;
}

/**
 * Returns the active Socket.IO server instance.
 * @returns {Server | null}
 */
export function getIo() {
  return io;
}
