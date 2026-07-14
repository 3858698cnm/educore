const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
const profileComplete = localStorage.getItem('profileComplete');

if (!token) {
  window.location.href = '/login';
}

// If profile already complete, redirect to dashboard
if (profileComplete === 'true') {
  if (role === 'admin') window.location.href = '/admin/dashboard';
  else if (role === 'lecturer') window.location.href = '/lecturer/dashboard';
  else window.location.href = '/student/dashboard';
}

// Show correct form based on role
if (role === 'lecturer') {
  document.getElementById('studentForm').style.display = 'none';
  document.getElementById('lecturerForm').style.display = 'block';
} else {
  document.getElementById('studentForm').style.display = 'block';
  document.getElementById('lecturerForm').style.display = 'none';
}

// Load faculties into both dropdowns
async function loadFaculties() {
  try {
    const res = await fetch('/api/public/faculties');
    const faculties = await res.json();

    ['faculty', 'lecturerFaculty'].forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '<option value="">Select Faculty</option>';
      faculties.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f._id;
        opt.textContent = f.name;
        select.appendChild(opt);
      });
    });
  } catch (err) {
    console.log('Error loading faculties:', err);
  }
}

// Student: faculty change → load departments
document.getElementById('faculty').addEventListener('change', async function() {
  const facultyId = this.value;
  const deptSelect = document.getElementById('department');
  const courseSelect = document.getElementById('course');

  deptSelect.innerHTML = '<option value="">Select Department</option>';
  deptSelect.disabled = true;
  courseSelect.innerHTML = '<option value="">Select Department first</option>';
  courseSelect.disabled = true;

  if (!facultyId) return;

  try {
    const res = await fetch('/api/public/departments/' + facultyId);
    const departments = await res.json();

    departments.forEach(d => {
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

// Student: department change → load courses
document.getElementById('department').addEventListener('change', async function() {
  const departmentId = this.value;
  const courseSelect = document.getElementById('course');

  courseSelect.innerHTML = '<option value="">Select Course</option>';
  courseSelect.disabled = true;

  if (!departmentId) return;

  try {
    const res = await fetch('/api/public/courses/' + departmentId);
    const courses = await res.json();

    courses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c._id;
      opt.textContent = c.name;
      courseSelect.appendChild(opt);
    });
    courseSelect.disabled = false;
  } catch (err) {
    console.log('Error loading courses:', err);
  }
});

// Lecturer: faculty change → load departments
document.getElementById('lecturerFaculty').addEventListener('change', async function() {
  const facultyId = this.value;
  const deptSelect = document.getElementById('lecturerDept');

  deptSelect.innerHTML = '<option value="">Select Department</option>';
  deptSelect.disabled = true;

  if (!facultyId) return;

  try {
    const res = await fetch('/api/public/departments/' + facultyId);
    const departments = await res.json();

    departments.forEach(d => {
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

// Save student profile
document.getElementById('saveBtn').addEventListener('click', async function() {
  const facultyId = document.getElementById('faculty').value;
  const departmentId = document.getElementById('department').value;
  const courseId = document.getElementById('course').value;
  const messageEl = document.getElementById('message');

  if (!facultyId || !departmentId || !courseId) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Please select Faculty, Department and Course';
    return;
  }

  try {
    const res = await fetch('/api/complete-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ facultyId, departmentId, courseId })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('profileComplete', 'true');
      messageEl.style.color = '#16a34a';
      messageEl.textContent = 'Profile saved! Redirecting...';
      setTimeout(() => {
        window.location.href = '/student/dashboard';
      }, 1000);
    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }
  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong';
  }
});

// Save lecturer profile
document.getElementById('saveLecturerBtn').addEventListener('click', async function() {
  const facultyId = document.getElementById('lecturerFaculty').value;
  const departmentId = document.getElementById('lecturerDept').value;
  const messageEl = document.getElementById('message');

  if (!facultyId || !departmentId) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Please select Faculty and Department';
    return;
  }

  try {
    const res = await fetch('/api/complete-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ facultyId, departmentId })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('profileComplete', 'true');
      messageEl.style.color = '#16a34a';
      messageEl.textContent = 'Profile saved! Redirecting...';
      setTimeout(() => {
        window.location.href = '/lecturer/dashboard';
      }, 1000);
    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }
  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong';
  }
});

loadFaculties();