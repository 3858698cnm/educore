const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let coursesList = [];
let lecturersList = [];

// Load courses dropdown
async function loadCoursesDropdown() {
  try {
    const response = await fetch('/api/courses', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    coursesList = await response.json();

    const select = document.getElementById('unitCourse');
    select.innerHTML = '<option value="">Select Course</option>';

    coursesList.forEach(course => {
      const option = document.createElement('option');
      option.value = course._id;
      option.textContent = course.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.log('Error loading courses:', err);
  }
}

// Load lecturers dropdown
async function loadLecturersDropdown() {
  try {
    const response = await fetch('/api/lecturers', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    lecturersList = await response.json();

    const select = document.getElementById('unitLecturer');
    select.innerHTML = '<option value="">Select Lecturer</option>';

    lecturersList.forEach(lect => {
      const option = document.createElement('option');
      option.value = lect._id;
      option.textContent = lect.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.log('Error loading lecturers:', err);
  }
}

// Load all units
async function loadUnits() {
  try {
    const response = await fetch('/api/units', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const units = await response.json();

    const tbody = document.getElementById('unitTableBody');
    tbody.innerHTML = '';

    if (units.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">No units added yet</td></tr>';
      return;
    }

    units.forEach(unit => {
      const course = coursesList.find(c => c._id === unit.courseId);
      const courseName = course ? course.name : '-';

      const lecturer = lecturersList.find(l => l._id === unit.lecturerId);
      const lecturerName = lecturer ? lecturer.name : 'Not assigned';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${unit.name}</td>
        <td>${unit.code}</td>
        <td>${courseName}</td>
        <td>${lecturerName}</td>
        <td>${unit.attendanceWeight}%</td>
        <td><button class="delete-btn" onclick="deleteUnit('${unit._id}')">Delete</button></td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.log('Error loading units:', err);
  }
}

// Add unit
document.getElementById('addBtn').addEventListener('click', async function() {
  const name = document.getElementById('unitName').value.trim();
  const code = document.getElementById('unitCode').value.trim();
  const courseId = document.getElementById('unitCourse').value;
  const lecturerId = document.getElementById('unitLecturer').value;
  const attendanceWeight = document.getElementById('attendanceWeight').value || 10;
  const messageEl = document.getElementById('message');

  if (!name || !code || !courseId) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Unit name, code and course are required';
    return;
  }

  try {
    const response = await fetch('/api/units', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ name, code, courseId, lecturerId, attendanceWeight })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.style.color = '#16a34a';
      messageEl.textContent = 'Unit added successfully';
      document.getElementById('unitName').value = '';
      document.getElementById('unitCode').value = '';
      document.getElementById('unitCourse').value = '';
      document.getElementById('unitLecturer').value = '';
      loadUnits();
    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }
  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong';
  }
});

// Delete unit
async function deleteUnit(id) {
  if (!confirm('Are you sure you want to delete this unit?')) return;

  try {
    await fetch('/api/units/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    loadUnits();
  } catch (err) {
    console.log('Error deleting unit:', err);
  }
}

async function init() {
  await loadCoursesDropdown();
  await loadLecturersDropdown();
  await loadUnits();
}

init();