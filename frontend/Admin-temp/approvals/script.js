const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

// LOAD PENDING APPROVALS
async function loadPending() {
  try {
    const response = await fetch('/api/admin/pending', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const users = await response.json();

    const listEl = document.getElementById('pendingList');

    if (users.length === 0) {
      listEl.innerHTML = '<p class="empty-text">No pending approvals at the moment.</p>';
      return;
    }

    listEl.innerHTML = '';

    users.forEach(user => {
      const date = new Date(user.createdAt).toLocaleDateString();
      const card = document.createElement('div');
      card.className = 'approval-card';
      card.innerHTML = `
        <div class="approval-info">
          <h3>${user.name}</h3>
          <p>${user.email}</p>
          <p>Registered: ${date}</p>
          <span class="role-badge ${user.role}">${user.role}</span>
        </div>
        <div class="approval-actions">
          <button class="approve-btn" onclick="handleApproval('${user._id}', 'approved')">Approve</button>
          <button class="reject-btn" onclick="handleApproval('${user._id}', 'rejected')">Reject</button>
        </div>
      `;
      listEl.appendChild(card);
    });

  } catch (err) {
    console.log('Error loading pending approvals:', err);
  }
}

// APPROVE OR REJECT
async function handleApproval(userId, status) {
  const action = status === 'approved' ? 'approve' : 'reject';
  if (!confirm(`Are you sure you want to ${action} this account?`)) return;

  try {
    const response = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ userId, status })
    });

    const data = await response.json();

    if (response.ok) {
      loadPending();
    } else {
      alert(data.message);
    }

  } catch (err) {
    console.log('Error handling approval:', err);
  }
}

loadPending();