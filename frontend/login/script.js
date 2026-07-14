document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const messageEl = document.getElementById('message');

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Save the token and user info in the browser
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('name', data.name);
      localStorage.setItem('userId', data.id);
      localStorage.setItem('profileComplete', data.profileComplete);

      messageEl.style.color = '#16a34a';
      messageEl.textContent = 'Login successful! Redirecting...';

setTimeout(() => {
        if (data.role === 'admin') {
          window.location.href = '/admin/dashboard';
        } else if (data.profileComplete === true) {
          if (data.role === 'lecturer') {
            window.location.href = '/lecturer/dashboard';
          } else {
            window.location.href = '/student/dashboard';
          }
        } else {
          window.location.href = '/complete-profile';
        }
      }, 1000);

    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }

  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong. Try again.';
  }
});
// Toggle forgot password box
document.getElementById('forgotLink').addEventListener('click', function(e) {
  e.preventDefault();
  const box = document.getElementById('forgotBox');
  box.classList.toggle('hidden');
});

// Reset password
document.getElementById('resetBtn').addEventListener('click', async function() {
  const email = document.getElementById('resetEmail').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const resetMessage = document.getElementById('resetMessage');

  if (!email || !newPassword || !confirmPassword) {
    resetMessage.style.color = '#e11d48';
    resetMessage.textContent = 'Please fill in all fields';
    return;
  }

  if (newPassword !== confirmPassword) {
    resetMessage.style.color = '#e11d48';
    resetMessage.textContent = 'Passwords do not match';
    return;
  }

  if (newPassword.length < 6) {
    resetMessage.style.color = '#e11d48';
    resetMessage.textContent = 'Password must be at least 6 characters';
    return;
  }

  try {
    const response = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword })
    });

    const data = await response.json();

    if (response.ok) {
      resetMessage.style.color = '#16a34a';
      resetMessage.textContent = 'Password reset successfully! You can now login.';
      document.getElementById('resetEmail').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
      setTimeout(() => {
        document.getElementById('forgotBox').classList.add('hidden');
        resetMessage.textContent = '';
      }, 3000);
    } else {
      resetMessage.style.color = '#e11d48';
      resetMessage.textContent = data.message;
    }
  } catch (err) {
    resetMessage.style.color = '#e11d48';
    resetMessage.textContent = 'Something went wrong. Try again.';
  }
});