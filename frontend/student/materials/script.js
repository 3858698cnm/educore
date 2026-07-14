const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'student') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let allMaterials = [];
let allUnits = [];

async function loadMaterials() {
  try {
    const res = await fetch('/api/my-course-materials', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    allMaterials = data.materials || [];
    allUnits = data.units || [];

    // Populate unit filter dropdown
    const unitFilter = document.getElementById('unitFilter');
    unitFilter.innerHTML = '<option value="">All Units</option>';
    allUnits.forEach(unit => {
      const opt = document.createElement('option');
      opt.value = unit._id;
      opt.textContent = unit.name + ' (' + unit.code + ')';
      unitFilter.appendChild(opt);
    });

    renderMaterials(allMaterials);

  } catch (err) {
    console.log('Error loading materials:', err);
  }
}

function renderMaterials(materials) {
  const listEl = document.getElementById('materialsList');

  if (materials.length === 0) {
    listEl.innerHTML = '<p class="empty-text">No materials available yet. Check back later!</p>';
    return;
  }

  listEl.innerHTML = '';
  materials.forEach(mat => {
    const unit = allUnits.find(u => u._id === mat.unitId);
    const unitName = unit ? unit.name + ' (' + unit.code + ')' : 'General';
    const date = new Date(mat.createdAt).toLocaleDateString();

    const card = document.createElement('div');
    card.className = 'material-card';
    card.innerHTML = `
      <div class="material-info">
        <span class="unit-tag">${unitName}</span>
        <h3>${mat.title}</h3>
        <div class="date">📅 Uploaded: ${date}</div>
      </div>
      <div>
        ${mat.link
          ? `<a href="${mat.link}" target="_blank" class="view-btn">📄 View</a>`
          : '<span class="no-link">No link provided</span>'
        }
      </div>
    `;
    listEl.appendChild(card);
  });
}

// Filter by unit
document.getElementById('unitFilter').addEventListener('change', function() {
  const unitId = this.value;
  if (!unitId) {
    renderMaterials(allMaterials);
  } else {
    const filtered = allMaterials.filter(m => m.unitId === unitId);
    renderMaterials(filtered);
  }
});

loadMaterials();