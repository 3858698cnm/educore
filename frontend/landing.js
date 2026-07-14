// If user is already logged in, redirect to their dashboard
const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
const profileComplete = localStorage.getItem('profileComplete');

if (token && role) {
  if (role === 'admin') {
    window.location.href = '/admin/dashboard';
  } else if (profileComplete === 'true') {
    if (role === 'lecturer') {
      window.location.href = '/lecturer/dashboard';
    } else {
      window.location.href = '/student/dashboard';
    }
  } else {
    window.location.href = '/complete-profile';
  }
}

// Smooth scroll for any anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Add scroll animation to feature cards
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .role-card').forEach(card => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(20px)';
  card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(card);
});