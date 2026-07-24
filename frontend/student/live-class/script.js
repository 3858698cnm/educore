const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
const studentName = localStorage.getItem('name');
const studentId = localStorage.getItem('userId');

if (!token || role !== 'student') {
  window.location.href = '/login';
}

const socket = io();

let currentSessionId = null;
let checksReceived = 0;
let checksResponded = 0;
let popupTimer = null;

// WebRTC - receiving lecturer stream
let peerConnection = null;

// WebRTC - sending student camera
let studentStream = null;
let studentPeerConnection = null;
let isStudentCameraOn = false;
let isStudentMicOn = false;

const iceConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const joinBox = document.getElementById('joinBox');
const inClassBox = document.getElementById('inClassBox');
const endedBox = document.getElementById('endedBox');
const popupOverlay = document.getElementById('popupOverlay');
const remoteVideo = document.getElementById('remoteVideo');
const studentLocalVideo = document.getElementById('studentLocalVideo');

// Check URL for session ID
const urlParams = new URLSearchParams(window.location.search);
const sessionFromUrl = urlParams.get('session');

if (sessionFromUrl) {
  document.getElementById('sessionId').value = sessionFromUrl;
  currentSessionId = sessionFromUrl;
  socket.emit('student-join-class', {
    sessionId: sessionFromUrl,
    studentId,
    studentName
  });
}

// JOIN MANUALLY
document.getElementById('joinBtn').addEventListener('click', function() {
  const sessionId = document.getElementById('sessionId').value.trim();
  if (!sessionId) {
    document.getElementById('joinMessage').textContent = 'Please enter a Session ID';
    return;
  }
  currentSessionId = sessionId;
  socket.emit('student-join-class', { sessionId, studentId, studentName });
});

// JOIN SUCCESS
socket.on('joined-success', function(data) {
  document.getElementById('className').textContent = data.className;
  document.getElementById('classInfoName').textContent = '📖 ' + data.className;
  joinBox.classList.add('hidden');
  inClassBox.classList.remove('hidden');
});

// JOIN ERROR
socket.on('join-error', function(data) {
  document.getElementById('joinMessage').textContent = data.message;
  document.getElementById('joinMessage').style.color = '#ef4444';
});

// ==================
// RECEIVING LECTURER STREAM
// ==================

socket.on('lecturer-media-started', function(data) {
  console.log('Lecturer started media');
  document.getElementById('noStreamMsg').style.display = 'none';
  socket.emit('student-ready-for-stream', {
    sessionId: currentSessionId,
    studentSocketId: socket.id
  });
});

socket.on('lecturer-media-stopped', function() {
  if (remoteVideo.srcObject) remoteVideo.srcObject = null;
  document.getElementById('noStreamMsg').style.display = 'flex';
  if (peerConnection) { peerConnection.close(); peerConnection = null; }
});

socket.on('webrtc-offer', async (data) => {
  console.log('Received offer from lecturer');
  const { offer, fromSocketId } = data;

  if (peerConnection) peerConnection.close();
  peerConnection = new RTCPeerConnection(iceConfig);

  peerConnection.ontrack = (event) => {
    console.log('Received lecturer stream!');
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      document.getElementById('noStreamMsg').style.display = 'none';
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', {
        targetSocketId: fromSocketId,
        candidate: event.candidate
      });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('Lecturer stream state:', peerConnection.connectionState);
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('webrtc-answer', {
    targetSocketId: fromSocketId,
    answer: peerConnection.localDescription
  });
});

socket.on('webrtc-ice-candidate', async (data) => {
  const { candidate } = data;
  if (peerConnection && candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.log('ICE error:', err);
    }
  }
});

// ==================
// STUDENT CAMERA - SENDING TO LECTURER
// ==================

// Toggle student camera
document.getElementById('studentCameraBtn').addEventListener('click', async function() {
  if (!isStudentCameraOn) {
    try {
      studentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      studentStream.getAudioTracks().forEach(track => {
        track.enabled = isStudentMicOn;
      });

      studentLocalVideo.srcObject = studentStream;
      studentLocalVideo.classList.remove('hidden');
      isStudentCameraOn = true;
      this.textContent = '📹 Camera Off';
      this.classList.add('active');

      socket.emit('student-camera-started', {
        sessionId: currentSessionId,
        studentId,
        studentName
      });

      await createStudentPeerConnection();

    } catch (err) {
      alert('Could not access camera. Please check permissions.');
    }
  } else {
    stopStudentCamera();
  }
});

// Toggle student mic
document.getElementById('studentMicBtn').addEventListener('click', function() {
  if (!studentStream) {
    alert('Turn on your camera first to enable audio');
    return;
  }

  isStudentMicOn = !isStudentMicOn;
  studentStream.getAudioTracks().forEach(track => {
    track.enabled = isStudentMicOn;
  });

  this.textContent = isStudentMicOn ? '🎤 Mic Off' : '🎤 Turn On Mic';
  this.classList.toggle('active', isStudentMicOn);
});

// Create peer connection to send student camera to lecturer
async function createStudentPeerConnection() {
  if (studentPeerConnection) {
    studentPeerConnection.close();
  }

  studentPeerConnection = new RTCPeerConnection(iceConfig);

  // Add student stream tracks
  if (studentStream) {
    studentStream.getTracks().forEach(track => {
      studentPeerConnection.addTrack(track, studentStream);
    });
  }

  studentPeerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('student-webrtc-ice-candidate', {
        sessionId: currentSessionId,
        studentId,
        candidate: event.candidate
      });
    }
  };

  studentPeerConnection.onconnectionstatechange = () => {
    console.log('Student camera state:', studentPeerConnection.connectionState);
  };

  // Create offer and send to lecturer
  const offer = await studentPeerConnection.createOffer();
  await studentPeerConnection.setLocalDescription(offer);

  socket.emit('student-webrtc-offer', {
    sessionId: currentSessionId,
    studentId,
    studentName,
    offer: studentPeerConnection.localDescription
  });
}

// Receive answer from lecturer for student camera
socket.on('student-webrtc-answer', async (data) => {
  console.log('Received answer from lecturer for student camera');
  const { answer } = data;
  if (studentPeerConnection) {
    await studentPeerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  }
});

// Receive ICE candidates from lecturer
socket.on('student-webrtc-ice-candidate', async (data) => {
  const { candidate } = data;
  if (studentPeerConnection && candidate) {
    try {
      await studentPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.log('Student ICE error:', err);
    }
  }
});

function stopStudentCamera() {
  if (studentStream) {
    studentStream.getTracks().forEach(t => t.stop());
    studentStream = null;
  }
  if (studentPeerConnection) {
    studentPeerConnection.close();
    studentPeerConnection = null;
  }
  studentLocalVideo.srcObject = null;
  studentLocalVideo.classList.add('hidden');
  isStudentCameraOn = false;
  isStudentMicOn = false;

  document.getElementById('studentCameraBtn').textContent = '📹 Turn On Camera';
  document.getElementById('studentCameraBtn').classList.remove('active');
  document.getElementById('studentMicBtn').textContent = '🎤 Turn On Mic';
  document.getElementById('studentMicBtn').classList.remove('active');

  socket.emit('student-camera-stopped', {
    sessionId: currentSessionId,
    studentId
  });
}

// ==================
// ATTENTION CHECK
// ==================

socket.on('attention-check', function() {
  checksReceived++;
  document.getElementById('checksReceived').textContent = checksReceived;
  document.getElementById('attChecks').textContent = checksReceived;
  updateAttendanceRate();

  if (popupTimer) clearInterval(popupTimer);
  popupOverlay.classList.remove('hidden');

  let timeLeft = 30;
  document.getElementById('timer').textContent = timeLeft;

  popupTimer = setInterval(function() {
    timeLeft--;
    document.getElementById('timer').textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(popupTimer);
      popupOverlay.classList.add('hidden');
    }
  }, 1000);
});

document.getElementById('respondBtn').addEventListener('click', function() {
  clearInterval(popupTimer);
  popupOverlay.classList.add('hidden');

  checksResponded++;
  document.getElementById('checksResponded').textContent = checksResponded;
  document.getElementById('attResponded').textContent = checksResponded;
  updateAttendanceRate();

  socket.emit('student-respond-check', {
    sessionId: currentSessionId,
    studentId
  });
});

function updateAttendanceRate() {
  if (checksReceived === 0) {
    document.getElementById('attPercent').textContent = '100%';
    return;
  }
  const rate = Math.round((checksResponded / checksReceived) * 100);
  document.getElementById('attPercent').textContent = rate + '%';
}

// CLASS ENDED
socket.on('class-ended', function() {
  if (popupTimer) { clearInterval(popupTimer); popupTimer = null; }
  popupOverlay.classList.add('hidden');

  if (isStudentCameraOn) stopStudentCamera();

  inClassBox.classList.add('hidden');
  endedBox.classList.remove('hidden');

  if (peerConnection) { peerConnection.close(); peerConnection = null; }
});