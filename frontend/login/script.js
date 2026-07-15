const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const eyeIcon = document.getElementById('eyeIcon');

togglePassword.addEventListener('click', function() {
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.innerHTML = '<path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.8 21.8 0 015.06-6.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a21.77 21.77 0 01-3.22 4.68M14.12 14.12a3 3 0 11-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } else {
    passwordInput.type = 'password';
    eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
});
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

// STEP 1: Request reset code
document.getElementById('requestCodeBtn').addEventListener('click', async function() {
  const email = document.getElementById('resetEmail').value.trim();
  const resetMessage = document.getElementById('resetMessage');

  if (!email) {
    resetMessage.style.color = '#e11d48';
    resetMessage.textContent = 'Please enter your email';
    return;
  }

  try {
    const response = await fetch('/api/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (response.ok) {
      resetMessage.style.color = '#16a34a';
      resetMessage.textContent = 'Code sent! Check your email.';
      document.getElementById('requestCodeStep').classList.add('hidden');
      document.getElementById('enterCodeStep').classList.remove('hidden');
    } else {
      resetMessage.style.color = '#e11d48';
      resetMessage.textContent = data.message;
    }
  } catch (err) {
    resetMessage.style.color = '#e11d48';
    resetMessage.textContent = 'Something went wrong. Try again.';
  }
});

// STEP 2: Reset password with code
document.getElementById('resetBtn').addEventListener('click', async function() {
  const email = document.getElementById('resetEmail').value.trim();
  const code = document.getElementById('resetCode').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const resetMessage = document.getElementById('resetMessage');

  if (!code || !newPassword || !confirmPassword) {
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
      body: JSON.stringify({ email, code, newPassword })
    });

    const data = await response.json();

    if (response.ok) {
      resetMessage.style.color = '#16a34a';
      resetMessage.textContent = 'Password reset successfully! You can now login.';
      document.getElementById('resetCode').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
      setTimeout(() => {
        document.getElementById('forgotBox').classList.add('hidden');
        document.getElementById('requestCodeStep').classList.remove('hidden');
        document.getElementById('enterCodeStep').classList.add('hidden');
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