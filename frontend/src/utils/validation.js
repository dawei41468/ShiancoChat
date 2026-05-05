// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Password requirements:
// - At least 12 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one digit
// - At least one special character
const PASSWORD_MIN_LENGTH = 12;

export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email is required' };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  return { valid: true };
};

export const validatePassword = (password) => {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }
  return { valid: true };
};

export const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const index = Math.min(Math.floor(score / 1.2), labels.length - 1);

  const colors = [
    'bg-red-500',
    'bg-red-400',
    'bg-yellow-400',
    'bg-yellow-300',
    'bg-green-400',
    'bg-green-500',
  ];

  return {
    score,
    label: labels[index],
    color: colors[index],
    width: `${Math.min((score / 6) * 100, 100)}%`,
  };
};
