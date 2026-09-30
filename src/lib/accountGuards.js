export function activationPath(customer) {
  if (!customer) return '/auth';
  if (customer.password_setup_required) return '/recover-account';
  if (customer.profile_review_required) return '/review-profile';
  return '';
}

export function needsActivation(customer) {
  return Boolean(activationPath(customer));
}
