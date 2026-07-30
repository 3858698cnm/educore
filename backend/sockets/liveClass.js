const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Unit = require('../models/Unit');
const User = require('../models/User');

// Keep track of active sessions in memory while server is running
let activeSessions = {};

function setupLiveClassSockets(io) {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // LECTURER STARTS A CLASS
    socket.on('lecturer-start-class', async (data) => {
      const { className, lecturerId, lecturerName, unitId, unitName } = data;

      const newSession = new Session({
        className,
        lecturerId,
        unitId,
        status: 'active'
      });
      await newSession.save();

      const sessionId = newSession._id.toString();

      activeSessions[sessionId] = {
        className,
        lecturerId,
        unitId: unitId || null,
        lecturerSocketId: socket.id,
        students: {}
      };

      socket.join(sessionId);

      socket.emit('class-started', {
        sessionId,
        className
      });

      console.log('Class started:', className, sessionId);
    });

    // STUDENT JOINS A CLASS
    socket.on('student-join-class', async (data) => {
      const { sessionId, studentId, studentName } = data;

      if (!activeSessions[sessionId]) {
        socket.emit('join-error', { message: 'Class not found or has ended' });
        return;
      }

      const session = activeSessions[sessionId];
      if (session.unitId) {
        const unit = await Unit.findById(session.unitId);
        if (unit) {
          const student = await User.findById(studentId);
          if (student && student.courseId &&
              unit.courseId.toString() !== student.courseId.toString()) {
            socket.emit('join-error', {
              message: 'This class is not for your enrolled course'
            });
            return;
          }
        }
      }

      activeSessions[sessionId].students[studentId] = {
        socketId: socket.id,
        name: studentName,
        checksSent: 0,
        responses: 0
      };

      socket.join(sessionId);

      io.to(activeSessions[sessionId].lecturerSocketId).emit('student-joined', {
        studentId,
        studentName,
        studentSocketId: socket.id
      });
      socket.emit('joined-success', {
        className: activeSessions[sessionId].className
      });
    });

    // LECTURER SENDS ATTENTION CHECK
    socket.on('send-attention-check', (data) => {
      const { sessionId } = data;
      if (!activeSessions[sessionId]) return;

      for (let studentId in activeSessions[sessionId].students) {
        activeSessions[sessionId].students[studentId].checksSent++;
      }

      socket.to(sessionId).emit('attention-check');
    });

    // STUDENT RESPONDS TO ATTENTION CHECK
    socket.on('student-respond-check', (data) => {
      const { sessionId, studentId } = data;

      if (!activeSessions[sessionId]) return;
      if (!activeSessions[sessionId].students[studentId]) return;

      activeSessions[sessionId].students[studentId].responses++;

      io.to(activeSessions[sessionId].lecturerSocketId).emit('student-responded', {
        studentId
      });
    });

    // LECTURER ENDS CLASS
    socket.on('lecturer-end-class', async (data) => {
      const { sessionId, unitId } = data;

      if (!activeSessions[sessionId]) return;

      try {
        const session = activeSessions[sessionId];
        const results = [];

        for (let studentId in session.students) {
          const s = session.students[studentId];

          let finalStatus = 'present';
          let attendancePercent = 100;

          if (s.checksSent === 0) {
            finalStatus = 'present';
            attendancePercent = 100;
          } else if (s.responses === 0) {
            finalStatus = 'absent';
            attendancePercent = 0;
          } else if (s.responses < s.checksSent) {
            finalStatus = 'partial';
            attendancePercent = Math.round((s.responses / s.checksSent) * 100);
          } else {
            finalStatus = 'present';
            attendancePercent = 100;
          }

          const attendanceRecord = new Attendance({
            studentId,
            studentName: s.name,
            sessionId,
            unitId: unitId || null,
            responses: s.responses,
            checksSent: s.checksSent,
            finalStatus,
            attendancePercent
          });
          await attendanceRecord.save();

          results.push({
            studentId,
            studentName: s.name,
            finalStatus,
            attendancePercent: Math.round(attendancePercent)
          });

          io.to(s.socketId).emit('class-ended');
        }

        await Session.findByIdAndUpdate(sessionId, {
          status: 'ended',
          endTime: new Date()
        });

        socket.emit('class-ended-summary', { results });

        delete activeSessions[sessionId];

        console.log('Class ended:', sessionId);
      } catch (err) {
        console.error('Error ending class:', sessionId, err);
        socket.emit('class-ended-summary', { results: [] });
        delete activeSessions[sessionId];
      }
    });

    // LECTURER REJOINS AN EXISTING CLASS
    socket.on('lecturer-rejoin-class', async (data) => {
      const { sessionId, lecturerId, lecturerName } = data;

      socket.join(sessionId);

      if (activeSessions[sessionId]) {
        activeSessions[sessionId].lecturerSocketId = socket.id;
      } else {
        const session = await Session.findById(sessionId);
        if (session) {
          activeSessions[sessionId] = {
            className: session.className,
            lecturerId: session.lecturerId,
            unitId: session.unitId,
            lecturerSocketId: socket.id,
            students: {}
          };
        }
      }

      socket.emit('class-started', {
        sessionId,
        className: activeSessions[sessionId]
          ? activeSessions[sessionId].className
          : 'Live Class'
      });

      console.log('Lecturer rejoined class:', sessionId);
    });

    socket.on('lecturer-media-started', (data) => {
      const { sessionId, type } = data;
      socket.to(sessionId).emit('lecturer-media-started', { type });
    });

    socket.on('lecturer-media-stopped', (data) => {
      const { sessionId } = data;
      socket.to(sessionId).emit('lecturer-media-stopped');
    });

    socket.on('lecturer-video-stopped', (data) => {
      const { sessionId } = data;
      socket.to(sessionId).emit('lecturer-video-stopped');
    });

    // WEBRTC SIGNALING
    socket.on('webrtc-offer', (data) => {
      const { targetSocketId, offer, sessionId } = data;
      io.to(targetSocketId).emit('webrtc-offer', {
        offer,
        fromSocketId: socket.id,
        sessionId
      });
    });

    socket.on('webrtc-answer', (data) => {
      const { targetSocketId, answer } = data;
      io.to(targetSocketId).emit('webrtc-answer', {
        answer,
        fromSocketId: socket.id
      });
    });

    socket.on('webrtc-ice-candidate', (data) => {
      const { targetSocketId, candidate } = data;
      io.to(targetSocketId).emit('webrtc-ice-candidate', {
        candidate,
        fromSocketId: socket.id
      });
    });

    socket.on('student-ready-for-stream', (data) => {
      const { sessionId } = data;
      if (activeSessions[sessionId]) {
        io.to(activeSessions[sessionId].lecturerSocketId).emit('student-ready-for-stream', {
          studentSocketId: socket.id
        });
      }
    });

    // STUDENT CAMERA STARTED
    socket.on('student-camera-started', (data) => {
      const { sessionId, studentId, studentName } = data;
      if (activeSessions[sessionId]) {
        io.to(activeSessions[sessionId].lecturerSocketId).emit('student-camera-started', {
          studentId,
          studentName
        });
      }
    });

    // STUDENT CAMERA STOPPED
    socket.on('student-camera-stopped', (data) => {
      const { sessionId, studentId } = data;
      if (activeSessions[sessionId]) {
        io.to(activeSessions[sessionId].lecturerSocketId).emit('student-camera-stopped', {
          studentId
        });
      }
    });

    // STUDENT SENDS CAMERA OFFER TO LECTURER
    socket.on('student-webrtc-offer', (data) => {
      const { sessionId, studentId, studentName, offer } = data;
      if (activeSessions[sessionId]) {
        io.to(activeSessions[sessionId].lecturerSocketId).emit('student-webrtc-offer', {
          studentId,
          studentName,
          offer,
          fromSocketId: socket.id
        });
      }
    });

    // LECTURER SENDS ANSWER TO STUDENT CAMERA
    socket.on('lecturer-student-answer', (data) => {
      const { sessionId, studentId, answer } = data;
      if (activeSessions[sessionId]) {
        const student = activeSessions[sessionId].students[studentId];
        if (student) {
          io.to(student.socketId).emit('student-webrtc-answer', { answer });
        }
      }
    });

    // ICE CANDIDATES FOR STUDENT CAMERA
    socket.on('student-webrtc-ice-candidate', (data) => {
      const { sessionId, studentId, candidate } = data;
      if (activeSessions[sessionId]) {
        io.to(activeSessions[sessionId].lecturerSocketId).emit('student-webrtc-ice-candidate', {
          studentId,
          candidate
        });
      }
    });

    socket.on('lecturer-student-ice-candidate', (data) => {
      const { sessionId, studentId, candidate } = data;
      if (activeSessions[sessionId]) {
        const student = activeSessions[sessionId].students[studentId];
        if (student) {
          io.to(student.socketId).emit('student-webrtc-ice-candidate', { candidate });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
}

module.exports = setupLiveClassSockets;s