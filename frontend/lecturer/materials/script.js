const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'lecturer') {
  window.location.href = '/login';
}
document.getElementById('menuToggleBtn').addEventListener('click', function() {
  document.getElementById('sidebar').classList.toggle('open');
});
document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let myUnits = [];

// Load lecturer's units into dropdown
async function loadUnits() {
  try {
    const res = await fetch('/api/my-units', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    myUnits = await res.json();

    const select = document.getElementById('unitSelect');
    select.innerHTML = '<option value="">Select Unit</option>';

    myUnits.forEach(unit => {
      const opt = document.createElement('option');
      opt.value = unit._id;
      opt.textContent = unit.name + ' (' + unit.code + ')';
      select.appendChild(opt);
    });
  } catch (err) {
    console.log('Error loading units:', err);
  }
}

// Load all materials uploaded by this lecturer
async function loadMaterials() {
  try {
    const res = await fetch('/api/my-materials', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const materials = await res.json();

    const listEl = document.getElementById('materialsList');

    if (materials.length === 0) {
      listEl.innerHTML = '<p class="empty-text">No materials uploaded yet.</p>';
      return;
    }

    listEl.innerHTML = '';
    materials.forEach(mat => {
      const unit = myUnits.find(u => u._id === mat.unitId);
      const unitName = unit ? unit.name + ' (' + unit.code + ')' : 'Unknown Unit';
      const date = new Date(mat.createdAt).toLocaleDateString();

      const card = document.createElement('div');
      card.className = 'material-card';
      card.innerHTML = `
        <div class="material-info">
          <span class="unit-tag">${unitName}</span>
          <h3>${mat.title}</h3>
          <div class="date">Uploaded: ${date}</div>
        </div>
        <div class="material-actions">
          ${mat.link
            ? `<a href="${mat.link}" target="_blank" class="view-btn">View</a>`
            : '<span style="color:#999;font-size:13px;">No link</span>'
          }
          <button class="delete-btn" onclick="deleteMaterial('${mat._id}')">Delete</button>
        </div>
      `;
      listEl.appendChild(card);
    });

  } catch (err) {
    console.log('Error loading materials:', err);
  }
}

// Upload material
document.getElementById('uploadBtn').addEventListener('click', async function() {
  const unitId = document.getElementById('unitSelect').value;
  const title = document.getElementById('materialTitle').value.trim();
  const link = document.getElementById('materialLink').value.trim();
  const fileInput = document.getElementById('materialFile');
  const file = fileInput ? fileInput.files[0] : null;
  const messageEl = document.getElementById('message');

  if (!unitId || !title) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Please select a unit and enter a title';
    return;
  }

  if (!file && !link) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Please upload a file or enter a link';
    return;
  }

  const formData = new FormData();
  formData.append('unitId', unitId);
  formData.append('title', title);
  formData.append('link', link);
  if (file) formData.append('file', file);

  try {
    const res = await fetch('/api/materials', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      body: formData
    });

    const data = await res.json();

    if (res.ok) {
      messageEl.style.color = '#16a34a';
      messageEl.textContent = 'Material uploaded successfully';
      document.getElementById('materialTitle').value = '';
      document.getElementById('materialLink').value = '';
      if (fileInput) fileInput.value = '';
      document.getElementById('unitSelect').value = '';
      await loadMaterials();
    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }
  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong';
  }
});

// Delete material
async function deleteMaterial(id) {
  if (!confirm('Are you sure you want to delete this material?')) return;

  try {
    await fetch('/api/materials/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    await loadMaterials();
  } catch (err) {
    console.log('Error deleting material:', err);
  }
}

async function init() {
  await loadUnits();
  await loadMaterials();
}

init();