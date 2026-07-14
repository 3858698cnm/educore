const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let allFaculties = [];
let allDepartments = [];

// Load faculties dropdown
async function loadFaculties() {
  try {
    const res = await fetch('/api/faculties', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    allFaculties = await res.json();

    const select = document.getElementById('courseFaculty');
    select.innerHTML = '<option value="">Select Faculty</option>';
    allFaculties.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f._id;
      opt.textContent = f.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.log('Error loading faculties:', err);
  }
}

// When faculty is selected, load departments
document.getElementById('courseFaculty').addEventListener('change', async function() {
  const facultyId = this.value;
  const deptSelect = document.getElementById('courseDept');

  if (!facultyId) {
    deptSelect.innerHTML = '<option value="">Select Department</option>';
    deptSelect.disabled = true;
    return;
  }

  try {
    const res = await fetch('/api/departments?facultyId=' + facultyId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    allDepartments = await res.json();

    deptSelect.innerHTML = '<option value="">Select Department</option>';
    allDepartments.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d._id;
      opt.textContent = d.name;
      deptSelect.appendChild(opt);
    });
    deptSelect.disabled = false;
  } catch (err) {
    console.log('Error loading departments:', err);
  }
});

// Load all courses
async function loadCourses() {
  try {
    const [courseRes, deptRes, facRes] = await Promise.all([
      fetch('/api/courses', { headers: { 'Authorization': 'Bearer ' + token } }),
      fetch('/api/departments', { headers: { 'Authorization': 'Bearer ' + token } }),
      fetch('/api/faculties', { headers: { 'Authorization': 'Bearer ' + token } })
    ]);

    const courses = await courseRes.json();
    const departments = await deptRes.json();
    const faculties = await facRes.json();

    const tbody = document.getElementById('courseTableBody');
    tbody.innerHTML = '';

    if (courses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">No courses added yet</td></tr>';
      return;
    }

    courses.forEach(course => {
      const dept = departments.find(d => d._id === course.departmentId);
      const faculty = dept ? faculties.find(f => f._id === dept.facultyId) : null;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${course.name}</td>
        <td>${dept ? dept.name : '-'}</td>
        <td>${faculty ? faculty.name : '-'}</td>
        <td><button class="delete-btn" onclick="deleteCourse('${course._id}')">Delete</button></td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.log('Error loading courses:', err);
  }
}

// Add course
document.getElementById('addBtn').addEventListener('click', async function() {
  const name = document.getElementById('courseName').value.trim();
  const departmentId = document.getElementById('courseDept').value;
  const messageEl = document.getElementById('message');

  if (!name || !departmentId) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Course name and department are required';
    return;
  }

  try {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ name, departmentId })
    });

    const data = await res.json();

    if (res.ok) {
      messageEl.style.color = '#16a34a';
      messageEl.textContent = 'Course added successfully';
      document.getElementById('courseName').value = '';
      document.getElementById('courseFaculty').value = '';
      document.getElementById('courseDept').innerHTML = '<option value="">Select Department</option>';
      document.getElementById('courseDept').disabled = true;
      loadCourses();
    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }
  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong';
  }
});

// Delete course
async function deleteCourse(id) {
  if (!confirm('Are you sure you want to delete this course?')) return;
  try {
    await fetch('/api/courses/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    loadCourses();
  } catch (err) {
    console.log('Error:', err);
  }
}

async function init() {
  await loadFaculties();
  await loadCourses();
}

init();