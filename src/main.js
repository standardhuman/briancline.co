// Brian Cline Landing Page

import { inject } from '@vercel/analytics';
import { captureException, init, setTags, withScope } from '@sentry/browser';
import posthog from 'posthog-js/dist/module.slim';
import { createAnalytics, sanitizeAttribution } from './analytics.js';
import { createBrowserMonitoring } from './monitoring.js';

const monitoring = createBrowserMonitoring({
  sdk: { captureException, init, setTags, withScope },
  env: import.meta.env,
});
monitoring.initialize({ surface: 'landing', stage: 'browser-runtime' });

const analytics = createAnalytics({ sdk: posthog, env: import.meta.env });
analytics.initialize();
analytics.capture('$pageview', {
  surface: 'landing',
  service: 'landing',
  ...sanitizeAttribution({ search: globalThis.location?.search, referrer: document.referrer }),
});

// Initialize Vercel Analytics
inject();

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Add scroll-based nav enhancement (inspired by TMC site)
const nav = document.getElementById('main-nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    nav.classList.add('nav-scrolled');
  } else {
    nav.classList.remove('nav-scrolled');
  }
});

// Contact form handling
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  let contactStarted = false;
  contactForm.addEventListener('input', () => {
    if (contactStarted) return;
    contactStarted = true;
    analytics.capture('contact_started', {
      surface: 'landing',
      service: 'landing',
      step: 'form',
    });
  });

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const formData = {
      name: contactForm.name.value,
      email: contactForm.email.value,
      message: contactForm.message.value,
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        submitBtn.textContent = 'Message Sent!';
        submitBtn.classList.remove('bg-gray-900', 'hover:bg-gray-800');
        submitBtn.classList.add('bg-green-600');
        contactForm.reset();
        analytics.capture('contact_submitted', {
          surface: 'landing',
          service: 'landing',
          step: 'submit',
          result: 'success',
        });
        contactStarted = false;

        // Reset button after 3 seconds
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.classList.remove('bg-green-600');
          submitBtn.classList.add('bg-gray-900', 'hover:bg-gray-800');
          submitBtn.disabled = false;
        }, 3000);
      } else {
        throw new Error('Failed to send');
      }
    } catch (error) {
      submitBtn.textContent = 'Failed - Try Again';
      submitBtn.classList.remove('bg-gray-900', 'hover:bg-gray-800');
      submitBtn.classList.add('bg-red-600');
      analytics.capture('contact_submitted', {
        surface: 'landing',
        service: 'landing',
        step: 'submit',
        result: 'failed',
      });

      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('bg-red-600');
        submitBtn.classList.add('bg-gray-900', 'hover:bg-gray-800');
        submitBtn.disabled = false;
      }, 3000);
    }
  });
}
