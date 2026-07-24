const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
const lecturerName = localStorage.getItem('name');
const lecturerId = localStorage.getItem('userId');

if (!token || role !== 'lecturer') {
  window.location.href = '/login';
}

const socket = io();

let sessionId = null;
let checksSent = 0;
let selectedUnitId = null;
let students = {};

// WebRTC
let localStream = null;
let micTrack = null;
let screenStream = null;
let isCameraOn = false;
let isMicOn = false;
let isScreenSharing = false;
let peerConnections = {};
// Student cameras
let studentPeerConnections = {}; // { studentId: RTCPeerConnection }

const iceConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const setupBox = document.getElementById('setupBox');
const liveBox = document.getElementById('liveBox');
const summaryBox = document.getElementById('summaryBox');
const localVideo = document.getElementById('localVideo');
const noVideoMsg = document.getElementById('noVideoMsg');
// STUDENT CAMERA STARTED
socket.on('student-camera-started', (data) => {
  const { studentId, studentName } = data;
  console.log('Student camera started:', studentName);

  // Add camera box for this student
  const box = document.getElementById('studentCamerasBox');
  const noText = box.querySelector('.no-cameras-text');
  if (noText) noText.remove();

if (!document.getElementById('cam-' + studentId)) {
  const item = document.createElement('div');
  item.className = 'student-camera-item';
  item.id = 'cam-' + studentId;
  item.innerHTML = `
    <video id="camvideo-${studentId}" autoplay playsinline muted></video>
    <div class="student-camera-label">${studentName}</div>
  `;
  box.appendChild(item);
}

// STUDENT CAMERA STOPPED
socket.on('student-camera-stopped', (data) => {
  const { studentId } = data;
  const item = document.getElementById('cam-' + studentId);
  if (item) item.remove();

  if (studentPeerConnections[studentId]) {
    studentPeerConnections[studentId].close();
    delete studentPeerConnections[studentId];
  }

  const box = document.getElementById('studentCamerasBox');
  if (box.children.length === 0) {
    box.innerHTML = '<p class="no-cameras-text">No student cameras on</p>';
  }
});

// RECEIVE STUDENT CAMERA OFFER
socket.on('student-webrtc-offer', async (data) => {
  const { studentId, studentName, offer } = data;
  console.log('Received camera offer from student:', studentName);

  if (studentPeerConnections[studentId]) {
    studentPeerConnections[studentId].close();
  }

  const pc = new RTCPeerConnection(iceConfig);
  studentPeerConnections[studentId] = pc;

  // When we receive student stream show in their video element
pc.ontrack = (event) => {
  console.log('Received student camera stream:', studentName);
  const videoEl = document.getElementById('camvideo-' + studentId);
  if (videoEl && event.streams && event.streams[0]) {
    videoEl.srcObject = event.streams[0];
    videoEl.play().catch(err => console.log('Play blocked:', err));
  }
};

  // Send ICE candidates back to student
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('lecturer-student-ice-candidate', {
        sessionId,
        studentId,
        candidate: event.candidate
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('Student', studentName, 'camera state:', pc.connectionState);
  };

  // Create answer
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit('lecturer-student-answer', {
    sessionId,
    studentId,
    answer: pc.localDescription
  });
});

// RECEIVE ICE CANDIDATES FROM STUDENT CAMERA
socket.on('lecturer-student-ice-candidate', async (data) => {
  const { studentId, candidate } = data;
  const pc = studentPeerConnections[studentId];
  if (pc && candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.log('Student ICE error:', err);
    }
  }
});
// Load units
async function loadUnits() {
  try {
    const res = await fetch('/api/my-units', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const units = await res.json();

    const select = document.getElementById('unitSelect');
    select.innerHTML = '<option value="">Select the unit you are teaching</option>';

    units.forEach(unit => {
      const opt = document.createElement('option');
      opt.value = unit._id;
      opt.textContent = unit.name + ' (' + unit.code + ')';
      select.appendChild(opt);
    });
  } catch (err) {
    console.log('Error loading units:', err);
  }
}

// Preview camera
document.getElementById('previewCameraBtn').addEventListener('click', async function() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const preview = document.getElementById('previewVideo');
    preview.srcObject = stream;
    preview.classList.remove('hidden');
    this.textContent = '📹 Camera Working ✓';
    this.style.background = '#16a34a';
  } catch (err) {
    alert('Could not access camera. Please check permissions.');
  }
});

// Test microphone
document.getElementById('testMicBtn').addEventListener('click', async function() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    document.getElementById('micStatus').textContent = '🎤 Microphone is working ✓';
    this.textContent = '🎤 Mic Working ✓';
    this.style.background = '#16a34a';
    stream.getTracks().forEach(track => track.stop());
  } catch (err) {
    alert('Could not access microphone. Please check permissions.');
  }
});

// START CLASS
document.getElementById('startBtn').addEventListener('click', function() {
  const className = document.getElementById('className').value.trim();
  const unitId = document.getElementById('unitSelect').value;

  if (!unitId) { alert('Please select a unit first'); return; }
  if (!className) { alert('Please enter a class name or topic'); return; }

  selectedUnitId = unitId;
  const select = document.getElementById('unitSelect');
  const unitName = select.options[select.selectedIndex].text;

  socket.emit('lecturer-start-class', {
    className, unitId, unitName, lecturerId, lecturerName
  });
});

// CLASS STARTED
socket.on('class-started', function(data) {
  sessionId = data.sessionId;
  document.getElementById('liveClassName').textContent = data.className;
  document.getElementById('sessionIdText').textContent = data.sessionId;

  setupBox.classList.add('hidden');
  liveBox.classList.remove('hidden');

  const preview = document.getElementById('previewVideo');
  if (preview.srcObject) {
    preview.srcObject.getTracks().forEach(t => t.stop());
  }

  window.checkInterval = setInterval(sendAttentionCheck, 30000);
});

// COPY SESSION ID
document.getElementById('copyBtn').addEventListener('click', function() {
  const id = document.getElementById('sessionIdText').textContent;
  navigator.clipboard.writeText(id);
  this.textContent = 'Copied!';
  setTimeout(() => { this.textContent = 'Copy'; }, 2000);
});

// CREATE PEER CONNECTION FOR A STUDENT
async function createPeerConnection(studentSocketId, stream) {
  const pc = new RTCPeerConnection(iceConfig);
  peerConnections[studentSocketId] = pc;

  // Add stream tracks
  if (stream) {
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });
  }

  // Send ICE candidates to student
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', {
        targetSocketId: studentSocketId,
        candidate: event.candidate
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('Connection state:', pc.connectionState, 'for', studentSocketId);
  };

  // Create and send offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit('webrtc-offer', {
    targetSocketId: studentSocketId,
    offer: pc.localDescription,
    sessionId
  });

  return pc;
}

// START STREAM AND SEND TO ALL STUDENTS
async function startStreamToStudents(stream) {
  localVideo.srcObject = stream;
  noVideoMsg.style.display = 'none';

  // Close existing connections
  for (let socketId in peerConnections) {
    peerConnections[socketId].close();
  }
  peerConnections = {};

  // Notify students stream started
  socket.emit('lecturer-media-started', { sessionId, type: 'stream' });

  // Create peer connection for each connected student
  for (let studentId in students) {
    const studentSocketId = students[studentId].socketId;
    if (studentSocketId) {
      await createPeerConnection(studentSocketId, stream);
    }
  }
}

// STUDENT IS READY FOR STREAM
socket.on('student-ready-for-stream', async (data) => {
  const { studentSocketId } = data;
  const activeStream = screenStream || localStream;
  if (activeStream) {
    if (peerConnections[studentSocketId]) {
      peerConnections[studentSocketId].close();
      delete peerConnections[studentSocketId];
    }
    await createPeerConnection(studentSocketId, activeStream);
  }
});

// RECEIVE ANSWER FROM STUDENT
socket.on('webrtc-answer', async (data) => {
  const { answer, fromSocketId } = data;
  const pc = peerConnections[fromSocketId];
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

// RECEIVE ICE CANDIDATE FROM STUDENT
socket.on('webrtc-ice-candidate', async (data) => {
  const { candidate, fromSocketId } = data;
  const pc = peerConnections[fromSocketId];
  if (pc && candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.log('ICE error:', err);
    }
  }
});
async function ensureMicTrack() {
  if (!micTrack) {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micTrack = micStream.getAudioTracks()[0];
  }
  return micTrack;
}

function getActiveVideoStream() {
  return screenStream || localStream;
}

async function rebuildOutgoingStream() {
  const videoStream = getActiveVideoStream();
  const combined = new MediaStream();

  if (videoStream) {
    videoStream.getVideoTracks().forEach(t => combined.addTrack(t));
  }
  if (micTrack) {
    micTrack.enabled = isMicOn;
    combined.addTrack(micTrack);
  }

  if (combined.getTracks().length === 0) {
    for (let socketId in peerConnections) {
      peerConnections[socketId].close();
    }
    peerConnections = {};
    socket.emit('lecturer-media-stopped', { sessionId });
    return;
  }

  await startStreamToStudents(combined);
}

// TOGGLE CAMERA

document.getElementById('toggleCameraBtn').addEventListener('click', async function() {
  if (isScreenSharing) {
    alert('Stop screen sharing first');
    return;
  }

  if (!isCameraOn) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      localStream = stream;
      isCameraOn = true;
      this.textContent = '📹 Camera Off';
      this.classList.add('active');
      await rebuildOutgoingStream();
    } catch (err) {
      alert('Could not access camera.');
    }
  } else {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    localVideo.srcObject = null;
    noVideoMsg.style.display = 'flex';
    isCameraOn = false;
    this.textContent = '📹 Camera On';
    this.classList.remove('active');
    await rebuildOutgoingStream();
  }
});
// TOGGLE MICROPHONE
document.getElementById('toggleMicBtn').addEventListener('click', async function() {
  try {
    await ensureMicTrack();
    isMicOn = !isMicOn;
    micTrack.enabled = isMicOn;

    this.textContent = isMicOn ? '🎤 Mic Off' : '🎤 Mic On';
    this.classList.toggle('active', isMicOn);

    await rebuildOutgoingStream();
  } catch (err) {
    alert('Could not access microphone.');
  }
});

// SHARE SCREEN
document.getElementById('shareScreenBtn').addEventListener('click', async function() {
  if (isScreenSharing) {
    await stopScreenShare();
    return;
  }

  if (isCameraOn) {
    alert('Turn off camera first');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });

    screenStream = stream;
    isScreenSharing = true;
    this.textContent = '🛑 Stop Sharing';
    this.classList.add('active');

    await rebuildOutgoingStream();

    stream.getVideoTracks()[0].addEventListener('ended', stopScreenShare);
  } catch (err) {
    console.log('Screen share cancelled:', err);
  }
});

// STOP SCREEN SHARE
async function stopScreenShare() {
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  localVideo.srcObject = null;
  noVideoMsg.style.display = 'flex';
  isScreenSharing = false;

  const btn = document.getElementById('shareScreenBtn');
  btn.textContent = '🖥️ Share Screen';
  btn.classList.remove('active');

  await rebuildOutgoingStream();
}

// STUDENT JOINS
socket.on('student-joined', function(data) {
  students[data.studentId] = {
    name: data.studentName,
    socketId: data.studentSocketId,
    checksSent: 0,
    responses: 0
  };
  renderStudentTable();
});

// SEND ATTENTION CHECK
function sendAttentionCheck() {
  checksSent++;
  document.getElementById('checksSentCount').textContent = checksSent;

  for (let id in students) {
    students[id].checksSent++;
  }

  socket.emit('send-attention-check', { sessionId });
  renderStudentTable();
}

// STUDENT RESPONDS
socket.on('student-responded', function(data) {
  if (students[data.studentId]) {
    students[data.studentId].responses++;
    renderStudentTable();
  }
});

// RENDER TABLE
function renderStudentTable() {
  const tbody = document.getElementById('studentTableBody');
  tbody.innerHTML = '';
  document.getElementById('studentCount').textContent = Object.keys(students).length;

  for (let id in students) {
    const s = students[id];
    let status = 'present', statusText = 'Present';

    if (s.checksSent === 0) {
      status = 'present'; statusText = 'Present';
    } else if (s.responses === 0) {
      status = 'absent'; statusText = 'Absent';
    } else if (s.responses < s.checksSent) {
      status = 'partial'; statusText = 'Partial';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${s.name}</td>
      <td>${s.responses}/${s.checksSent}</td>
      <td><span class="badge ${status}">${statusText}</span></td>
    `;
    tbody.appendChild(row);
  }
}

// END CLASS
document.getElementById('endBtn').addEventListener('click', function() {
  if (!confirm('Are you sure you want to end this class?')) return;

  clearInterval(window.checkInterval);
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  if (screenStream) screenStream.getTracks().forEach(t => t.stop());

  for (let socketId in peerConnections) {
    peerConnections[socketId].close();
  }
  for (let sId in studentPeerConnections) {
    studentPeerConnections[sId].close();
  }

  socket.emit('lecturer-end-class', {
    sessionId, students, unitId: selectedUnitId
  });
});

// CLASS ENDED SUMMARY
socket.on('class-ended-summary', function(data) {
  liveBox.classList.add('hidden');
  summaryBox.classList.remove('hidden');

  const tbody = document.getElementById('summaryTableBody');
  tbody.innerHTML = '';

  data.results.forEach(r => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${r.studentName}</td>
      <td>${r.attendancePercent}%</td>
      <td><span class="badge ${r.finalStatus}">${r.finalStatus}</span></td>
    `;
    tbody.appendChild(row);
  });
});

// NEW CLASS
document.getElementById('newClassBtn').addEventListener('click', function() {
  window.location.reload();
});

loadUnits();

// REJOIN LOGIC
const urlParams = new URLSearchParams(window.location.search);
const rejoinSessionId = urlParams.get('rejoin');
const rejoinClassName = urlParams.get('className');
const rejoinUnitId = urlParams.get('unitId');

if (rejoinSessionId && rejoinClassName && rejoinUnitId) {
  selectedUnitId = rejoinUnitId;
  sessionId = rejoinSessionId;

  document.getElementById('liveClassName').textContent = rejoinClassName;
  document.getElementById('sessionIdText').textContent = rejoinSessionId;

  setupBox.classList.add('hidden');
  liveBox.classList.remove('hidden');

  socket.emit('lecturer-rejoin-class', {
    sessionId: rejoinSessionId,
    lecturerId,
    lecturerName
  });

  window.checkInterval = setInterval(sendAttentionCheck, 30000);
}